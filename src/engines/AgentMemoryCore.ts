// V5216-V5225: CV Agent Memory Long-term Core Batch 1/3
// Episodic + Semantic + Procedural + Consolidation + Forgetting + Retriever + Encoder + Decoder + Hierarchy

export interface MemoryItem {
  id: string;
  content: string;
  timestamp: number;
  importance: number;
}

export class EpisodicStore {
  private _episodes: MemoryItem[] = [];

  record(content: string, importance = 0.5): MemoryItem {
    const item: MemoryItem = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      timestamp: Date.now(),
      importance
    };
    this._episodes.push(item);
    return item;
  }

  get(id: string): MemoryItem | null {
    return this._episodes.find(e => e.id === id) ?? null;
  }

  recent(limit = 10): MemoryItem[] {
    return [...this._episodes].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  important(threshold = 0.7): MemoryItem[] {
    return this._episodes.filter(e => e.importance >= threshold);
  }

  size(): number { return this._episodes.length; }
}

export class SemanticIndex {
  private _entries: Map<string, { id: string; tags: string[] }> = new Map();

  add(id: string, tags: string[]): this {
    this._entries.set(id, { id, tags });
    return this;
  }

  get(id: string): { id: string; tags: string[] } | null {
    return this._entries.get(id) ?? null;
  }

  findByTag(tag: string): string[] {
    const result: string[] = [];
    for (const e of this._entries.values()) {
      if (e.tags.includes(tag)) result.push(e.id);
    }
    return result;
  }

  remove(id: string): boolean {
    return this._entries.delete(id);
  }

  size(): number { return this._entries.size; }

  tags(id: string): string[] {
    return this._entries.get(id)?.tags ?? [];
  }
}

export class ProceduralCache {
  private _procedures: Map<string, { steps: string[]; lastUsed: number }> = new Map();

  store(id: string, steps: string[]): this {
    this._procedures.set(id, { steps, lastUsed: Date.now() });
    return this;
  }

  get(id: string): string[] | null {
    const p = this._procedures.get(id);
    if (!p) return null;
    p.lastUsed = Date.now();
    return [...p.steps];
  }

  has(id: string): boolean {
    return this._procedures.has(id);
  }

  remove(id: string): boolean {
    return this._procedures.delete(id);
  }

  size(): number { return this._procedures.size; }

  lastUsed(id: string): number {
    return this._procedures.get(id)?.lastUsed ?? 0;
  }
}

export class ConsolidationEngine {
  // Merge similar items by tag
  consolidate(items: MemoryItem[], similarityThreshold = 0.7): MemoryItem[] {
    const groups: MemoryItem[][] = [];
    for (const item of items) {
      const found = groups.find(g => g.some(i => this._similarity(i.content, item.content) >= similarityThreshold));
      if (found) found.push(item);
      else groups.push([item]);
    }
    return groups.map(g => {
      if (g.length === 1) return g[0];
      const avgImportance = g.reduce((s, i) => s + i.importance, 0) / g.length;
      return { ...g[0], content: g.map(i => i.content).join(' | '), importance: avgImportance };
    });
  }

  private _similarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    if (aWords.size === 0 || bWords.size === 0) return 0;
    let overlap = 0;
    for (const w of aWords) if (bWords.has(w)) overlap += 1;
    return overlap / Math.sqrt(aWords.size * bWords.size);
  }

  mergeable(items: MemoryItem[]): boolean {
    return this.consolidate(items).length < items.length;
  }
}

export class ForgettingEngine {
  forgetByAge(items: MemoryItem[], maxAgeMs: number): MemoryItem[] {
    const cutoff = Date.now() - maxAgeMs;
    return items.filter(i => i.timestamp < cutoff);
  }

  forgetByImportance(items: MemoryItem[], minImportance = 0.1): MemoryItem[] {
    return items.filter(i => i.importance < minImportance);
  }

  // Ebbinghaus-style decay: relevance = importance * exp(-elapsedMs / decayMs)
  relevance(item: MemoryItem, decayMs = 1000, now = Date.now()): number {
    const elapsed = now - item.timestamp;
    return item.importance * Math.exp(-elapsed / decayMs);
  }

  shouldForget(item: MemoryItem, decayMs = 1000, threshold = 0.05): boolean {
    return this.relevance(item, decayMs) < threshold;
  }
}

export class MemoryRetriever {
  // Score-based retrieval: importance + recency + match
  score(item: MemoryItem, query: string, now = Date.now()): number {
    const recency = Math.exp(-(now - item.timestamp) / 100000);
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(item.content.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const w of queryWords) if (contentWords.has(w)) overlap += 1;
    const match = queryWords.size === 0 ? 0 : overlap / queryWords.size;
    return item.importance * 0.5 + recency * 0.2 + match * 0.3;
  }

  retrieve(items: MemoryItem[], query: string, k = 5): MemoryItem[] {
    return [...items]
      .map(item => ({ item, score: this.score(item, query) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(x => x.item);
  }
}

export class MemoryEncoder {
  // Simple encoding: hash + importance marker
  encode(content: string): string {
    let h = 0;
    for (let i = 0; i < content.length; i++) h = ((h * 31) + content.charCodeAt(i)) >>> 0;
    return `mem:${h.toString(36)}:${content.slice(0, 20)}`;
  }

  decode(encoded: string): string {
    const m = encoded.match(/^mem:[a-f0-9]+:(.*)/);
    return m ? m[1] : encoded;
  }

  encodedSize(content: string): number {
    return this.encode(content).length;
  }
}

export class MemoryDecoder {
  // Reverse encoding for round-trip
  reverse(encoded: string): string {
    return encoded.slice(encoded.indexOf(':') + 1);
  }

  // Layered decode: split by ' | ' separator (used by consolidation)
  split(combined: string, sep = ' | '): string[] {
    return combined.split(sep);
  }
}

export class MemoryHierarchy {
  // Hot (recent + important) → Warm (recent) → Cold (old)
  classify(item: MemoryItem, now = Date.now()): 'hot' | 'warm' | 'cold' {
    const age = now - item.timestamp;
    if (item.importance >= 0.7 && age < 60_000) return 'hot';
    if (age < 300_000) return 'warm';
    return 'cold';
  }

  partition(items: MemoryItem[], now = Date.now()): { hot: MemoryItem[]; warm: MemoryItem[]; cold: MemoryItem[] } {
    const result = { hot: [], warm: [], cold: [] } as { hot: MemoryItem[]; warm: MemoryItem[]; cold: MemoryItem[] };
    for (const item of items) {
      const c = this.classify(item, now);
      result[c].push(item);
    }
    return result;
  }

  isHot(item: MemoryItem, now = Date.now()): boolean {
    return this.classify(item, now) === 'hot';
  }
}

// V5225: MemoryCoreIndex
export const CV_BATCH_1_ENGINES = [
  'EpisodicStore', 'SemanticIndex', 'ProceduralCache', 'ConsolidationEngine', 'ForgettingEngine',
  'MemoryRetriever', 'MemoryEncoder', 'MemoryDecoder', 'MemoryHierarchy', 'MemoryCoreIndex'
] as const;

export class MemoryCoreIndex {
  list(): string[] {
    return [...CV_BATCH_1_ENGINES];
  }

  count(): number {
    return CV_BATCH_1_ENGINES.length;
  }

  engines(): string[] {
    return this.list();
  }

  has(name: string): boolean {
    return CV_BATCH_1_ENGINES.includes(name as typeof CV_BATCH_1_ENGINES[number]);
  }
}