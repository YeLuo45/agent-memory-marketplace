// V5641-V5655: Memory Playback UI — interactive forensic debugger.
//
// Adds 6 engines that consume streaming events (V7) + memory snapshots to
// produce an inspectable, time-travel debugger for the entire memory stack:
//   - MemorySnapshotter: capture stores by value at a point in time
//   - TimelineView:      flat list of all events with timestamps + filters
//   - TreeVisualizer:    hierarchical view of memory store contents
//   - DiffEngine:        diff two snapshots by content (added/removed/modified)
//   - StepReplay:        replay events in order with optional speed control
//   - ReplayCoordinator: orchestrates all 4 above for end-to-end playback
//
// All engines are pure TypeScript with deterministic behavior (no external
// dependencies). They plug into the streaming events emitted by EventBus /
// StreamProducer / MemoryWatcher to build a complete memory audit debugger.
//
// Reusable from MCP via 5 new tools (Playback.*) and exposed in CLI via
// `amm playback timeline|replay|snapshot|diff`.

import type { StreamEvent } from '../streaming/StreamingCore';

// V5641: MemorySnapshot — value-based snapshot of a memory store
export interface MemorySnapshot {
  id: string;
  label: string;
  takenAt: number;
  storeId: string;
  entries: Array<{ key: string; value: unknown; importance?: number }>;
  size: number;
}

export class MemorySnapshotter {
  private _seq = 0;
  private _snapshots: MemorySnapshot[] = [];
  private _maxRetained = 256;

  capture(label: string, storeId: string, entries: Array<{ key: string; value: unknown; importance?: number }>): MemorySnapshot {
    this._seq += 1;
    const snap: MemorySnapshot = {
      id: `snap_${this._seq}_${Date.now().toString(36)}`,
      label,
      takenAt: Date.now(),
      storeId,
      entries: entries.map((e) => ({ ...e, value: this._clone(e.value) })),
      size: entries.length,
    };
    this._snapshots.push(snap);
    if (this._snapshots.length > this._maxRetained) this._snapshots.shift();
    return snap;
  }

  get(id: string): MemorySnapshot | undefined {
    return this._snapshots.find((s) => s.id === id);
  }

  list(filter?: { storeId?: string; labelContains?: string }): MemorySnapshot[] {
    return this._snapshots.filter((s) => {
      if (filter?.storeId && s.storeId !== filter.storeId) return false;
      if (filter?.labelContains && !s.label.includes(filter.labelContains)) return false;
      return true;
    });
  }

  drop(id: string): boolean {
    const i = this._snapshots.findIndex((s) => s.id === id);
    if (i === -1) return false;
    this._snapshots.splice(i, 1);
    return true;
  }

  stats(): { total: number; retained: number } {
    return { total: this._seq, retained: this._snapshots.length };
  }

  private _clone(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }
}

// V5642: TimelineEvent — flattened event with sequence number
export interface TimelineEntry {
  seq: number;
  ts: number;
  topic: string;
  kind: string;
  payload: Record<string, unknown>;
  priority?: string;
}

export class TimelineView {
  private _entries: TimelineEntry[] = [];
  private _seq = 0;
  private _filters: { topic?: string; kind?: string; since?: number } = {};

  record(events: StreamEvent[]): number {
    let n = 0;
    for (const ev of events) {
      if (this._filters.topic && ev.topic !== this._filters.topic) continue;
      if (this._filters.kind && ev.kind !== this._filters.kind) continue;
      if (this._filters.since && ev.ts < this._filters.since) continue;
      this._seq += 1;
      this._entries.push({
        seq: this._seq,
        ts: ev.ts,
        topic: ev.topic,
        kind: ev.kind,
        payload: ev.payload,
        priority: ev.priority,
      });
      n += 1;
    }
    return n;
  }

  filter(criteria: { topic?: string; kind?: string; since?: number }): void {
    this._filters = { ...this._filters, ...criteria };
  }

  resetFilters(): void {
    this._filters = {};
  }

  list(limit?: number): TimelineEntry[] {
    const sorted = this._entries.slice().sort((a, b) => a.seq - b.seq);
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }

  recent(n = 10): TimelineEntry[] {
    return this._entries.slice(-n);
  }

  byTimeRange(since: number, until: number): TimelineEntry[] {
    return this._entries.filter((e) => e.ts >= since && e.ts <= until);
  }

  count(): number {
    return this._entries.length;
  }

  reset(): void {
    this._entries = [];
    this._seq = 0;
  }
}

// V5643: TreeNode — hierarchical tree node
export interface TreeNode {
  id: string;
  label: string;
  children: TreeNode[];
  weight?: number;
  meta?: Record<string, unknown>;
}

export class TreeVisualizer {
  private _trees: Map<string, TreeNode> = new Map();

