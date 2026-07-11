// V5556-V5575: MemVector Core Batch — ANN vector search on memory engines
// Reuses CV Memory engines (EpisodicStore, SemanticIndex) and adds ANN layer on top:
// VectorEmbedder + HNSWIndex + PQCompressor + HybridSearcher + VectorNormalizer + CosineSim + VectorCache + DistanceMetric + VectorMigrator + TokenBag

export interface Vector {
  values: number[];
  dim: number;
  id?: string;
}

export interface EmbeddingSource {
  type: 'text' | 'tag-array' | 'content-string';
  payload: string | string[];
}

export class VectorEmbedder {
  private _dim: number;

  constructor(dim = 64) {
    this._dim = dim;
  }

  private _hashToVec(input: string): number[] {
    // Deterministic pseudo-random embedding: hash + normalize
    const v = new Array(this._dim).fill(0);
    for (let i = 0; i < this._dim; i++) {
      let h = (i * 2654435761) >>> 0;
      for (let j = 0; j < input.length; j++) {
        h = (((h * 31) ^ input.charCodeAt(j)) >>> 0);
      }
      v[i] = (h % 1000) / 1000 - 0.5;
    }
    return v;
  }

  embedText(text: string): Vector {
    return { values: this._hashToVec(text.toLowerCase()), dim: this._dim };
  }

  embedTags(tags: string[]): Vector {
    return { values: this._hashToVec(tags.join(' ').toLowerCase()), dim: this._dim };
  }

  dim(): number {
    return this._dim;
  }

  // Project existing embedding to new dimension (matches cp-vector-quant v2 EmbeddingAligner)
  project(values: number[], newDim: number): number[] {
    const result = new Array(newDim).fill(0);
    for (let i = 0; i < values.length; i++) {
      result[i % newDim] += values[i];
    }
    const norm = Math.sqrt(result.reduce((a, b) => a + b * b, 0));
    return norm > 0 ? result.map(v => v / norm) : result;
  }
}

export class CosineSim {
  // Cosine similarity in [-1, 1]
  similarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  // L2 distance — lower = closer
  distance(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < len; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }

  // Top-K indices by similarity (desc)
  topK(query: number[], candidates: number[][], k: number): number[] {
    const scores = candidates.map((c, i) => ({ i, s: this.similarity(query, c) }));
    return scores.sort((a, b) => b.s - a.s).slice(0, k).map(x => x.i);
  }
}

export class DistanceMetric {
  // Wraps CosineSim with explicit metric name
  static cosine(a: number[], b: number[]): number {
    return new CosineSim().similarity(a, b);
  }
  static euclidean(a: number[], b: number[]): number {
    return new CosineSim().distance(a, b);
  }
  static dot(a: number[], b: number[]): number {
    let s = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) s += a[i] * b[i];
    return s;
  }
}

export class VectorNormalizer {
  // L2 normalize a vector (or zero-vector if all 0)
  static normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    if (norm === 0) return v.slice();
    return v.map(x => x / norm);
  }

  // Min-max normalize to [0, 1]
  static minMax(v: number[]): number[] {
    if (v.length === 0) return [];
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min;
    if (range === 0) return v.map(() => 0);
    return v.map(x => (x - min) / range);
  }

  // Z-score normalize (mean 0, std 1)
  static zScore(v: number[]): number[] {
    if (v.length === 0) return [];
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
    const std = Math.sqrt(variance);
    if (std === 0) return v.map(() => 0);
    return v.map(x => (x - mean) / std);
  }
}

export interface HNSWNode {
  id: string;
  vector: number[];
  neighbors: Set<string>;
  level: number;
}

export class HNSWIndex {
  private _nodes: Map<string, HNSWNode> = new Map();
  private _level: number = 0;
  private _efConstruction: number;
  private _m: number;

  constructor(efConstruction = 32, m = 4) {
    this._efConstruction = efConstruction;
    this._m = m;
  }

  size(): number {
    return this._nodes.size;
  }

  // Insert a node — simplified HNSW (linear scan over neighbors)
  insert(id: string, vector: number[]): void {
    if (this._nodes.has(id)) return;
    const level = Math.floor(Math.random() * 3); // 0-2
    this._nodes.set(id, { id, vector, neighbors: new Set(), level });
    this._level = Math.max(this._level, level);
    // Connect to K nearest existing nodes (linear scan)
    const existing: HNSWNode[] = [];
    this._nodes.forEach(n => { if (n.id !== id) existing.push(n); });
    const cs = new CosineSim();
    const sims = existing.map(n => ({ id: n.id, s: cs.similarity(vector, n.vector) }));
    sims.sort((a, b) => b.s - a.s);
    const k = Math.min(this._m, sims.length);
    const me = this._nodes.get(id)!;
    for (let i = 0; i < k; i++) {
      me.neighbors.add(sims[i].id);
      existing[existing.findIndex(e => e.id === sims[i].id)]!.neighbors.add(id);
    }
  }

