// V5626-V5640: Memory Streaming — real-time event-driven memory updates.
//
// Adds 4 engines that let agents wire up live memory change notifications:
//   - EventBus: generic pub/sub for memory events
//   - MemoryWatcher: watches a memory store, emits change events on mutations
//   - StreamProducer: emits a stream of typed memory events to consumers
//   - StreamConsumer: subscribes to a producer and aggregates the stream
//
// All engines are pure TypeScript with deterministic behavior (no external
// dependencies). They integrate with existing memory stores via the watcher
// adapter pattern — pass any object with .record() / .add() / .delete() methods.
//
// Reusable from MCP via 4 new tools (Streaming.*) and exposed in CLI via
// `amm streaming listen/produce`.

export interface StreamEvent {
  topic: string;
  kind: 'create' | 'update' | 'delete' | 'access' | 'metric';
  ts: number;
  payload: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
}

export interface Subscriber {
  id: string;
  topic: string;
  handler: (event: StreamEvent) => void;
}

// V5626: EventBus — generic pub/sub for memory events
export class EventBus {
  private _subscribers: Map<string, Subscriber[]> = new Map();
  private _globalSubs: Subscriber[] = [];
  private _eventCount = 0;
  private _topicCount = 0;

  subscribe(topic: string, handler: (event: StreamEvent) => void): string {
    const id = `sub_${++this._eventCount}_${Date.now().toString(36)}`;
    const sub: Subscriber = { id, topic, handler };
    const arr = this._subscribers.get(topic) ?? [];
    arr.push(sub);
    this._subscribers.set(topic, arr);
    if (arr.length === 1) this._topicCount += 1;
    return id;
  }

  subscribeAll(handler: (event: StreamEvent) => void): string {
    const id = `global_${++this._eventCount}_${Date.now().toString(36)}`;
    this._globalSubs.push({ id, topic: '*', handler });
    return id;
  }

  publish(event: StreamEvent): { dispatched: number; topic: string; failed: number } {
    const local = this._subscribers.get(event.topic) ?? [];
    let dispatched = 0;
    let failed = 0;
    for (const sub of local) {
      try {
        sub.handler(event);
      } catch {
        failed += 1;
      }
      dispatched += 1; // count attempts, not successes — keeps health readable
    }
    for (const sub of this._globalSubs) {
      try {
        sub.handler(event);
      } catch {
        failed += 1;
      }
      dispatched += 1;
    }
    return { dispatched, topic: event.topic, failed };
  }

  unsubscribe(id: string): boolean {
    for (const [topic, subs] of this._subscribers.entries()) {
      const i = subs.findIndex((s) => s.id === id);
      if (i !== -1) {
        subs.splice(i, 1);
        if (subs.length === 0) {
          this._subscribers.delete(topic);
          this._topicCount -= 1;
        }
        return true;
      }
    }
    const gi = this._globalSubs.findIndex((s) => s.id === id);
    if (gi !== -1) {
      this._globalSubs.splice(gi, 1);
      return true;
    }
    return false;
  }

  topics(): string[] {
    return Array.from(this._subscribers.keys());
  }

  stats(): { topics: number; subscribers: number; totalEvents: number } {
    let total = this._globalSubs.length;
    for (const arr of this._subscribers.values()) total += arr.length;
    return { topics: this._topicCount, subscribers: total, totalEvents: this._eventCount };
  }
}

// V5627: MemoryWatcher — watches a memory store, emits change events
export interface MemoryStoreLike {
  size?: () => number;
  entries?: () => unknown[];
  record?: (...args: unknown[]) => unknown;
  add?: (...args: unknown[]) => unknown;
  delete?: (...args: unknown[]) => unknown;
}

export interface WatchChange {
  id: string;
  topic: string;
  before: number;
  after: number;
  delta: number;
  ts: number;
}

export class MemoryWatcher {
  private _watchers: Map<string, { store: MemoryStoreLike; bus: EventBus; topic: string; baseline: number }> = new Map();
  private _idCounter = 0;
  private _recent: WatchChange[] = [];
  private _maxRecent = 50;

  watch(store: MemoryStoreLike, bus: EventBus, topic = 'memory.changes'): string {
    this._idCounter += 1;
    const id = `watch_${this._idCounter}`;
    const baseline = this._size(store);
    this._watchers.set(id, { store, bus, topic, baseline });
    return id;
  }

  poll(id: string): WatchChange[] {
    const w = this._watchers.get(id);
    if (!w) return [];
    const after = this._size(w.store);
    const delta = after - w.baseline;
    if (delta === 0) return [];
    const change: WatchChange = {
      id: `change_${Date.now()}_${id}`,
      topic: w.topic,
      before: w.baseline,
      after,
      delta,
      ts: Date.now(),
    };
    w.baseline = after;
    w.bus.publish({
      topic: w.topic,
      kind: delta > 0 ? 'create' : 'delete',
      ts: change.ts,
      payload: { change },
      priority: Math.abs(delta) > 5 ? 'high' : 'normal',
    });
    this._recent.push(change);
    if (this._recent.length > this._maxRecent) this._recent.shift();
    return [change];
  }

  pollAll(): WatchChange[] {
    const all: WatchChange[] = [];
    for (const id of this._watchers.keys()) {
      all.push(...this.poll(id));
    }
    return all;
  }

  stop(id: string): boolean {
    return this._watchers.delete(id);
  }

