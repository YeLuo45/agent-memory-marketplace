// V5641-V5655: Memory Playback UI tests.

import { describe, it, expect } from 'vitest';
import {
  MemorySnapshotter,
  TimelineView,
  TreeVisualizer,
  DiffEngine,
  StepReplay,
  ReplayCoordinator,
  PlaybackMasterIndex,
  PLAYBACK_ENGINES,
  PLAYBACK_TOOLS,
  type TreeNode,
} from './PlaybackCore';
import type { StreamEvent } from '../streaming/StreamingCore';

const events = (topic: string, kind: string, payload: Record<string, unknown>, n = 1): StreamEvent[] => {
  const out: StreamEvent[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ topic, kind: kind as StreamEvent['kind'], ts: Date.now() + i, payload });
  }
  return out;
};

describe('MemorySnapshotter', () => {
  it('capture returns a snapshot with entries cloned by value', () => {
    const s = new MemorySnapshotter();
    const entries = [{ key: 'a', value: { x: 1 } }, { key: 'b', value: { y: 2 } }];
    const snap = s.capture('snap1', 'episodic', entries);
    expect(snap.size).toBe(2);
    expect(snap.entries[0].value).toEqual({ x: 1 });
    // Ensure deep clone
    entries[0].value = { x: 99 };
    expect(snap.entries[0].value).toEqual({ x: 1 });
  });

  it('list filters by storeId and labelContains', () => {
    const s = new MemorySnapshotter();
    s.capture('first', 'episodic', []);
    s.capture('second', 'semantic', []);
    const all = s.list();
    expect(all.length).toBe(2);
    expect(s.list({ storeId: 'episodic' }).length).toBe(1);
    expect(s.list({ labelContains: 'sec' }).length).toBe(1);
  });

  it('drop removes a snapshot by id', () => {
    const s = new MemorySnapshotter();
    const snap = s.capture('to-drop', 'x', []);
    expect(s.drop(snap.id)).toBe(true);
    expect(s.drop(snap.id)).toBe(false);
  });

  it('get returns undefined for unknown id', () => {
    const s = new MemorySnapshotter();
    expect(s.get('unknown')).toBeUndefined();
  });

  it('stats reports total + retained', () => {
    const s = new MemorySnapshotter();
    s.capture('a', 'x', []);
    s.capture('b', 'x', []);
    const st = s.stats();
    expect(st.total).toBe(2);
    expect(st.retained).toBe(2);
  });
});

describe('TimelineView', () => {
  it('record adds events that pass filters', () => {
    const v = new TimelineView();
    v.filter({ topic: 'memory.create' });
    expect(v.record(events('memory.create', 'create', {}))).toBe(1);
    expect(v.record(events('memory.update', 'update', {}))).toBe(0);
  });

  it('list returns all events sorted by seq', () => {
    const v = new TimelineView();
    v.record(events('a', 'create', { n: 1 }));
    v.record(events('a', 'update', { n: 2 }));
    expect(v.count()).toBe(2);
    expect(v.list()[0].payload).toEqual({ n: 1 });
  });

  it('recent returns last N entries', () => {
    const v = new TimelineView();
    for (let i = 0; i < 5; i += 1) v.record(events('a', 'create', { i }));
    expect(v.recent(2).length).toBe(2);
  });

  it('byTimeRange filters by ts bounds', () => {
    const v = new TimelineView();
    v.record([{ topic: 'a', kind: 'create', ts: 100, payload: {} }]);
    v.record([{ topic: 'a', kind: 'update', ts: 200, payload: {} }]);
    v.record([{ topic: 'a', kind: 'delete', ts: 300, payload: {} }]);
    expect(v.byTimeRange(150, 250).length).toBe(1);
  });

  it('reset clears all entries', () => {
    const v = new TimelineView();
    v.record(events('a', 'create', {}));
    v.reset();
    expect(v.count()).toBe(0);
  });

  it('resetFilters un-filters future events', () => {
    const v = new TimelineView();
    v.filter({ kind: 'create' });
    v.record(events('a', 'update', {}));
    expect(v.count()).toBe(0);
    v.resetFilters();
    v.record(events('a', 'update', {}));
    expect(v.count()).toBe(1);
  });
});