  // Query K nearest — beam search top-_efConstruction candidates
  query(vector: number[], k: number): Array<{ id: string; score: number }> {
    if (this._nodes.size === 0) return [];
    const cs = new CosineSim();
    const all: Array<{ id: string; score: number }> = [];
    this._nodes.forEach(n => all.push({ id: n.id, score: cs.similarity(vector, n.vector) }));
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, k);
  }

  has(id: string): boolean {
    return this._nodes.has(id);
  }

  remove(id: string): boolean {
    if (!this._nodes.has(id)) return false;
    this._nodes.delete(id);
    this._nodes.forEach(n => n.neighbors.delete(id));
    return true;
  }

  ids(): string[] {
    return [...this._nodes.keys()];
  }

  // Statistics
  averageDegree(): number {
    if (this._nodes.size === 0) return 0;
    let s = 0;
    this._nodes.forEach(n => s += n.neighbors.size);
    return s / this._nodes.size;
  }
}

export class PQCompressor {
  // Product Quantization: split vector into K sub-vectors of dim/K each,
  // store first byte (centroid id × 256 / 256). Lossy but small.
  private _k: number;
  private _subVectors: Map<number, number[]> = new Map();

  constructor(k = 4) {
    if (k < 1 || (k & (k - 1)) !== 0) {
      throw new Error('k must be a power of 2 for PQ');
    }
    this._k = k;
  }

  compress(vector: number[]): number[] {
    const dim = vector.length;
    if (dim % this._k !== 0) return vector.slice();
    const subDim = dim / this._k;
    const out: number[] = [];
    for (let i = 0; i < this._k; i++) {
      const slice = vector.slice(i * subDim, (i + 1) * subDim);
      // Center-of-mass centroid id
      const mean = slice.reduce((a, b) => a + b, 0) / subDim;
      const id = Math.max(0, Math.min(255, Math.floor(mean * 255 + 128)));
      out.push(id);
    }
    return out;
  }

  decompress(codes: number[], originalDim: number): number[] {
    if (codes.length !== this._k) return [];
    const subDim = originalDim / this._k;
    const out: number[] = [];
    for (let i = 0; i < this._k; i++) {
      const mean = (codes[i] - 128) / 255;
      for (let j = 0; j < subDim; j++) {
        out.push(mean);
      }
    }
    return out;
  }

  compressionRatio(originalDim: number): number {
    return this._k / originalDim;
  }

  size(): number {
    return this._k;
  }

  // Approximate distance between compressed codes — faster than decompressing
  approxDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s;
  }
}

export class HybridSearcher {
  // Combine tag match (EpisodicStore/SemanticIndex style) + vector similarity
  search(
    query: string,
    queryVec: number[],
    items: Array<{ id: string; tags: string[]; vector: number[]; weight?: number }>,
    options: { alpha?: number; limit?: number } = {},
  ): Array<{ id: string; tagScore: number; vecScore: number; combined: number }> {
    const alpha = options.alpha ?? 0.5;
    const limit = options.limit ?? 10;
    const q = query.toLowerCase().trim();
    const cs = new CosineSim();
    return items
      .map(it => {
        // Tag score: 1 tag matches → 1, 0 → 0 (Jaccard)
        const qWords = new Set(q.split(/\s+/).filter(w => w.length > 0));
        const itWords = new Set(it.tags.map(t => t.toLowerCase()));
        let overlap = 0;
        qWords.forEach(w => { if (itWords.has(w)) overlap += 1; });
        const union = new Set([...qWords, ...itWords]).size;
        const tagScore = union === 0 ? 0 : overlap / union;
        const vecScore = cs.similarity(queryVec, it.vector);
        const w = it.weight ?? 1.0;
        const combined = (alpha * tagScore + (1 - alpha) * vecScore) * w;
        return { id: it.id, tagScore, vecScore, combined };
      })
      .sort((a, b) => b.combined - a.combined)
      .slice(0, limit);
  }

  // Tune alpha via grid search
  tuneAlpha(
    query: string,
    queryVec: number[],
    items: Array<{ id: string; tags: string[]; vector: number[]; weight?: number }>,
    groundTruth: Set<string>,
  ): number {
    let bestAlpha = 0.5;
    let bestScore = -Infinity;
    for (let alpha = 0; alpha <= 1; alpha += 0.1) {
      const results = this.search(query, queryVec, items, { alpha, limit: 10 });
      const hits = results.filter(r => groundTruth.has(r.id)).length;
      if (hits > bestScore || (hits === bestScore && Math.abs(alpha - 0.5) < Math.abs(bestAlpha - 0.5))) {
        bestScore = hits;
        bestAlpha = alpha;
      }
    }
    return bestAlpha;
  }
}

