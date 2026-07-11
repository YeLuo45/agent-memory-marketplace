// V5216-V5225: CV Agent Memory Long-term Core Batch 1/3 tests
import { describe, it, expect } from 'vitest';
import {
  EpisodicStore,
  SemanticIndex,
  ProceduralCache,
  ConsolidationEngine,
  ForgettingEngine,
  MemoryRetriever,
  MemoryEncoder,
  MemoryDecoder,
  MemoryHierarchy,
  MemoryCoreIndex,
  CV_BATCH_1_ENGINES
} from './AgentMemoryCore';

describe('EpisodicStore + SemanticIndex', () => {
  it('EpisodicStore record + get + recent + important + size', () => {
    const s = new EpisodicStore();
    const e1 = s.record('event 1', 0.5);
    const e2 = s.record('event 2', 0.9);
    expect(s.get(e1.id)?.content).toBe('event 1');
    expect(s.recent(2)).toHaveLength(2);
    expect(s.important(0.8).map(e => e.id)).toContain(e2.id);
    expect(s.size()).toBe(2);
    expect(s.get('missing')).toBeNull();
  });

  it('SemanticIndex add + get + findByTag + remove + size + tags', () => {
    const s = new SemanticIndex();
    s.add('m1', ['python', 'ai']).add('m2', ['python']);
    expect(s.get('m1')?.tags).toEqual(['python', 'ai']);
    expect(s.findByTag('python')).toEqual(['m1', 'm2']);
    expect(s.findByTag('missing')).toEqual([]);
    expect(s.remove('m1')).toBe(true);
    expect(s.size()).toBe(1);
    expect(s.tags('m2')).toEqual(['python']);
    expect(s.tags('missing')).toEqual([]);
  });
});

describe('ProceduralCache + ConsolidationEngine + ForgettingEngine', () => {
  it('ProceduralCache store + get + has + remove + size + lastUsed', async () => {
    const p = new ProceduralCache();
    p.store('proc1', ['step 1', 'step 2']);
    expect(p.get('proc1')).toEqual(['step 1', 'step 2']);
    expect(p.has('proc1')).toBe(true);
    await new Promise(r => setTimeout(r, 5));
    expect(p.lastUsed('proc1')).toBeGreaterThan(0);
    expect(p.lastUsed('missing')).toBe(0);
    expect(p.get('missing')).toBeNull();
    expect(p.remove('proc1')).toBe(true);
    expect(p.size()).toBe(0);
  });

  it('ConsolidationEngine consolidate + mergeable', () => {
    const c = new ConsolidationEngine();
    const items = [
      { id: 'a', content: 'cat sat on mat', timestamp: 1, importance: 0.5 },
      { id: 'b', content: 'cat sat on rug', timestamp: 2, importance: 0.6 },
      { id: 'c', content: 'dog ran fast', timestamp: 3, importance: 0.7 }
    ];
    const result = c.consolidate(items);
    expect(result.length).toBeLessThan(3); // a and b merge
    expect(c.mergeable(items)).toBe(true);
    expect(c.mergeable([])).toBe(false);
  });

  it('ForgettingEngine forgetByAge + forgetByImportance + relevance + shouldForget', async () => {
    const f = new ForgettingEngine();
    const items = [
      { id: 'old', content: 'x', timestamp: Date.now() - 1000, importance: 0.5 },
      { id: 'new', content: 'y', timestamp: Date.now(), importance: 0.5 }
    ];
    expect(f.forgetByAge(items, 500).map(i => i.id)).toEqual(['old']);
    // Both items have importance=0.5 < threshold 0.4 = no items qualify
    expect(f.forgetByImportance(items, 0.4)).toEqual([]);
    const low = items.concat([{ id: 'low', content: 'z', timestamp: Date.now(), importance: 0.2 }]);
    expect(f.forgetByImportance(low, 0.4).map(i => i.id)).toEqual(['low']);
    const old = { id: 'old', content: 'x', timestamp: Date.now() - 1_000_000, importance: 0.5 };
    expect(f.relevance(old, 100_000)).toBeLessThan(0.01);
    expect(f.shouldForget(old, 100_000, 0.001)).toBe(true);
  });
});

describe('MemoryRetriever + MemoryEncoder + MemoryDecoder + MemoryHierarchy', () => {
  it('MemoryRetriever score + retrieve', () => {
    const r = new MemoryRetriever();
    const items = [
      { id: 'a', content: 'cat sat', timestamp: Date.now() - 1000, importance: 0.8 },
      { id: 'b', content: 'dog ran', timestamp: Date.now(), importance: 0.3 }
    ];
    const result = r.retrieve(items, 'cat', 2);
    expect(result[0].id).toBe('a'); // cat match + high importance
    expect(result).toHaveLength(2);
  });

  it('MemoryEncoder encode + decode + encodedSize', () => {
    const e = new MemoryEncoder();
    const encoded = e.encode('hello world');
    expect(encoded.startsWith('mem:')).toBe(true);
    expect(e.decode('invalid')).toBe('invalid');
    expect(e.encodedSize('hi')).toBeGreaterThan(0);
  });

  it('MemoryDecoder reverse + split', () => {
    const d = new MemoryDecoder();
    // reverse strips first 'mem:' or any prefix
    expect(d.reverse('abc:hello world')).toBe('hello world');
    expect(d.split('a | b | c')).toEqual(['a', 'b', 'c']);
  });

  it('MemoryHierarchy classify + partition + isHot', () => {
    const h = new MemoryHierarchy();
    const now = Date.now();
    const hot = { id: 'h', content: 'x', timestamp: now, importance: 0.9 };
    const warm = { id: 'w', content: 'y', timestamp: now - 100_000, importance: 0.3 };
    const cold = { id: 'c', content: 'z', timestamp: now - 1_000_000, importance: 0.1 };
    expect(h.classify(hot, now)).toBe('hot');
    expect(h.classify(warm, now)).toBe('warm');
    expect(h.classify(cold, now)).toBe('cold');
    const part = h.partition([hot, warm, cold], now);
    expect(part.hot).toHaveLength(1);
    expect(h.isHot(hot, now)).toBe(true);
    expect(h.isHot(cold, now)).toBe(false);
  });
});

describe('MemoryCoreIndex', () => {
  it('list has 10', () => {
    expect(new MemoryCoreIndex().list()).toHaveLength(10);
  });

  it('count + engines + has', () => {
    const idx = new MemoryCoreIndex();
    expect(idx.count()).toBe(10);
    expect(idx.engines()).toEqual(idx.list());
    expect(idx.has('EpisodicStore')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
  });

  it('CV_BATCH_1_ENGINES const has 10', () => {
    expect(CV_BATCH_1_ENGINES).toHaveLength(10);
  });
});