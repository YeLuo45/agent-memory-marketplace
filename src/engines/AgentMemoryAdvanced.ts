// V5226-V5235: CV Agent Memory Advanced Batch 2/3
// LongTermManager + ShortTerm + Working + Associative + ContextWindow + Attention + Compression + MemoryCache + MemoryProfiler + AdvancedIndex

export class LongTermMemoryManager {
  private _ltm: Map<string, { content: string; ts: number }> = new Map();

  store(id: string, content: string): this {
    this._ltm.set(id, { content, ts: Date.now() });
    return this;
  }

  get(id: string): string | null {
    return this._ltm.get(id)?.content ?? null;
  }

  has(id: string): boolean {
    return this._ltm.has(id);
  }

  remove(id: string): boolean {
    return this._ltm.delete(id);
  }

  size(): number { return this._ltm.size; }

  age(id: string): number {
    const e = this._ltm.get(id);
    return e ? Date.now() - e.ts : -1;
  }

  list(): string[] {
    return [...this._ltm.keys()];
  }
}

export class ShortTermMemory {
  private _stm: Array<{ content: string; ts: number }> = [];
  private _capacity: number;

  constructor(capacity = 10) {
    this._capacity = capacity;
  }

  push(content: string): this {
    this._stm.push({ content, ts: Date.now() });
    while (this._stm.length > this._capacity) this._stm.shift();
    return this;
  }

  recent(): string[] {
    return this._stm.map(s => s.content);
  }

  clear(): void {
    this._stm = [];
  }

  size(): number { return this._stm.length; }

  capacity(): number { return this._capacity; }
}

export class WorkingMemory {
  private _items: Map<string, { content: string; attention: number }> = new Map();

  focus(id: string, content: string, attention = 1.0): this {
    this._items.set(id, { content, attention });
    return this;
  }

  get(id: string): { content: string; attention: number } | null {
    return this._items.get(id) ?? null;
  }

  // Decay attention
  decay(factor = 0.9): this {
    for (const [id, item] of this._items.entries()) {
      const newAttention = item.attention * factor;
      if (newAttention < 0.01) this._items.delete(id);
      else this._items.set(id, { ...item, attention: newAttention });
    }
    return this;
  }

  focusedIds(threshold = 0.5): string[] {
    return [...this._items.entries()].filter(([_, v]) => v.attention >= threshold).map(([id]) => id);
  }

  size(): number { return this._items.size; }
}

export class AssociativeMemory {
  private _links: Map<string, Set<string>> = new Map();

  link(a: string, b: string): this {
    let s = this._links.get(a);
    if (!s) { s = new Set(); this._links.set(a, s); }
    s.add(b);
    return this;
  }

  unlink(a: string, b: string): this {
    this._links.get(a)?.delete(b);
    return this;
  }

  neighbors(a: string): string[] {
    return [...(this._links.get(a) ?? [])];
  }

  // BFS traversal
  reachable(start: string, maxDepth = 3): string[] {
    const visited = new Set<string>([start]);
    const queue: Array<{ node: string; depth: number }> = [{ node: start, depth: 0 }];
    const result: string[] = [];
    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;
      for (const n of this.neighbors(node)) {
        if (!visited.has(n)) {
          visited.add(n);
          result.push(n);
          queue.push({ node: n, depth: depth + 1 });
        }
      }
    }
    return result;
  }

  linkCount(): number {
    let s = 0;
    for (const set of this._links.values()) s += set.size;
    return s;
  }
}

export class ContextWindow {
  private _tokens: string[] = [];
  private _maxTokens: number;

  constructor(maxTokens = 4096) {
    this._maxTokens = maxTokens;
  }

  add(token: string): this {
    this._tokens.push(token);
    while (this._tokenCount() > this._maxTokens) this._tokens.shift();
    return this;
  }

  private _tokenCount(): number {
    return this._tokens.length;
  }

  contents(): string[] {
    return [...this._tokens];
  }

  clear(): void {
    this._tokens = [];
  }

  size(): number { return this._tokens.length; }

  isFull(): boolean {
    return this._tokens.length >= this._maxTokens;
  }

  remaining(): number {
    return Math.max(0, this._maxTokens - this._tokens.length);
  }
}

export class AttentionMechanism {
  // Simple attention: dot-product softmax
  attend(query: number[], keys: number[][]): number[] {
    if (keys.length === 0) return [];
    const scores = keys.map(k => this._dot(query, k));
    const maxScore = Math.max(...scores);
    const exps = scores.map(s => Math.exp(s - maxScore));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sumExp);
  }

  private _dot(a: number[], b: number[]): number {
    let s = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) s += a[i] * b[i];
    return s;
  }

  topK(weights: number[], k: number): number[] {
    return [...weights.keys()].sort((a, b) => weights[b] - weights[a]).slice(0, k);
  }
}

export class MemoryCompression {
  // Compress by deduplication + key extraction
  compress(items: string[]): string[] {
    return [...new Set(items)];
  }

  ratio(original: string[], compressed: string[]): number {
    return original.length === 0 ? 0 : compressed.length / original.length;
  }

  // Truncate each to first N chars
  truncate(items: string[], maxLen = 100): string[] {
    return items.map(s => s.slice(0, maxLen));
  }
}

export class MemoryCache {
  private _cache: Map<string, unknown> = new Map();
  private _maxSize: number;

  constructor(maxSize = 100) {
    this._maxSize = maxSize;
  }

  get(key: string): unknown {
    return this._cache.get(key);
  }

  set(key: string, value: unknown): this {
    if (this._cache.size >= this._maxSize && !this._cache.has(key)) {
      // Evict first
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== undefined) this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
    return this;
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  invalidate(key: string): boolean {
    return this._cache.delete(key);
  }

  size(): number { return this._cache.size; }
}

export class MemoryProfiler {
  private _samples: Map<string, Array<{ ts: number; durationMs: number; bytes: number }>> = new Map();

  record(op: string, durationMs: number, bytes: number): this {
    let list = this._samples.get(op);
    if (!list) { list = []; this._samples.set(op, list); }
    list.push({ ts: Date.now(), durationMs, bytes });
    return this;
  }

  averageDuration(op: string): number {
    const list = this._samples.get(op);
    return list && list.length > 0 ? list.reduce((a, b) => a + b.durationMs, 0) / list.length : 0;
  }

  totalBytes(op: string): number {
    return (this._samples.get(op) ?? []).reduce((s, x) => s + x.bytes, 0);
  }

  operations(): string[] {
    return [...this._samples.keys()];
  }

  reset(): void {
    this._samples.clear();
  }
}

// V5235: MemoryAdvancedIndex
export const CV_BATCH_2_ENGINES = [
  'LongTermMemoryManager', 'ShortTermMemory', 'WorkingMemory', 'AssociativeMemory', 'ContextWindow',
  'AttentionMechanism', 'MemoryCompression', 'MemoryCache', 'MemoryProfiler', 'MemoryAdvancedIndex'
] as const;

export class MemoryAdvancedIndex {
  list(): string[] {
    return [...CV_BATCH_2_ENGINES];
  }

  count(): number {
    return CV_BATCH_2_ENGINES.length;
  }

  engines(): string[] {
    return this.list();
  }

  has(name: string): boolean {
    return CV_BATCH_2_ENGINES.includes(name as typeof CV_BATCH_2_ENGINES[number]);
  }
}