  buildTree(rootId: string, label: string, children: TreeNode[]): TreeNode {
    const tree: TreeNode = { id: rootId, label, children, weight: this._computeWeight(children) };
    this._trees.set(rootId, tree);
    return tree;
  }

  addChild(parentId: string, child: TreeNode): boolean {
    const parent = this._findNode(this._trees.get(parentId), (n) => n.id === parentId);
    if (!parent) return false;
    parent.children.push(child);
    parent.weight = (parent.weight ?? 0) + (child.weight ?? 1);
    return true;
  }

  get(id: string): TreeNode | undefined {
    return this._trees.get(id);
  }

  listRoots(): TreeNode[] {
    return Array.from(this._trees.values());
  }

  size(): number {
    return this._trees.size;
  }

  flatten(rootId?: string): Array<{ depth: number; node: TreeNode }> {
    const root = rootId ? this._trees.get(rootId) : Array.from(this._trees.values())[0];
    if (!root) return [];
    const out: Array<{ depth: number; node: TreeNode }> = [];
    const walk = (node: TreeNode, depth: number): void => {
      out.push({ depth, node });
      for (const c of node.children) walk(c, depth + 1);
    };
    walk(root, 0);
    return out;
  }

  private _computeWeight(children: TreeNode[]): number {
    let sum = 0;
    for (const c of children) {
      sum += c.weight ?? 1;
      if (c.children.length > 0) sum += this._computeWeight(c.children);
    }
    return sum;
  }

  private _findNode(root: TreeNode | undefined, predicate: (n: TreeNode) => boolean): TreeNode | undefined {
    if (!root) return undefined;
    if (predicate(root)) return root;
    for (const c of root.children) {
      const f = this._findNode(c, predicate);
      if (f) return f;
    }
    return undefined;
  }
}

// V5644: DiffResult — diff between two snapshots
export interface DiffResult {
  added: Array<{ key: string; value: unknown }>;
  removed: Array<{ key: string; value: unknown }>;
  modified: Array<{ key: string; before: unknown; after: unknown }>;
  unchanged: number;
}

export class DiffEngine {
  diff(a: MemorySnapshot, b: MemorySnapshot): DiffResult {
    const aMap = new Map(a.entries.map((e) => [e.key, e]));
    const bMap = new Map(b.entries.map((e) => [e.key, e]));
    const added: Array<{ key: string; value: unknown }> = [];
    const removed: Array<{ key: string; value: unknown }> = [];
    const modified: Array<{ key: string; before: unknown; after: unknown }> = [];
    let unchanged = 0;

    for (const [key, av] of aMap) {
      const bv = bMap.get(key);
      if (!bv) {
        removed.push({ key, value: av.value });
        continue;
      }
      if (JSON.stringify(av.value) !== JSON.stringify(bv.value)) {
        modified.push({ key, before: av.value, after: bv.value });
      } else {
        unchanged += 1;
      }
    }
    for (const [key, bv] of bMap) {
      if (!aMap.has(key)) {
        added.push({ key, value: bv.value });
      }
    }
    return { added, removed, modified, unchanged };
  }

  summarize(diff: DiffResult): { additions: number; deletions: number; modifications: number; unchanged: number; total: number } {
    return {
      additions: diff.added.length,
      deletions: diff.removed.length,
      modifications: diff.modified.length,
      unchanged: diff.unchanged,
      total: diff.added.length + diff.removed.length + diff.modified.length + diff.unchanged,
    };
  }

  eventsDiff(a: TimelineEntry[], b: TimelineEntry[]): DiffResult {
    const aMap = new Map(a.map((e) => [String(e.seq), e]));
    const bMap = new Map(b.map((e) => [String(e.seq), e]));
    const added: Array<{ key: string; value: unknown }> = [];
    const removed: Array<{ key: string; value: unknown }> = [];
    const modified: Array<{ key: string; before: unknown; after: unknown }> = [];
    let unchanged = 0;
    for (const [seq, av] of aMap) {
      const bv = bMap.get(seq);
      if (!bv) {
        removed.push({ key: seq, value: av });
        continue;
      }
      if (JSON.stringify(av.payload) !== JSON.stringify(bv.payload)) {
        modified.push({ key: seq, before: av, after: bv });
      } else {
        unchanged += 1;
      }
    }
    for (const [seq, bv] of bMap) {
      if (!aMap.has(seq)) added.push({ key: seq, value: bv });
    }
    return { added, removed, modified, unchanged };
  }
}

// V5645: ReplayStep — a single step of a memory playback
export type ReplayStepKind = 'snapshot' | 'event' | 'pause' | 'compute';

export interface ReplayStep {
  seq: number;
  kind: ReplayStepKind;
  ts: number;
  data: unknown;
}

export class StepReplay {
  private _steps: ReplayStep[] = [];
  private _cursor = 0;
  private _seq = 0;
  private _running = false;
  private _stepIntervalMs = 100;