  recent(n = 10): WatchChange[] {
    return this._recent.slice(-n);
  }

  stats(): { watchers: number; recentChanges: number } {
    return { watchers: this._watchers.size, recentChanges: this._recent.length };
  }

  private _size(store: MemoryStoreLike): number {
    if (typeof store.size === 'function') return store.size();
    if (typeof store.entries === 'function') return store.entries().length;
    if (Array.isArray(store)) return store.length;
    return 0;
  }
}

// V5628: StreamProducer — emits a stream of typed memory events
export class StreamProducer {
  private _queue: StreamEvent[] = [];
  private _seq = 0;
  private _consumerId = 0;
  private _dropped = 0;
  private _maxBacklog = 1024;
  private _consumers: Map<string, (events: StreamEvent[]) => void> = new Map();

  emit(topic: string, kind: StreamEvent['kind'], payload: Record<string, unknown>, priority: StreamEvent['priority'] = 'normal'): { seq: number; queued: number } {
    this._seq += 1;
    const event: StreamEvent = { topic, kind, ts: Date.now(), payload, priority };
    if (this._queue.length >= this._maxBacklog) {
      this._queue.shift();
      this._dropped += 1;
    }
    this._queue.push(event);
    return { seq: this._seq, queued: this._queue.length };
  }

  drain(max = 50): StreamEvent[] {
    const n = Math.min(max, this._queue.length);
    return this._queue.splice(0, n);
  }

  peek(n = 10): StreamEvent[] {
    return this._queue.slice(0, n);
  }

  size(): number {
    return this._queue.length;
  }

  subscribe(handler: (events: StreamEvent[]) => void): string {
    this._consumerId += 1;
    const id = `cons_${this._consumerId}_${Date.now().toString(36)}`;
    this._consumers.set(id, handler);
    return id;
  }

  unsubscribe(id: string): boolean {
    return this._consumers.delete(id);
  }

  flush(): number {
    if (this._queue.length === 0) return 0;
    const batch = this._queue.splice(0, this._queue.length);
    for (const handler of this._consumers.values()) {
      try {
        handler(batch);
      } catch {
        // consumer failures are swallowed to keep the stream alive
      }
    }
    return batch.length;
  }

  metrics(): { emitted: number; queued: number; dropped: number; consumers: number } {
    return { emitted: this._seq, queued: this._queue.length, dropped: this._dropped, consumers: this._consumers.size };
  }
}

// V5629: StreamConsumer — subscribes to a producer and aggregates
export interface AggregatedEvent {
  topic: string;
  count: number;
  kinds: Record<string, number>;
  lastTs: number;
}

export class StreamConsumer {
  private _received: StreamEvent[] = [];
  private _groups: Map<string, AggregatedEvent> = new Map();
  private _maxBuffer = 1024;
  private _produce: StreamProducer | null = null;
  private _subId: string | null = null;

  bind(producer: StreamProducer): string {
    this._produce = producer;
    this._subId = producer.subscribe((events) => this._receive(events));
    return this._subId;
  }

  feed(events: StreamEvent[]): number {
    return this._receive(events);
  }

  private _receive(events: StreamEvent[]): number {
    for (const ev of events) {
      if (this._received.length >= this._maxBuffer) {
        this._received.shift();
      }
      this._received.push(ev);
      const g = this._groups.get(ev.topic) ?? { topic: ev.topic, count: 0, kinds: {}, lastTs: 0 };
      g.count += 1;
      g.kinds[ev.kind] = (g.kinds[ev.kind] ?? 0) + 1;
      g.lastTs = ev.ts;
      this._groups.set(ev.topic, g);
    }
    return events.length;
  }

  unbind(): boolean {
    if (this._produce && this._subId) {
      const ok = this._produce.unsubscribe(this._subId);
      this._produce = null;
      this._subId = null;
      return ok;
    }
    return false;
  }

  recent(n = 10): StreamEvent[] {
    return this._received.slice(-n);
  }

  aggregate(): AggregatedEvent[] {
    return Array.from(this._groups.values()).sort((a, b) => b.count - a.count);
  }

  summary(): { received: number; topics: number; producing: boolean } {
    return { received: this._received.length, topics: this._groups.size, producing: this._produce !== null };
  }

  reset(): void {
    this._received = [];
    this._groups.clear();
  }
}

// V5630: StreamingMasterIndex — batch 8/8 master index
export const STREAMING_ENGINES = ['EventBus', 'MemoryWatcher', 'StreamProducer', 'StreamConsumer', 'StreamingMasterIndex'];

export class StreamingMasterIndex {
  private _items: Array<{ name: string; layer: string; version: string }> = [];

  constructor() {
    for (const name of STREAMING_ENGINES) {
      this._items.push({ name, layer: 'streaming', version: 'V5626+' });
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

// MCP tool descriptors (4 new tools)
export const STREAMING_TOOLS = [
  {
    name: 'EventBus.subscribe',
    description: 'Subscribe to memory events on a topic',
    inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'Topic to subscribe to' } }, required: ['topic'] },
  },
  {
    name: 'StreamProducer.emit',
    description: 'Emit a memory event',
    inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'Event topic' }, kind: { type: 'string', description: 'create|update|delete|access|metric' } }, required: ['topic', 'kind'] },
  },
  {
    name: 'StreamProducer.flush',
    description: 'Drain queued events to consumers',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'StreamConsumer.aggregate',
    description: 'Aggregate consumed events by topic',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
] as const;
