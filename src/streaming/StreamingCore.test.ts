// V5626-V5640: Streaming core tests.

import { describe, it, expect } from 'vitest';
import {
  EventBus,
  MemoryWatcher,
  StreamProducer,
  StreamConsumer,
  StreamingMasterIndex,
  STREAMING_ENGINES,
  STREAMING_TOOLS,
  type StreamEvent,
} from './StreamingCore';

describe('EventBus', () => {
  it('publishes to topic subscribers and counts dispatches', () => {
    const bus = new EventBus();
    let n = 0;
    bus.subscribe('memory.create', () => (n += 1));
    bus.subscribe('memory.create', () => (n += 1));
    const { dispatched } = bus.publish({
      topic: 'memory.create',
      kind: 'create',
      ts: 1,
      payload: { id: 'a' },
    });
    expect(dispatched).toBe(2);
    expect(n).toBe(2);
  });

  it('returns zero dispatches when no subscribers', () => {
    const bus = new EventBus();
    const { dispatched } = bus.publish({ topic: 'orphan', kind: 'create', ts: 1, payload: {} });
    expect(dispatched).toBe(0);
  });

  it('subscribeAll receives every topic', () => {
    const bus = new EventBus();
    let count = 0;
    bus.subscribeAll(() => (count += 1));
    bus.publish({ topic: 'a', kind: 'create', ts: 1, payload: {} });
    bus.publish({ topic: 'b', kind: 'create', ts: 1, payload: {} });
    bus.publish({ topic: 'c', kind: 'create', ts: 1, payload: {} });
    expect(count).toBe(3);
  });

  it('unsubscribe by id removes only matching subscriber', () => {
    const bus = new EventBus();
    const id1 = bus.subscribe('t', () => undefined);
    bus.subscribe('t', () => undefined);
    expect(bus.unsubscribe(id1)).toBe(true);
    expect(bus.stats().subscribers).toBe(1);
  });

  it('swallows handler errors without breaking publish', () => {
    const bus = new EventBus();
    bus.subscribe('t', () => {
      throw new Error('boom');
    });
    bus.subscribe('t', () => undefined);
    const { dispatched } = bus.publish({ topic: 't', kind: 'create', ts: 1, payload: {} });
    // both subs were called (error swallowed)
    expect(dispatched).toBe(2);
  });

  it('stats counts topics and subscribers', () => {
    const bus = new EventBus();
    bus.subscribe('a', () => undefined);
    bus.subscribe('b', () => undefined);
    bus.subscribe('b', () => undefined);
    bus.subscribeAll(() => undefined);
    const s = bus.stats();
    expect(s.topics).toBe(2);
    expect(s.subscribers).toBe(4);
  });

  it('topics() lists subscribed topics', () => {
    const bus = new EventBus();
    bus.subscribe('x', () => undefined);
    bus.subscribe('y', () => undefined);
    const t = bus.topics().sort();
    expect(t).toEqual(['x', 'y']);
  });
});

describe('MemoryWatcher', () => {
  it('watch returns watcher id', () => {
    const bus = new EventBus();
    const store = { size: () => 0 };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    expect(id).toMatch(/^watch_/);
  });

  it('poll detects size increase and emits change', () => {
    const bus = new EventBus();
    let received = 0;
    bus.subscribe('memory.changes', () => (received += 1));
    let cur = 0;
    const store = { size: () => cur };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    cur = 5;
    const changes = w.poll(id);
    expect(changes.length).toBe(1);
    expect(changes[0].delta).toBe(5);
    expect(received).toBe(1);
  });

  it('poll returns empty when size unchanged', () => {
    const bus = new EventBus();
    const store = { size: () => 3 };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    expect(w.poll(id).length).toBe(0);
  });

  it('high priority on large deltas', () => {
    const bus = new EventBus();
    let captured: StreamEvent | null = null;
    bus.subscribe('memory.changes', (ev) => (captured = ev));
    let cur = 0;
    const store = { size: () => cur };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    cur = 10;
    w.poll(id);
    expect(captured?.priority).toBe('high');
  });

  it('stop returns true for known id, false for unknown', () => {
    const bus = new EventBus();
    const store = { size: () => 0 };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    expect(w.stop(id)).toBe(true);
    expect(w.stop('nonexistent')).toBe(false);
  });

  it('recent returns last N changes', () => {
    const bus = new EventBus();
    let cur = 0;
    const store = { size: () => cur };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    for (let i = 0; i < 5; i += 1) {
      cur += 1;
      w.poll(id);
    }
    const recent = w.recent(3);
    expect(recent.length).toBe(3);
  });

  it('works with array-typed stores via entries', () => {
    const bus = new EventBus();
    const arr: number[] = [];
    const store = { entries: () => arr };
    const w = new MemoryWatcher();
    const id = w.watch(store, bus);
    arr.push(1, 2, 3);
    const changes = w.poll(id);
    expect(changes[0].delta).toBe(3);
  });
});