  append(kind: ReplayStepKind, data: unknown): ReplayStep {
    this._seq += 1;
    const step: ReplayStep = { seq: this._seq, kind, ts: Date.now(), data };
    this._steps.push(step);
    return step;
  }

  fromEvents(events: TimelineEntry[]): number {
    let n = 0;
    for (const ev of events) {
      this._seq += 1;
      this._steps.push({ seq: this._seq, kind: 'event', ts: ev.ts, data: ev });
      n += 1;
    }
    return n;
  }

  reset(): void {
    this._steps = [];
    this._cursor = 0;
    this._seq = 0;
    this._running = false;
  }

  next(): ReplayStep | undefined {
    if (this._cursor >= this._steps.length) {
      this._running = false;
      return undefined;
    }
    const step = this._steps[this._cursor];
    this._cursor += 1;
    return step;
  }

  jumpTo(seq: number): ReplayStep | undefined {
    const target = this._steps.find((s) => s.seq === seq);
    if (!target) return undefined;
    this._cursor = this._steps.indexOf(target) + 1;
    return target;
  }

  start(): void {
    this._cursor = 0;
    this._running = true;
  }

  pause(): void {
    this._running = false;
  }

  stepIntervalMs(ms: number): void {
    this._stepIntervalMs = Math.max(1, Math.floor(ms));
  }

  status(): { total: number; cursor: number; remaining: number; running: boolean; stepIntervalMs: number } {
    return {
      total: this._steps.length,
      cursor: this._cursor,
      remaining: this._steps.length - this._cursor,
      running: this._running,
      stepIntervalMs: this._stepIntervalMs,
    };
  }
}

// V5646: ReplayCoordinator — orchestrates snapshotter + timeline + diff + stepReplay
export interface ReplaySession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  snapshotCount: number;
  eventsReplayed: number;
  diffsComputed: number;
}

export class ReplayCoordinator {
  private _sessions: Map<string, ReplaySession> = new Map();
  private _seq = 0;
  private _current: ReplaySession | null = null;

  start(): ReplaySession {
    this._seq += 1;
    const id = `replay_${this._seq}_${Date.now().toString(36)}`;
    const session: ReplaySession = {
      id,
      startedAt: Date.now(),
      endedAt: null,
      snapshotCount: 0,
      eventsReplayed: 0,
      diffsComputed: 0,
    };
    this._sessions.set(id, session);
    this._current = session;
    return session;
  }

  recordSnapshot(): void {
    if (this._current) this._current.snapshotCount += 1;
  }

  recordEvents(n: number): void {
    if (this._current) this._current.eventsReplayed += n;
  }

  recordDiff(): void {
    if (this._current) this._current.diffsComputed += 1;
  }

  end(): ReplaySession | undefined {
    if (!this._current) return undefined;
    this._current.endedAt = Date.now();
    const session = this._current;
    this._current = null;
    return session;
  }

  get(id: string): ReplaySession | undefined {
    return this._sessions.get(id);
  }

  list(): ReplaySession[] {
    return Array.from(this._sessions.values());
  }

  stats(): { total: number; current: string | null } {
    return {
      total: this._sessions.size,
      current: this._current?.id ?? null,
    };
  }
}

// V5647: PlaybackMasterIndex — batch 9/9 master index
export const PLAYBACK_ENGINES = [
  'MemorySnapshotter',
  'TimelineView',
  'TreeVisualizer',
  'DiffEngine',
  'StepReplay',
  'ReplayCoordinator',
  'PlaybackMasterIndex',
];

export class PlaybackMasterIndex {
  private _items: Array<{ name: string; layer: string; version: string }> = [];

  constructor() {
    for (const name of PLAYBACK_ENGINES) {
      this._items.push({ name, layer: 'playback', version: 'V5641+' });
    }
  }

  list(): Array<{ name: string; layer: string; version: string }> {
    return this._items.slice();
  }

  count(): number {
    return this._items.length;
  }

  byName(name: string): { name: string; layer: string; version: string } | undefined {
    return this._items.find((i) => i.name === name);
  }
}

// MCP tool descriptors (5 new tools)
export const PLAYBACK_TOOLS = [
  {
    name: 'MemorySnapshotter.capture',
    description: 'Capture a value-based snapshot of a memory store',
    inputSchema: { type: 'object', properties: { label: { type: 'string', description: 'Snapshot label' }, storeId: { type: 'string', description: 'Store identifier' } }, required: ['label', 'storeId'] },
  },
  {
    name: 'TimelineView.recent',
    description: 'Get the most recent N timeline entries',
    inputSchema: { type: 'object', properties: { n: { type: 'string', description: 'Number of recent entries to return (default 10)' } }, required: [] },
  },
  {
    name: 'StepReplay.start',
    description: 'Start a step replay cursor',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'StepReplay.next',
    description: 'Advance to next replay step',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'ReplayCoordinator.summary',
    description: 'Get the current replay coordinator summary',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
] as const;