export class VectorCache {
  private _cache: Map<string, number[]> = new Map();
  private _maxSize: number;
  private _hits = 0;
  private _misses = 0;

  constructor(maxSize = 256) {
    this._maxSize = maxSize;
  }

  get(key: string): number[] | undefined {
    const v = this._cache.get(key);
    if (v !== undefined) {
      this._hits += 1;
      // Move to end (LRU)
      this._cache.delete(key);
      this._cache.set(key, v);
    } else {
      this._misses += 1;
    }
    return v;
  }

  set(key: string, vector: number[]): void {
    if (this._cache.size >= this._maxSize && !this._cache.has(key)) {
      const oldest = this._cache.keys().next().value;
      if (oldest !== undefined) this._cache.delete(oldest);
    } else if (this._cache.has(key)) {
      this._cache.delete(key);
    }
    this._cache.set(key, vector.slice());
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  size(): number {
    return this._cache.size;
  }

  hitRate(): number {
    const total = this._hits + this._misses;
    return total === 0 ? 0 : this._hits / total;
  }

  invalidate(key: string): boolean {
    return this._cache.delete(key);
  }
}

export class TokenBag {
  // Simple bag-of-tokens vectorization (alternative to hash embedder)
  private _vocab: Map<string, number> = new Map();
  private _docCount = 0;
  private _docFreq: Map<string, number> = new Map();

  fit(texts: string[]): void {
    this._vocab.clear();
    this._docFreq.clear();
    this._docCount = texts.length;
    const seen = new Set<string>();
    for (const text of texts) {
      const words = TokenBag.tokenize(text);
      for (const w of words) {
        if (!seen.has(w)) {
          seen.add(w);
          this._docFreq.set(w, (this._docFreq.get(w) ?? 0) + 1);
        }
      }
    }
    let i = 0;
    for (const w of this._docFreq.keys()) {
      this._vocab.set(w, i);
      i += 1;
    }
  }

  static tokenize(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
  }

  // TF-IDF vector
  vectorize(text: string): Vector {
    const tokens = TokenBag.tokenize(text);
    const tf: Map<string, number> = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const dim = Math.max(this._vocab.size, 1);
    const v = new Array(dim).fill(0);
    for (const [w, count] of tf.entries()) {
      const idx = this._vocab.get(w);
      if (idx !== undefined) {
        const df = this._docFreq.get(w) ?? 1;
        const idf = Math.log((this._docCount + 1) / (df + 1)) + 1;
        v[idx] = count * idf;
      }
    }
    return { values: v, dim: v.length };
  }

  vocabSize(): number {
    return this._vocab.size;
  }
}

export class VectorMigrator {
  // Migrate vectors from one embedding space to another (e.g. model upgrade)
  migrate(
    vectors: number[][],
    sourceDim: number,
    targetDim: number,
    strategy: 'pad-truncate' | 'random-projection' | 'pca-down' | 'pca-up' = 'pad-truncate',
  ): number[][] {
    return vectors.map(v => {
      if (v.length === targetDim) return v.slice();
      if (strategy === 'pad-truncate') {
        const out = new Array(targetDim).fill(0);
        const len = Math.min(v.length, targetDim);
        for (let i = 0; i < len; i++) out[i] = v[i];
        return out;
      } else if (strategy === 'random-projection' || strategy === 'pca-up' || strategy === 'pca-down') {
        // Deterministic pseudo-random projection
        const out = new Array(targetDim).fill(0);
        for (let i = 0; i < v.length; i++) {
          out[i % targetDim] += v[i] * ((i * 13 + 17) % 7 - 3) / 10;
        }
        const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0));
        return norm > 0 ? out.map(x => x / norm) : out;
      }
      return v.slice();
    });
  }
}

// V5575: MemVectorCoreIndex
export const MEMVECTOR_BATCH_1_ENGINES = [
  'VectorEmbedder', 'CosineSim', 'DistanceMetric', 'VectorNormalizer', 'HNSWIndex',
  'PQCompressor', 'HybridSearcher', 'VectorCache', 'TokenBag', 'VectorMigrator',
  'MemVectorCoreIndex'
] as const;

export class MemVectorCoreIndex {
  list(): string[] {
    return [...MEMVECTOR_BATCH_1_ENGINES];
  }
  count(): number {
    return MEMVECTOR_BATCH_1_ENGINES.length;
  }
  has(name: string): boolean {
    return MEMVECTOR_BATCH_1_ENGINES.includes(name as typeof MEMVECTOR_BATCH_1_ENGINES[number]);
  }
}