describe('TreeVisualizer', () => {
  it('buildTree creates a root with children', () => {
    const tv = new TreeVisualizer();
    const leaves: TreeNode[] = [
      { id: 'l1', label: 'leaf1', children: [], weight: 1 },
      { id: 'l2', label: 'leaf2', children: [], weight: 2 },
    ];
    const root = tv.buildTree('root', 'Memory', leaves);
    expect(root.id).toBe('root');
    expect(tv.size()).toBe(1);
  });

  it('addChild appends to a node if found', () => {
    const tv = new TreeVisualizer();
    tv.buildTree('root', 'root', []);
    expect(tv.addChild('root', { id: 'c1', label: 'child', children: [], weight: 1 })).toBe(true);
    expect(tv.addChild('unknown', { id: 'c2', label: 'orphan', children: [] })).toBe(false);
  });

  it('flatten returns all nodes depth-first', () => {
    const tv = new TreeVisualizer();
    tv.buildTree('root', 'R', [
      { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', children: [] }] },
      { id: 'b', label: 'B', children: [] },
    ]);
    const flat = tv.flatten();
    expect(flat.length).toBeGreaterThanOrEqual(4);
    expect(flat[0].depth).toBe(0);
  });

  it('listRoots returns all roots', () => {
    const tv = new TreeVisualizer();
    tv.buildTree('r1', 'R1', []);
    tv.buildTree('r2', 'R2', []);
    expect(tv.listRoots().length).toBe(2);
  });

  it('weight sums the children weights', () => {
    const tv = new TreeVisualizer();
    const r = tv.buildTree('r', 'R', [
      { id: 'c1', label: 'C1', children: [], weight: 3 },
      { id: 'c2', label: 'C2', children: [], weight: 7 },
    ]);
    expect(r.weight).toBe(10);
  });

  it('get returns undefined for unknown id', () => {
    const tv = new TreeVisualizer();
    expect(tv.get('nope')).toBeUndefined();
  });
});

describe('DiffEngine', () => {
  it('diff identifies added/removed/modified/unchanged', () => {
    const d = new DiffEngine();
    const a = {
      id: 'a', label: 'l', takenAt: 0, storeId: 's', size: 2,
      entries: [
        { key: 'k1', value: { v: 1 } },
        { key: 'k2', value: { v: 2 } },
      ],
    };
    const b = {
      id: 'b', label: 'l', takenAt: 0, storeId: 's', size: 2,
      entries: [
        { key: 'k1', value: { v: 1 } }, // unchanged
        { key: 'k2', value: { v: 99 } }, // modified
        { key: 'k3', value: { v: 3 } }, // added
      ],
    };
    const diff = d.diff(a, b);
    expect(diff.unchanged).toBe(1);
    expect(diff.modified.length).toBe(1);
    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(0);
  });

  it('summarize returns counts', () => {
    const d = new DiffEngine();
    const sum = d.summarize({ added: [{} as never], removed: [], modified: [], unchanged: 5 });
    expect(sum.additions).toBe(1);
    expect(sum.unchanged).toBe(5);
  });

  it('diff returns removed entries that exist only in a', () => {
    const d = new DiffEngine();
    const a = { id: 'a', label: 'l', takenAt: 0, storeId: 's', size: 1, entries: [{ key: 'k1', value: { v: 1 } }] };
    const b = { id: 'b', label: 'l', takenAt: 0, storeId: 's', size: 0, entries: [] };
    const diff = d.diff(a, b);
    expect(diff.removed.length).toBe(1);
  });

  it('eventsDiff compares two event arrays', () => {
    const d = new DiffEngine();
    const e1 = [{ seq: 1, ts: 0, topic: 'a', kind: 'create', payload: { v: 1 } }];
    const e2 = [{ seq: 2, ts: 0, topic: 'a', kind: 'create', payload: { v: 2 } }];
    const diff = d.eventsDiff(e1, e2);
    expect(diff.removed.length).toBe(1);
    expect(diff.added.length).toBe(1);
  });
});

describe('StepReplay', () => {
  it('append returns a step with incrementing seq', () => {
    const r = new StepReplay();
    const s1 = r.append('event', { a: 1 });
    const s2 = r.append('event', { a: 2 });
    expect(s2.seq).toBe(s1.seq + 1);
  });

  it('fromEvents appends all events as steps', () => {
    const r = new StepReplay();
    const n = r.fromEvents([
      { seq: 1, ts: 0, topic: 'a', kind: 'create', payload: {} },
      { seq: 2, ts: 1, topic: 'a', kind: 'update', payload: {} },
    ]);
    expect(n).toBe(2);
    expect(r.status().total).toBe(2);
  });

  it('next advances cursor and returns next step', () => {
    const r = new StepReplay();
    r.append('event', { x: 1 });
    r.append('event', { x: 2 });
    const first = r.next();
    expect(first?.data).toEqual({ x: 1 });
    expect(r.next()?.data).toEqual({ x: 2 });
    expect(r.next()).toBeUndefined();
  });

  it('jumpTo moves cursor to specific step', () => {
    const r = new StepReplay();
    r.append('event', { x: 1 });
    r.append('event', { x: 2 });
    r.append('event', { x: 3 });
    const s2 = r.jumpTo(2);
    expect(s2?.data).toEqual({ x: 2 });
    expect(r.next()?.data).toEqual({ x: 3 });
  });

  it('start resets cursor to 0 and sets running', () => {
    const r = new StepReplay();
    r.append('event', {});
    r.next();
    r.start();
    expect(r.status().cursor).toBe(0);
    expect(r.status().running).toBe(true);
  });

  it('pause sets running to false', () => {
    const r = new StepReplay();
    r.start();
    r.pause();
    expect(r.status().running).toBe(false);
  });

  it('stepIntervalMs clamps minimum to 1', () => {
    const r = new StepReplay();
    r.stepIntervalMs(0);
    expect(r.status().stepIntervalMs).toBe(1);
  });

  it('reset clears all steps and cursor', () => {
    const r = new StepReplay();
    r.append('event', {});
    r.append('event', {});
    r.next();
    r.reset();
    expect(r.status().total).toBe(0);
    expect(r.status().cursor).toBe(0);
  });
});

describe('ReplayCoordinator', () => {
  it('start creates a session', () => {
    const c = new ReplayCoordinator();
    const s = c.start();
    expect(s.id).toMatch(/^replay_/);
  });

  it('record methods increment counters', () => {
    const c = new ReplayCoordinator();
    c.start();
    c.recordSnapshot();
    c.recordSnapshot();
    c.recordEvents(5);
    c.recordDiff();
    const cur = c.stats();
    expect(cur.current).not.toBeNull();
    const sess = c.end();
    expect(sess?.snapshotCount).toBe(2);
    expect(sess?.eventsReplayed).toBe(5);
    expect(sess?.diffsComputed).toBe(1);
    expect(sess?.endedAt).not.toBeNull();
  });

  it('get returns the session by id', () => {
    const c = new ReplayCoordinator();
    const s = c.start();
    const fetched = c.get(s.id);
    expect(fetched?.id).toBe(s.id);
  });

  it('end returns undefined when no current session', () => {
    const c = new ReplayCoordinator();
    expect(c.end()).toBeUndefined();
  });

  it('list returns all sessions', () => {
    const c = new ReplayCoordinator();
    c.start();
    c.end();
    c.start();
    c.end();
    expect(c.list().length).toBe(2);
  });

  it('stats shows total session count + current id', () => {
    const c = new ReplayCoordinator();
    c.start();
    const s = c.stats();
    expect(s.total).toBe(1);
    expect(s.current).not.toBeNull();
    c.end();
    expect(c.stats().current).toBeNull();
  });
});

describe('PlaybackMasterIndex', () => {
  it('lists 7 playback engines', () => {
    const idx = new PlaybackMasterIndex();
    expect(idx.count()).toBe(7);
  });

  it('byName finds an engine', () => {
    const idx = new PlaybackMasterIndex();
    expect(idx.byName('TimelineView')?.layer).toBe('playback');
  });

  it('PLAYBACK_ENGINES constant has 7 entries', () => {
    expect(PLAYBACK_ENGINES.length).toBe(7);
  });

  it('PLAYBACK_TOOLS exports 5 MCP tool descriptors', () => {
    expect(PLAYBACK_TOOLS.length).toBe(5);
  });
});