describe('StreamProducer', () => {
  it('emit returns incremented seq', () => {
    const p = new StreamProducer();
    const r1 = p.emit('t', 'create', { a: 1 });
    const r2 = p.emit('t', 'update', { a: 2 });
    expect(r2.seq).toBe(r1.seq + 1);
  });

  it('drain removes events from queue', () => {
    const p = new StreamProducer();
    p.emit('a', 'create', {});
    p.emit('b', 'create', {});
    const drained = p.drain(10);
    expect(drained.length).toBe(2);
    expect(p.size()).toBe(0);
  });

  it('drain with cap returns at most max events', () => {
    const p = new StreamProducer();
    for (let i = 0; i < 5; i += 1) p.emit('t', 'create', { i });
    expect(p.drain(3).length).toBe(3);
    expect(p.size()).toBe(2);
  });

  it('drops oldest when backlog exceeds maxBacklog', () => {
    const p = new StreamProducer();
    // Backlog default is 1024; emit 1100 to overflow. Just verify metrics behave.
    for (let i = 0; i < 1025; i += 1) p.emit('t', 'create', { i });
    const m = p.metrics();
    expect(m.dropped).toBeGreaterThan(0);
    expect(m.queued).toBeLessThanOrEqual(1024);
  });

  it('subscribe + flush dispatches batch to all consumers', () => {
    const p = new StreamProducer();
    let received = 0;
    p.subscribe(() => (received += 1));
    p.emit('a', 'create', {});
    p.emit('b', 'create', {});
    const flushed = p.flush();
    expect(flushed).toBe(2);
    expect(received).toBe(1);
  });

  it('flush with empty queue returns 0', () => {
    const p = new StreamProducer();
    expect(p.flush()).toBe(0);
  });

  it('unsubscribe removes consumer handler', () => {
    const p = new StreamProducer();
    const id = p.subscribe(() => undefined);
    expect(p.unsubscribe(id)).toBe(true);
    expect(p.unsubscribe('unknown')).toBe(false);
  });

  it('metrics exposes emitted + queued + dropped + consumers', () => {
    const p = new StreamProducer();
    p.emit('t', 'create', {});
    p.subscribe(() => undefined);
    const m = p.metrics();
    expect(m.emitted).toBe(1);
    expect(m.queued).toBe(1);
    expect(m.consumers).toBe(1);
  });

  it('peek is non-destructive', () => {
    const p = new StreamProducer();
    p.emit('t', 'create', {});
    expect(p.peek(10).length).toBe(1);
    expect(p.size()).toBe(1);
  });
});

describe('StreamConsumer', () => {
  it('feed accumulates received events', () => {
    const c = new StreamConsumer();
    c.feed([{ topic: 'a', kind: 'create', ts: 1, payload: {} }]);
    c.feed([{ topic: 'a', kind: 'update', ts: 2, payload: {} }]);
    const s = c.summary();
    expect(s.received).toBe(2);
    expect(s.topics).toBe(1);
  });

  it('aggregate groups by topic with kind counts', () => {
    const c = new StreamConsumer();
    c.feed([
      { topic: 'a', kind: 'create', ts: 1, payload: {} },
      { topic: 'a', kind: 'update', ts: 2, payload: {} },
      { topic: 'b', kind: 'delete', ts: 3, payload: {} },
    ]);
    const agg = c.aggregate();
    const byTopic = Object.fromEntries(agg.map((g) => [g.topic, g]));
    expect(byTopic.a.count).toBe(2);
    expect(byTopic.a.kinds.create).toBe(1);
    expect(byTopic.a.kinds.update).toBe(1);
    expect(byTopic.b.count).toBe(1);
    expect(byTopic.b.kinds.delete).toBe(1);
  });

  it('aggregate sorted by count desc', () => {
    const c = new StreamConsumer();
    c.feed([
      { topic: 'a', kind: 'create', ts: 1, payload: {} },
      { topic: 'b', kind: 'create', ts: 1, payload: {} },
      { topic: 'b', kind: 'create', ts: 2, payload: {} },
    ]);
    const agg = c.aggregate();
    expect(agg[0].topic).toBe('b');
    expect(agg[1].topic).toBe('a');
  });

  it('bind subscribes to producer and unbind removes subscription', () => {
    const p = new StreamProducer();
    const c = new StreamConsumer();
    const id = c.bind(p);
    expect(id).toMatch(/^cons_/);
    expect(c.summary().producing).toBe(true);
    p.emit('t', 'create', {});
    p.flush();
    expect(c.summary().received).toBe(1);
    expect(c.unbind()).toBe(true);
    expect(c.summary().producing).toBe(false);
  });

  it('unbind on never-bound returns false', () => {
    const c = new StreamConsumer();
    expect(c.unbind()).toBe(false);
  });

  it('reset clears received and groups', () => {
    const c = new StreamConsumer();
    c.feed([{ topic: 'a', kind: 'create', ts: 1, payload: {} }]);
    c.reset();
    const s = c.summary();
    expect(s.received).toBe(0);
    expect(s.topics).toBe(0);
  });

  it('recent returns last N events', () => {
    const c = new StreamConsumer();
    const events: StreamEvent[] = [];
    for (let i = 0; i < 5; i += 1) events.push({ topic: 't', kind: 'create', ts: i, payload: { i } });
    c.feed(events);
    expect(c.recent(2).length).toBe(2);
  });
});

describe('StreamingMasterIndex', () => {
  it('lists 5 streaming engines', () => {
    const idx = new StreamingMasterIndex();
    expect(idx.count()).toBe(5);
  });

  it('list returns all engines including self', () => {
    const idx = new StreamingMasterIndex();
    const names = idx.list().map((i) => i.name).sort();
    expect(names).toContain('StreamingMasterIndex');
    expect(names).toContain('EventBus');
  });

  it('byName finds the engine metadata', () => {
    const idx = new StreamingMasterIndex();
    const item = idx.byName('EventBus');
    expect(item?.layer).toBe('streaming');
  });

  it('STREAMING_ENGINES constant lists 5 entries', () => {
    expect(STREAMING_ENGINES.length).toBe(5);
  });

  it('STREAMING_TOOLS exports 4 MCP tool descriptors', () => {
    expect(STREAMING_TOOLS.length).toBe(4);
  });
});
