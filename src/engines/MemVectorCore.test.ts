// V5556-V5575: MemVector Core Batch tests
import { describe, it, expect } from 'vitest';
import {
  VectorEmbedder,
  CosineSim,
  DistanceMetric,
  VectorNormalizer,
  HNSWIndex,
  PQCompressor,
  HybridSearcher,
  VectorCache,
  TokenBag,
  VectorMigrator,
  MemVectorCoreIndex,
  MEMVECTOR_BATCH_1_ENGINES,
} from './MemVectorCore';

describe('VectorEmbedder + CosineSim + DistanceMetric', () => {
  it('VectorEmbedder embedText + embedTags + dim + project', () => {
    const e = new VectorEmbedder(64);
    const v = e.embedText('hello world');
    expect(v.dim).toBe(64);
    expect(v.values.length).toBe(64);
    expect(e.embedTags(['cat', 'mat']).values.length).toBe(64);
    expect(e.dim()).toBe(64);
    const low = e.embedText('hi');
    const proj = e.project(low.values, 32);
    expect(proj.length).toBe(32);
  });

  it('CosineSim similarity + distance + topK', () => {
    const c = new CosineSim();
    expect(c.similarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
    expect(c.similarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    expect(c.similarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    expect(c.similarity([], [1, 2])).toBe(0);
    expect(c.distance([0, 0], [3, 4])).toBeCloseTo(5, 5);
    const ix = c.topK([1, 0], [[1, 0], [0, 1], [0.5, 0.5], [0, 1]], 2);
    expect(ix[0]).toBe(0);
    expect(ix).toHaveLength(2);
  });

  it('DistanceMetric cosine + euclidean + dot', () => {
    expect(DistanceMetric.cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(DistanceMetric.euclidean([1, 0], [4, 3])).toBeCloseTo(Math.sqrt(9 + 9), 5); // sqrt(18) ≈ 4.24
    expect(DistanceMetric.dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe('VectorNormalizer + HNSWIndex + PQCompressor', () => {
  it('VectorNormalizer normalize + minMax + zScore', () => {
    const n = VectorNormalizer.normalize([3, 4]);
    expect(n[0]).toBeCloseTo(0.6, 5);
    expect(n[1]).toBeCloseTo(0.8, 5);
    const mm = VectorNormalizer.minMax([1, 2, 3, 4, 5]);
    expect(mm[0]).toBe(0);
    expect(mm[4]).toBe(1);
    const z = VectorNormalizer.zScore([1, 2, 3]);
    expect(z[1]).toBeCloseTo(0, 5);
    // Constant vector → zero after z-score
    expect(VectorNormalizer.zScore([5, 5, 5])).toEqual([0, 0, 0]);
  });

  it('HNSWIndex insert + query + remove + averageDegree', () => {
    const idx = new HNSWIndex(16, 3);
    idx.insert('a', [1, 0, 0]);
    idx.insert('b', [1, 0, 0.1]);
    idx.insert('c', [0, 1, 0]);
    expect(idx.size()).toBe(3);
    const q = idx.query([1, 0, 0], 2);
    expect(q.length).toBe(2);
    expect(q[0].score).toBeGreaterThan(q[1].score);
    expect(idx.remove('a')).toBe(true);
    expect(idx.has('a')).toBe(false);
    expect(idx.remove('a')).toBe(false);
    expect(idx.averageDegree()).toBeGreaterThanOrEqual(0);
  });

  it('PQCompressor compress + decompress + ratio + approxDistance', () => {
    const c = new PQCompressor(4);
    const v = new Array(8).fill(0).map((_, i) => i / 8);
    const codes = c.compress(v);
    expect(codes).toHaveLength(4);
    const back = c.decompress(codes, 8);
    expect(back).toHaveLength(8);
    expect(c.compressionRatio(8)).toBe(0.5);
    // k=4 sub_dim=2: 16-dim vector → 8 sub-dims → 4 codes
    const v16 = new Array(16).fill(0).map((_, i) => i / 16);
    expect(c.compress(v16)).toHaveLength(4);
    // non-multiple-of-k dim → return slice unchanged
    expect(c.compress([0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
    // approxDistance: same length → sum of abs; different length → Infinity
    expect(c.approxDistance([0, 0], [5, 10])).toBe(15);
    expect(c.approxDistance([0, 0, 0], [0, 0])).toBe(Infinity);
  });
});

describe('HybridSearcher + VectorCache + TokenBag + VectorMigrator', () => {
  it('HybridSearcher search + tuneAlpha', () => {
    const h = new HybridSearcher();
    const items = [
      { id: 'a', tags: ['python', 'ai'], vector: [1, 0, 0] },
      { id: 'b', tags: ['python'], vector: [1, 0, 0.1] },
      { id: 'c', tags: ['rust', 'cli'], vector: [0, 1, 0] },
      { id: 'd', tags: [], vector: [0.5, 0.5, 0] },
    ];
    const results = h.search('python', [1, 0, 0], items, { alpha: 0.5, limit: 3 });
    expect(results.length).toBe(3);
    expect(results[0].id).toMatch(/a|b/); // Either python-tag item
    expect(results[0].combined).toBeGreaterThan(0);

    const gt = new Set(['a', 'b']);
    const tunedAlpha = h.tuneAlpha('python', [1, 0, 0], items, gt);
    expect(tunedAlpha).toBeGreaterThanOrEqual(0);
    expect(tunedAlpha).toBeLessThanOrEqual(1);
  });

  it('VectorCache get + set + LRU + hitRate', () => {
    const c = new VectorCache(2);
    c.set('a', [1, 2]);
    c.set('b', [3, 4]);
    expect(c.get('a')).toEqual([1, 2]); // hit 1 — moves 'a' to end
    c.set('c', [5, 6]); // evicts oldest = 'b'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false); // 'b' evicted
    expect(c.has('c')).toBe(true);
    c.get('a'); // hit 2
    c.get('x'); // miss 1
    c.get('a'); // hit 3
    expect(c.hitRate()).toBeCloseTo(3 / 4); // 3 hits / 4 total
    expect(c.size()).toBe(2);
    expect(c.invalidate('a')).toBe(true);
    expect(c.invalidate('x')).toBe(false);
  });

  it('TokenBag fit + vectorize + tokenize + vocabSize', () => {
    const t = new TokenBag();
    t.fit(['the cat sat on the mat', 'the dog ran fast', 'python is great']);
    expect(t.vocabSize()).toBeGreaterThan(5);
    const v = t.vectorize('the cat ran fast');
    expect(v.values.length).toBeGreaterThan(0);
    expect(TokenBag.tokenize('Cat  DOG, Cat!')).toEqual(['cat', 'dog', 'cat']);
  });

  it('VectorMigrator migrate across dims', () => {
    const m = new VectorMigrator();
    // Each call accepts single vector; pass an array with one 8-dim vector
    const result = m.migrate([[1, 2, 3, 4, 5, 6, 7, 8]], 8, 4);
    const v8 = result[0];
    expect(v8.every(x => typeof x === 'number')).toBe(true);
    expect(v8.length).toBe(4);
    // Same dim → returns slice
    expect(m.migrate([[1, 2, 3]], 3, 3)).toEqual([[1, 2, 3]]);
    // Random projection
    const proj = m.migrate([[1, 2, 3, 4]], 4, 8, 'random-projection');
    expect(proj[0]).toHaveLength(8);
    // Pad-truncate up
    const up = m.migrate([[1, 2]], 2, 5, 'pad-truncate');
    expect(up).toEqual([[1, 2, 0, 0, 0]]);
  });
});

describe('MemVectorCoreIndex', () => {
  it('list + count + has + const length', () => {
    const idx = new MemVectorCoreIndex();
    expect(idx.list().length).toBe(11);
    expect(idx.count()).toBe(11);
    expect(idx.has('VectorEmbedder')).toBe(true);
    expect(idx.has('HNSWIndex')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
    expect(MEMVECTOR_BATCH_1_ENGINES).toHaveLength(11);
  });
});
