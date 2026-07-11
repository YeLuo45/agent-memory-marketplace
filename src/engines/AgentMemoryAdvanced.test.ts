// V5226-V5235: CV Agent Memory Advanced Batch 2/3 tests
import { describe, it, expect } from 'vitest';
import {
  LongTermMemoryManager,
  ShortTermMemory,
  WorkingMemory,
  AssociativeMemory,
  ContextWindow,
  AttentionMechanism,
  MemoryCompression,
  MemoryCache,
  MemoryProfiler,
  MemoryAdvancedIndex,
  CV_BATCH_2_ENGINES
} from './AgentMemoryAdvanced';

describe('LongTermMemoryManager + ShortTermMemory + WorkingMemory', () => {
  it('LongTermMemoryManager store + get + has + remove + size + age + list', async () => {
    const m = new LongTermMemoryManager();
    m.store('k1', 'content 1');
    expect(m.get('k1')).toBe('content 1');
    expect(m.has('k1')).toBe(true);
    expect(m.size()).toBe(1);
    expect(m.list()).toEqual(['k1']);
    await new Promise(r => setTimeout(r, 5));
    expect(m.age('k1')).toBeGreaterThan(0);
    expect(m.age('missing')).toBe(-1);
    expect(m.get('missing')).toBeNull();
    expect(m.remove('k1')).toBe(true);
  });

  it('ShortTermMemory push + recent + clear + size + capacity', () => {
    const s = new ShortTermMemory(2);
    s.push('a').push('b').push('c'); // 'a' evicted
    expect(s.size()).toBe(2);
    expect(s.recent()).toEqual(['b', 'c']);
    expect(s.capacity()).toBe(2);
    s.clear();
    expect(s.size()).toBe(0);
  });

  it('WorkingMemory focus + get + decay + focusedIds + size', () => {
    const w = new WorkingMemory();
    w.focus('a', 'content', 0.8).focus('b', 'content', 0.3);
    expect(w.get('a')?.attention).toBe(0.8);
    w.decay(0.5); // 0.8*0.5=0.4, 0.3*0.5=0.15
    expect(w.get('a')?.attention).toBeCloseTo(0.4);
    expect(w.get('b')?.attention).toBeCloseTo(0.15);
    expect(w.focusedIds(0.5)).toEqual([]);
    expect(w.focusedIds(0.2)).toContain('a');
    expect(w.size()).toBe(2);
  });
});

describe('AssociativeMemory + ContextWindow + AttentionMechanism', () => {
  it('AssociativeMemory link + unlink + neighbors + reachable + linkCount', () => {
    const a = new AssociativeMemory();
    a.link('a', 'b').link('a', 'c').link('b', 'd');
    expect(a.neighbors('a').sort()).toEqual(['b', 'c']);
    expect(a.neighbors('missing')).toEqual([]);
    expect(a.linkCount()).toBe(3);
    expect(a.reachable('a', 1)).toEqual(['b', 'c']);
    expect(a.reachable('a', 2)).toContain('d');
    a.unlink('a', 'b');
    expect(a.neighbors('a')).toEqual(['c']);
  });

  it('ContextWindow add + contents + clear + size + isFull + remaining', () => {
    const w = new ContextWindow(3);
    w.add('a').add('b').add('c').add('d'); // 'a' evicted
    expect(w.contents()).toEqual(['b', 'c', 'd']);
    expect(w.size()).toBe(3);
    expect(w.isFull()).toBe(true);
    expect(w.remaining()).toBe(0);
    w.clear();
    expect(w.size()).toBe(0);
    expect(w.remaining()).toBe(3);
  });

  it('AttentionMechanism attend + topK', () => {
    const a = new AttentionMechanism();
    const weights = a.attend([1, 0], [[1, 0], [0, 1]]);
    expect(weights).toHaveLength(2);
    expect(weights[0]).toBeGreaterThan(weights[1]); // query [1,0] matches [1,0] better
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(a.attend([], [])).toEqual([]);
    expect(a.topK([0.1, 0.5, 0.3, 0.1], 2)).toEqual([1, 2]);
  });
});

describe('MemoryCompression + MemoryCache + MemoryProfiler', () => {
  it('MemoryCompression compress + ratio + truncate', () => {
    const c = new MemoryCompression();
    expect(c.compress(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    expect(c.ratio([], [])).toBe(0);
    expect(c.ratio(['a', 'b', 'c'], ['a'])).toBeCloseTo(1 / 3);
    expect(c.truncate(['hello world'], 5)).toEqual(['hello']);
  });

  it('MemoryCache get + set + has + invalidate + size', () => {
    const c = new MemoryCache(2);
    c.set('a', 1).set('b', 2).set('c', 3); // 'a' evicted
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
    expect(c.size()).toBe(2);
    expect(c.invalidate('b')).toBe(true);
    expect(c.invalidate('missing')).toBe(false);
  });

  it('MemoryProfiler record + averageDuration + totalBytes + operations + reset', () => {
    const p = new MemoryProfiler();
    p.record('store', 10, 100).record('store', 20, 200).record('get', 5, 0);
    expect(p.averageDuration('store')).toBe(15);
    expect(p.totalBytes('store')).toBe(300);
    expect(p.totalBytes('get')).toBe(0);
    expect(p.operations().sort()).toEqual(['get', 'store']);
    p.reset();
    expect(p.operations()).toEqual([]);
  });
});

describe('MemoryAdvancedIndex', () => {
  it('list has 10', () => {
    expect(new MemoryAdvancedIndex().list()).toHaveLength(10);
  });

  it('count + engines + has', () => {
    const idx = new MemoryAdvancedIndex();
    expect(idx.count()).toBe(10);
    expect(idx.engines()).toEqual(idx.list());
    expect(idx.has('LongTermMemoryManager')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
  });

  it('CV_BATCH_2_ENGINES const has 10', () => {
    expect(CV_BATCH_2_ENGINES).toHaveLength(10);
  });
});