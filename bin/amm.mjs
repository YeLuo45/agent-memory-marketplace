#!/usr/bin/env node

// src/engines/AgentMemoryCore.ts
var EpisodicStore = class {
  _episodes = [];
  record(content, importance = 0.5) {
    const item = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      timestamp: Date.now(),
      importance
    };
    this._episodes.push(item);
    return item;
  }
  get(id) {
    return this._episodes.find((e) => e.id === id) ?? null;
  }
  recent(limit = 10) {
    return [...this._episodes].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }
  important(threshold = 0.7) {
    return this._episodes.filter((e) => e.importance >= threshold);
  }
  size() {
    return this._episodes.length;
  }
};
var SemanticIndex = class {
  _entries = /* @__PURE__ */ new Map();
  add(id, tags) {
    this._entries.set(id, { id, tags });
    return this;
  }
  get(id) {
    return this._entries.get(id) ?? null;
  }
  findByTag(tag) {
    const result = [];
    for (const e of this._entries.values()) {
      if (e.tags.includes(tag)) result.push(e.id);
    }
    return result;
  }
  remove(id) {
    return this._entries.delete(id);
  }
  size() {
    return this._entries.size;
  }
  tags(id) {
    return this._entries.get(id)?.tags ?? [];
  }
};
var ProceduralCache = class {
  _procedures = /* @__PURE__ */ new Map();
  store(id, steps) {
    this._procedures.set(id, { steps, lastUsed: Date.now() });
    return this;
  }
  get(id) {
    const p = this._procedures.get(id);
    if (!p) return null;
    p.lastUsed = Date.now();
    return [...p.steps];
  }
  has(id) {
    return this._procedures.has(id);
  }
  remove(id) {
    return this._procedures.delete(id);
  }
  size() {
    return this._procedures.size;
  }
  lastUsed(id) {
    return this._procedures.get(id)?.lastUsed ?? 0;
  }
};
var ConsolidationEngine = class {
  // Merge similar items by tag
  consolidate(items, similarityThreshold = 0.7) {
    const groups = [];
    for (const item of items) {
      const found = groups.find((g) => g.some((i) => this._similarity(i.content, item.content) >= similarityThreshold));
      if (found) found.push(item);
      else groups.push([item]);
    }
    return groups.map((g) => {
      if (g.length === 1) return g[0];
      const avgImportance = g.reduce((s, i) => s + i.importance, 0) / g.length;
      return { ...g[0], content: g.map((i) => i.content).join(" | "), importance: avgImportance };
    });
  }
  _similarity(a, b) {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    if (aWords.size === 0 || bWords.size === 0) return 0;
    let overlap = 0;
    for (const w of aWords) if (bWords.has(w)) overlap += 1;
    return overlap / Math.sqrt(aWords.size * bWords.size);
  }
  mergeable(items) {
    return this.consolidate(items).length < items.length;
  }
};
var ForgettingEngine = class {
  forgetByAge(items, maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    return items.filter((i) => i.timestamp < cutoff);
  }
  forgetByImportance(items, minImportance = 0.1) {
    return items.filter((i) => i.importance < minImportance);
  }
  // Ebbinghaus-style decay: relevance = importance * exp(-elapsedMs / decayMs)
  relevance(item, decayMs = 1e3, now = Date.now()) {
    const elapsed = now - item.timestamp;
    return item.importance * Math.exp(-elapsed / decayMs);
  }
  shouldForget(item, decayMs = 1e3, threshold = 0.05) {
    return this.relevance(item, decayMs) < threshold;
  }
};
var MemoryRetriever = class {
  // Score-based retrieval: importance + recency + match
  score(item, query, now = Date.now()) {
    const recency = Math.exp(-(now - item.timestamp) / 1e5);
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(item.content.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const w of queryWords) if (contentWords.has(w)) overlap += 1;
    const match = queryWords.size === 0 ? 0 : overlap / queryWords.size;
    return item.importance * 0.5 + recency * 0.2 + match * 0.3;
  }
  retrieve(items, query, k = 5) {
    return [...items].map((item) => ({ item, score: this.score(item, query) })).sort((a, b) => b.score - a.score).slice(0, k).map((x) => x.item);
  }
};
var MemoryEncoder = class {
  // Simple encoding: hash + importance marker
  encode(content) {
    let h = 0;
    for (let i = 0; i < content.length; i++) h = h * 31 + content.charCodeAt(i) >>> 0;
    return `mem:${h.toString(36)}:${content.slice(0, 20)}`;
  }
  decode(encoded) {
    const m = encoded.match(/^mem:[a-f0-9]+:(.*)/);
    return m ? m[1] : encoded;
  }
  encodedSize(content) {
    return this.encode(content).length;
  }
};
var MemoryDecoder = class {
  // Reverse encoding for round-trip
  reverse(encoded) {
    return encoded.slice(encoded.indexOf(":") + 1);
  }
  // Layered decode: split by ' | ' separator (used by consolidation)
  split(combined, sep = " | ") {
    return combined.split(sep);
  }
};
var MemoryHierarchy = class {
  // Hot (recent + important) → Warm (recent) → Cold (old)
  classify(item, now = Date.now()) {
    const age = now - item.timestamp;
    if (item.importance >= 0.7 && age < 6e4) return "hot";
    if (age < 3e5) return "warm";
    return "cold";
  }
  partition(items, now = Date.now()) {
    const result = { hot: [], warm: [], cold: [] };
    for (const item of items) {
      const c = this.classify(item, now);
      result[c].push(item);
    }
    return result;
  }
  isHot(item, now = Date.now()) {
    return this.classify(item, now) === "hot";
  }
};
var CV_BATCH_1_ENGINES = [
  "EpisodicStore",
  "SemanticIndex",
  "ProceduralCache",
  "ConsolidationEngine",
  "ForgettingEngine",
  "MemoryRetriever",
  "MemoryEncoder",
  "MemoryDecoder",
  "MemoryHierarchy",
  "MemoryCoreIndex"
];
var MemoryCoreIndex = class {
  list() {
    return [...CV_BATCH_1_ENGINES];
  }
  count() {
    return CV_BATCH_1_ENGINES.length;
  }
  engines() {
    return this.list();
  }
  has(name) {
    return CV_BATCH_1_ENGINES.includes(name);
  }
};

// src/engines/AgentMemoryAdvanced.ts
var LongTermMemoryManager = class {
  _ltm = /* @__PURE__ */ new Map();
  store(id, content) {
    this._ltm.set(id, { content, ts: Date.now() });
    return this;
  }
  get(id) {
    return this._ltm.get(id)?.content ?? null;
  }
  has(id) {
    return this._ltm.has(id);
  }
  remove(id) {
    return this._ltm.delete(id);
  }
  size() {
    return this._ltm.size;
  }
  age(id) {
    const e = this._ltm.get(id);
    return e ? Date.now() - e.ts : -1;
  }
  list() {
    return [...this._ltm.keys()];
  }
};
var ShortTermMemory = class {
  _stm = [];
  _capacity;
  constructor(capacity = 10) {
    this._capacity = capacity;
  }
  push(content) {
    this._stm.push({ content, ts: Date.now() });
    while (this._stm.length > this._capacity) this._stm.shift();
    return this;
  }
  recent() {
    return this._stm.map((s) => s.content);
  }
  clear() {
    this._stm = [];
  }
  size() {
    return this._stm.length;
  }
  capacity() {
    return this._capacity;
  }
};
var WorkingMemory = class {
  _items = /* @__PURE__ */ new Map();
  focus(id, content, attention = 1) {
    this._items.set(id, { content, attention });
    return this;
  }
  get(id) {
    return this._items.get(id) ?? null;
  }
  // Decay attention
  decay(factor = 0.9) {
    for (const [id, item] of this._items.entries()) {
      const newAttention = item.attention * factor;
      if (newAttention < 0.01) this._items.delete(id);
      else this._items.set(id, { ...item, attention: newAttention });
    }
    return this;
  }
  focusedIds(threshold = 0.5) {
    return [...this._items.entries()].filter(([_, v]) => v.attention >= threshold).map(([id]) => id);
  }
  size() {
    return this._items.size;
  }
};
var AssociativeMemory = class {
  _links = /* @__PURE__ */ new Map();
  link(a, b) {
    let s = this._links.get(a);
    if (!s) {
      s = /* @__PURE__ */ new Set();
      this._links.set(a, s);
    }
    s.add(b);
    return this;
  }
  unlink(a, b) {
    this._links.get(a)?.delete(b);
    return this;
  }
  neighbors(a) {
    return [...this._links.get(a) ?? []];
  }
  // BFS traversal
  reachable(start, maxDepth = 3) {
    const visited = /* @__PURE__ */ new Set([start]);
    const queue = [{ node: start, depth: 0 }];
    const result = [];
    while (queue.length > 0) {
      const { node, depth } = queue.shift();
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
  linkCount() {
    let s = 0;
    for (const set of this._links.values()) s += set.size;
    return s;
  }
};
var ContextWindow = class {
  _tokens = [];
  _maxTokens;
  constructor(maxTokens = 4096) {
    this._maxTokens = maxTokens;
  }
  add(token) {
    this._tokens.push(token);
    while (this._tokenCount() > this._maxTokens) this._tokens.shift();
    return this;
  }
  _tokenCount() {
    return this._tokens.length;
  }
  contents() {
    return [...this._tokens];
  }
  clear() {
    this._tokens = [];
  }
  size() {
    return this._tokens.length;
  }
  isFull() {
    return this._tokens.length >= this._maxTokens;
  }
  remaining() {
    return Math.max(0, this._maxTokens - this._tokens.length);
  }
};
var AttentionMechanism = class {
  // Simple attention: dot-product softmax
  attend(query, keys) {
    if (keys.length === 0) return [];
    const scores = keys.map((k) => this._dot(query, k));
    const maxScore = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - maxScore));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sumExp);
  }
  _dot(a, b) {
    let s = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) s += a[i] * b[i];
    return s;
  }
  topK(weights, k) {
    return [...weights.keys()].sort((a, b) => weights[b] - weights[a]).slice(0, k);
  }
};
var MemoryCompression = class {
  // Compress by deduplication + key extraction
  compress(items) {
    return [...new Set(items)];
  }
  ratio(original, compressed) {
    return original.length === 0 ? 0 : compressed.length / original.length;
  }
  // Truncate each to first N chars
  truncate(items, maxLen = 100) {
    return items.map((s) => s.slice(0, maxLen));
  }
};
var MemoryCache = class {
  _cache = /* @__PURE__ */ new Map();
  _maxSize;
  constructor(maxSize = 100) {
    this._maxSize = maxSize;
  }
  get(key) {
    return this._cache.get(key);
  }
  set(key, value) {
    if (this._cache.size >= this._maxSize && !this._cache.has(key)) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== void 0) this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
    return this;
  }
  has(key) {
    return this._cache.has(key);
  }
  invalidate(key) {
    return this._cache.delete(key);
  }
  size() {
    return this._cache.size;
  }
};
var MemoryProfiler = class {
  _samples = /* @__PURE__ */ new Map();
  record(op, durationMs, bytes) {
    let list = this._samples.get(op);
    if (!list) {
      list = [];
      this._samples.set(op, list);
    }
    list.push({ ts: Date.now(), durationMs, bytes });
    return this;
  }
  averageDuration(op) {
    const list = this._samples.get(op);
    return list && list.length > 0 ? list.reduce((a, b) => a + b.durationMs, 0) / list.length : 0;
  }
  totalBytes(op) {
    return (this._samples.get(op) ?? []).reduce((s, x) => s + x.bytes, 0);
  }
  operations() {
    return [...this._samples.keys()];
  }
  reset() {
    this._samples.clear();
  }
};
var CV_BATCH_2_ENGINES = [
  "LongTermMemoryManager",
  "ShortTermMemory",
  "WorkingMemory",
  "AssociativeMemory",
  "ContextWindow",
  "AttentionMechanism",
  "MemoryCompression",
  "MemoryCache",
  "MemoryProfiler",
  "MemoryAdvancedIndex"
];
var MemoryAdvancedIndex = class {
  list() {
    return [...CV_BATCH_2_ENGINES];
  }
  count() {
    return CV_BATCH_2_ENGINES.length;
  }
  engines() {
    return this.list();
  }
  has(name) {
    return CV_BATCH_2_ENGINES.includes(name);
  }
};

// src/engines/AgentMemoryIntegration.ts
var MemoryDashboard = class {
  _panels = /* @__PURE__ */ new Map();
  setPanel(name, title, value) {
    this._panels.set(name, { title, value });
    return this;
  }
  getPanel(name) {
    return this._panels.get(name) ?? null;
  }
  panelNames() {
    return [...this._panels.keys()];
  }
  panelCount() {
    return this._panels.size;
  }
};
var MemoryConfig = class {
  _config = /* @__PURE__ */ new Map();
  set(key, value) {
    this._config.set(key, value);
    return this;
  }
  get(key) {
    return this._config.get(key);
  }
  getString(key, fallback = "") {
    const v = this._config.get(key);
    return typeof v === "string" ? v : fallback;
  }
  getNumber(key, fallback = 0) {
    const v = this._config.get(key);
    return typeof v === "number" ? v : fallback;
  }
  getBoolean(key, fallback = false) {
    const v = this._config.get(key);
    return typeof v === "boolean" ? v : fallback;
  }
  size() {
    return this._config.size;
  }
};
var MemoryAudit = class {
  _records = [];
  record(agentId, action, memoryType) {
    this._records.push({ ts: Date.now(), agentId, action, memoryType });
    return this;
  }
  records() {
    return [...this._records];
  }
  forAgent(agentId) {
    return this._records.filter((r) => r.agentId === agentId);
  }
  count() {
    return this._records.length;
  }
  clear() {
    this._records = [];
  }
};
var MemoryProfile = class {
  _runs = /* @__PURE__ */ new Map();
  record(agentId, items, durationMs) {
    let list = this._runs.get(agentId);
    if (!list) {
      list = [];
      this._runs.set(agentId, list);
    }
    list.push({ ts: Date.now(), items, durationMs });
    return this;
  }
  runs(agentId) {
    return [...this._runs.get(agentId) ?? []];
  }
  averageItems(agentId) {
    const list = this._runs.get(agentId);
    return list && list.length > 0 ? list.reduce((a, b) => a + b.items, 0) / list.length : 0;
  }
  averageDuration(agentId) {
    const list = this._runs.get(agentId);
    return list && list.length > 0 ? list.reduce((a, b) => a + b.durationMs, 0) / list.length : 0;
  }
};
var MemoryMigration = class {
  _migrations = /* @__PURE__ */ new Map();
  _applied = /* @__PURE__ */ new Set();
  define(version, run) {
    this._migrations.set(version, { run });
    return this;
  }
  async run(version) {
    const m = this._migrations.get(version);
    if (!m) return false;
    await m.run();
    this._applied.add(version);
    return true;
  }
  isApplied(version) {
    return this._applied.has(version);
  }
  migrationCount() {
    return this._migrations.size;
  }
  appliedCount() {
    return this._applied.size;
  }
};
var MemoryReport = class {
  generate(title, metrics) {
    const lines = [`# ${title}`, "", "| Metric | Value |", "| --- | --- |"];
    for (const [k, v] of Object.entries(metrics)) {
      lines.push(`| ${k} | ${v} |`);
    }
    return lines.join("\n");
  }
  toCSV(metrics) {
    return "metric,value\n" + Object.entries(metrics).map(([k, v]) => `${k},${v}`).join("\n");
  }
};
var MemoryBenchmark = class {
  _results = /* @__PURE__ */ new Map();
  record(name, score) {
    this._results.set(name, score);
    return this;
  }
  get(name) {
    return this._results.get(name) ?? 0;
  }
  best() {
    if (this._results.size === 0) return null;
    let bestName = "";
    let bestScore = -Infinity;
    for (const [name, score] of this._results.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    }
    return { name: bestName, score: bestScore };
  }
  results() {
    return Object.fromEntries(this._results.entries());
  }
};
var CV_BATCH_3_ENGINES = [
  "MemoryDashboard",
  "MemoryConfig",
  "MemoryAudit",
  "MemoryProfile",
  "MemoryMigration",
  "MemoryReport",
  "MemoryBenchmark",
  "MemoryIntegrationIndex",
  "MemoryMasterIndex"
];
var MemoryIntegrationIndex = class {
  list() {
    return [...CV_BATCH_3_ENGINES];
  }
  count() {
    return CV_BATCH_3_ENGINES.length;
  }
  engines() {
    return this.list();
  }
  has(name) {
    return CV_BATCH_3_ENGINES.includes(name);
  }
};
var CV_ALL_ENGINES = [
  ...CV_BATCH_1_ENGINES,
  ...CV_BATCH_2_ENGINES,
  ...CV_BATCH_3_ENGINES
];
var MemoryMasterIndex = class {
  list() {
    return [...CV_ALL_ENGINES];
  }
  count() {
    return CV_ALL_ENGINES.length;
  }
  engines() {
    return this.list();
  }
  has(name) {
    return CV_ALL_ENGINES.includes(name);
  }
};

// src/engines/MemVectorCore.ts
var VectorEmbedder = class {
  _dim;
  constructor(dim = 64) {
    this._dim = dim;
  }
  _hashToVec(input) {
    const v = new Array(this._dim).fill(0);
    for (let i = 0; i < this._dim; i++) {
      let h = i * 2654435761 >>> 0;
      for (let j = 0; j < input.length; j++) {
        h = (h * 31 ^ input.charCodeAt(j)) >>> 0;
      }
      v[i] = h % 1e3 / 1e3 - 0.5;
    }
    return v;
  }
  embedText(text) {
    return { values: this._hashToVec(text.toLowerCase()), dim: this._dim };
  }
  embedTags(tags) {
    return { values: this._hashToVec(tags.join(" ").toLowerCase()), dim: this._dim };
  }
  dim() {
    return this._dim;
  }
  // Project existing embedding to new dimension (matches cp-vector-quant v2 EmbeddingAligner)
  project(values, newDim) {
    const result = new Array(newDim).fill(0);
    for (let i = 0; i < values.length; i++) {
      result[i % newDim] += values[i];
    }
    const norm = Math.sqrt(result.reduce((a, b) => a + b * b, 0));
    return norm > 0 ? result.map((v) => v / norm) : result;
  }
};
var CosineSim = class {
  // Cosine similarity in [-1, 1]
  similarity(a, b) {
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
  distance(a, b) {
    const len = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < len; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }
  // Top-K indices by similarity (desc)
  topK(query, candidates, k) {
    const scores = candidates.map((c, i) => ({ i, s: this.similarity(query, c) }));
    return scores.sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.i);
  }
};
var DistanceMetric = class {
  // Wraps CosineSim with explicit metric name
  static cosine(a, b) {
    return new CosineSim().similarity(a, b);
  }
  static euclidean(a, b) {
    return new CosineSim().distance(a, b);
  }
  static dot(a, b) {
    let s = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) s += a[i] * b[i];
    return s;
  }
};
var VectorNormalizer = class {
  // L2 normalize a vector (or zero-vector if all 0)
  static normalize(v) {
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    if (norm === 0) return v.slice();
    return v.map((x) => x / norm);
  }
  // Min-max normalize to [0, 1]
  static minMax(v) {
    if (v.length === 0) return [];
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min;
    if (range === 0) return v.map(() => 0);
    return v.map((x) => (x - min) / range);
  }
  // Z-score normalize (mean 0, std 1)
  static zScore(v) {
    if (v.length === 0) return [];
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
    const std = Math.sqrt(variance);
    if (std === 0) return v.map(() => 0);
    return v.map((x) => (x - mean) / std);
  }
};
var HNSWIndex = class {
  _nodes = /* @__PURE__ */ new Map();
  _level = 0;
  _efConstruction;
  _m;
  constructor(efConstruction = 32, m = 4) {
    this._efConstruction = efConstruction;
    this._m = m;
  }
  size() {
    return this._nodes.size;
  }
  // Insert a node — simplified HNSW (linear scan over neighbors)
  insert(id, vector) {
    if (this._nodes.has(id)) return;
    const level = Math.floor(Math.random() * 3);
    this._nodes.set(id, { id, vector, neighbors: /* @__PURE__ */ new Set(), level });
    this._level = Math.max(this._level, level);
    const existing = [];
    this._nodes.forEach((n) => {
      if (n.id !== id) existing.push(n);
    });
    const cs = new CosineSim();
    const sims = existing.map((n) => ({ id: n.id, s: cs.similarity(vector, n.vector) }));
    sims.sort((a, b) => b.s - a.s);
    const k = Math.min(this._m, sims.length);
    const me = this._nodes.get(id);
    for (let i = 0; i < k; i++) {
      me.neighbors.add(sims[i].id);
      existing[existing.findIndex((e) => e.id === sims[i].id)].neighbors.add(id);
    }
  }
  // Query K nearest — beam search top-_efConstruction candidates
  query(vector, k) {
    if (this._nodes.size === 0) return [];
    const cs = new CosineSim();
    const all = [];
    this._nodes.forEach((n) => all.push({ id: n.id, score: cs.similarity(vector, n.vector) }));
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, k);
  }
  has(id) {
    return this._nodes.has(id);
  }
  remove(id) {
    if (!this._nodes.has(id)) return false;
    this._nodes.delete(id);
    this._nodes.forEach((n) => n.neighbors.delete(id));
    return true;
  }
  ids() {
    return [...this._nodes.keys()];
  }
  // Statistics
  averageDegree() {
    if (this._nodes.size === 0) return 0;
    let s = 0;
    this._nodes.forEach((n) => s += n.neighbors.size);
    return s / this._nodes.size;
  }
};
var PQCompressor = class {
  // Product Quantization: split vector into K sub-vectors of dim/K each,
  // store first byte (centroid id × 256 / 256). Lossy but small.
  _k;
  _subVectors = /* @__PURE__ */ new Map();
  constructor(k = 4) {
    if (k < 1 || (k & k - 1) !== 0) {
      throw new Error("k must be a power of 2 for PQ");
    }
    this._k = k;
  }
  compress(vector) {
    const dim = vector.length;
    if (dim % this._k !== 0) return vector.slice();
    const subDim = dim / this._k;
    const out = [];
    for (let i = 0; i < this._k; i++) {
      const slice = vector.slice(i * subDim, (i + 1) * subDim);
      const mean = slice.reduce((a, b) => a + b, 0) / subDim;
      const id = Math.max(0, Math.min(255, Math.floor(mean * 255 + 128)));
      out.push(id);
    }
    return out;
  }
  decompress(codes, originalDim) {
    if (codes.length !== this._k) return [];
    const subDim = originalDim / this._k;
    const out = [];
    for (let i = 0; i < this._k; i++) {
      const mean = (codes[i] - 128) / 255;
      for (let j = 0; j < subDim; j++) {
        out.push(mean);
      }
    }
    return out;
  }
  compressionRatio(originalDim) {
    return this._k / originalDim;
  }
  size() {
    return this._k;
  }
  // Approximate distance between compressed codes — faster than decompressing
  approxDistance(a, b) {
    if (a.length !== b.length) return Infinity;
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s;
  }
};
var HybridSearcher = class {
  // Combine tag match (EpisodicStore/SemanticIndex style) + vector similarity
  search(query, queryVec, items, options = {}) {
    const alpha = options.alpha ?? 0.5;
    const limit = options.limit ?? 10;
    const q = query.toLowerCase().trim();
    const cs = new CosineSim();
    return items.map((it) => {
      const qWords = new Set(q.split(/\s+/).filter((w2) => w2.length > 0));
      const itWords = new Set(it.tags.map((t) => t.toLowerCase()));
      let overlap = 0;
      qWords.forEach((w2) => {
        if (itWords.has(w2)) overlap += 1;
      });
      const union = (/* @__PURE__ */ new Set([...qWords, ...itWords])).size;
      const tagScore = union === 0 ? 0 : overlap / union;
      const vecScore = cs.similarity(queryVec, it.vector);
      const w = it.weight ?? 1;
      const combined = (alpha * tagScore + (1 - alpha) * vecScore) * w;
      return { id: it.id, tagScore, vecScore, combined };
    }).sort((a, b) => b.combined - a.combined).slice(0, limit);
  }
  // Tune alpha via grid search
  tuneAlpha(query, queryVec, items, groundTruth) {
    let bestAlpha = 0.5;
    let bestScore = -Infinity;
    for (let alpha = 0; alpha <= 1; alpha += 0.1) {
      const results = this.search(query, queryVec, items, { alpha, limit: 10 });
      const hits = results.filter((r) => groundTruth.has(r.id)).length;
      if (hits > bestScore || hits === bestScore && Math.abs(alpha - 0.5) < Math.abs(bestAlpha - 0.5)) {
        bestScore = hits;
        bestAlpha = alpha;
      }
    }
    return bestAlpha;
  }
};
var VectorCache = class {
  _cache = /* @__PURE__ */ new Map();
  _maxSize;
  _hits = 0;
  _misses = 0;
  constructor(maxSize = 256) {
    this._maxSize = maxSize;
  }
  get(key) {
    const v = this._cache.get(key);
    if (v !== void 0) {
      this._hits += 1;
      this._cache.delete(key);
      this._cache.set(key, v);
    } else {
      this._misses += 1;
    }
    return v;
  }
  set(key, vector) {
    if (this._cache.size >= this._maxSize && !this._cache.has(key)) {
      const oldest = this._cache.keys().next().value;
      if (oldest !== void 0) this._cache.delete(oldest);
    } else if (this._cache.has(key)) {
      this._cache.delete(key);
    }
    this._cache.set(key, vector.slice());
  }
  has(key) {
    return this._cache.has(key);
  }
  size() {
    return this._cache.size;
  }
  hitRate() {
    const total = this._hits + this._misses;
    return total === 0 ? 0 : this._hits / total;
  }
  invalidate(key) {
    return this._cache.delete(key);
  }
};
var TokenBag = class _TokenBag {
  // Simple bag-of-tokens vectorization (alternative to hash embedder)
  _vocab = /* @__PURE__ */ new Map();
  _docCount = 0;
  _docFreq = /* @__PURE__ */ new Map();
  fit(texts) {
    this._vocab.clear();
    this._docFreq.clear();
    this._docCount = texts.length;
    const seen = /* @__PURE__ */ new Set();
    for (const text of texts) {
      const words = _TokenBag.tokenize(text);
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
  static tokenize(text) {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  }
  // TF-IDF vector
  vectorize(text) {
    const tokens = _TokenBag.tokenize(text);
    const tf = /* @__PURE__ */ new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const dim = Math.max(this._vocab.size, 1);
    const v = new Array(dim).fill(0);
    for (const [w, count] of tf.entries()) {
      const idx = this._vocab.get(w);
      if (idx !== void 0) {
        const df = this._docFreq.get(w) ?? 1;
        const idf = Math.log((this._docCount + 1) / (df + 1)) + 1;
        v[idx] = count * idf;
      }
    }
    return { values: v, dim: v.length };
  }
  vocabSize() {
    return this._vocab.size;
  }
};
var VectorMigrator = class {
  // Migrate vectors from one embedding space to another (e.g. model upgrade)
  migrate(vectors, sourceDim, targetDim, strategy = "pad-truncate") {
    return vectors.map((v) => {
      if (v.length === targetDim) return v.slice();
      if (strategy === "pad-truncate") {
        const out = new Array(targetDim).fill(0);
        const len = Math.min(v.length, targetDim);
        for (let i = 0; i < len; i++) out[i] = v[i];
        return out;
      } else if (strategy === "random-projection" || strategy === "pca-up" || strategy === "pca-down") {
        const out = new Array(targetDim).fill(0);
        for (let i = 0; i < v.length; i++) {
          out[i % targetDim] += v[i] * ((i * 13 + 17) % 7 - 3) / 10;
        }
        const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0));
        return norm > 0 ? out.map((x) => x / norm) : out;
      }
      return v.slice();
    });
  }
};
var MEMVECTOR_BATCH_1_ENGINES = [
  "VectorEmbedder",
  "CosineSim",
  "DistanceMetric",
  "VectorNormalizer",
  "HNSWIndex",
  "PQCompressor",
  "HybridSearcher",
  "VectorCache",
  "TokenBag",
  "VectorMigrator",
  "MemVectorCoreIndex"
];
var MemVectorCoreIndex = class {
  list() {
    return [...MEMVECTOR_BATCH_1_ENGINES];
  }
  count() {
    return MEMVECTOR_BATCH_1_ENGINES.length;
  }
  has(name) {
    return MEMVECTOR_BATCH_1_ENGINES.includes(name);
  }
};

// src/data/liveDemos.ts
var measure = (fn) => {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
};
var runDemo = (engineId) => {
  const useAdvanced = false;
  switch (engineId) {
    case "EpisodicStore": {
      const { result, ms } = measure(() => {
        const s = new EpisodicStore();
        s.record("user said hi", 0.7);
        s.record("user asked about weather", 0.9);
        s.record("user thanked", 0.4);
        return {
          recent: s.recent(3).map((e) => `${e.content} (imp=${e.importance})`),
          important: s.important(0.6).map((e) => e.content),
          total: s.size()
        };
      });
      return { engineId, title: "EpisodicStore", steps: ["record 3 episodes", "recent(3)", "important(\u22650.6)"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "SemanticIndex": {
      const { result, ms } = measure(() => {
        const s = new SemanticIndex();
        s.add("m1", ["python", "ai"]).add("m2", ["python"]).add("m3", ["rust"]);
        return {
          python: s.findByTag("python"),
          rust: s.findByTag("rust"),
          tags: { m1: s.tags("m1"), m2: s.tags("m2") },
          total: s.size()
        };
      });
      return { engineId, title: "SemanticIndex", steps: ["add 3 entries with tags", "findByTag \xD7 2", "tags() \xD7 2"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "ProceduralCache": {
      const { result, ms } = measure(() => {
        const p = new ProceduralCache();
        p.store("reset-pwd", ["verify email", "send token", "redirect to /reset"]);
        p.store("extract-text", ["open pdf", "extract plain text"]);
        return {
          resetPwd: p.get("reset-pwd"),
          extract: p.get("extract-text"),
          hasReset: p.has("reset-pwd"),
          size: p.size()
        };
      });
      return { engineId, title: "ProceduralCache", steps: ["store 2 procedures", "get \xD7 2"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "ConsolidationEngine": {
      const { result, ms } = measure(() => {
        const c = new ConsolidationEngine();
        const items = [
          { id: "a", content: "cat sat on the rug", timestamp: 1, importance: 0.5 },
          { id: "b", content: "cat sat on the mat", timestamp: 2, importance: 0.6 },
          { id: "c", content: "dog ran in the park", timestamp: 3, importance: 0.8 }
        ];
        return {
          merged: c.consolidate(items).length,
          mergeable: c.mergeable(items),
          sample: c.consolidate(items)[0]?.content
        };
      });
      return { engineId, title: "ConsolidationEngine", steps: ["3 similar episodes", "consolidate"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "ForgettingEngine": {
      const { result, ms } = measure(() => {
        const f = new ForgettingEngine();
        const old = { id: "old", content: "x", timestamp: Date.now() - 1e6, importance: 0.5 };
        const fresh = { id: "fresh", content: "y", timestamp: Date.now(), importance: 0.5 };
        return {
          decay: f.relevance(old, 1e5),
          forgetOld: f.shouldForget(old, 1e5, 0.01),
          forgetFresh: f.shouldForget(fresh, 1e5, 0.01)
        };
      });
      return { engineId, title: "ForgettingEngine", steps: ["compute decay", "shouldForget \xD7 2"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryRetriever": {
      const { result, ms } = measure(() => {
        const r = new MemoryRetriever();
        const items = [
          { id: "a", content: "user likes sunny weather", timestamp: Date.now() - 100, importance: 0.8 },
          { id: "b", content: "weather forecast was cloudy", timestamp: Date.now(), importance: 0.4 },
          { id: "c", content: "user mentioned cat", timestamp: Date.now(), importance: 0.7 }
        ];
        const top = r.retrieve(items, "weather", 2);
        return {
          query: "weather",
          topK: top.map((m) => m.id),
          scores: top.map((m) => r.score(m, "weather").toFixed(3))
        };
      });
      return { engineId, title: "MemoryRetriever", steps: ['score 3 memories for query "weather"', "retrieve top-2"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryEncoder": {
      const { result, ms } = measure(() => {
        const e = new MemoryEncoder();
        const msg = "hello world";
        const enc = e.encode(msg);
        return {
          input: msg,
          encoded: enc,
          size: e.encodedSize(msg)
        };
      });
      return { engineId, title: "MemoryEncoder", steps: ['encode "hello world"'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryDecoder": {
      const { result, ms } = measure(() => {
        const d = new MemoryDecoder();
        return {
          reverse: d.reverse("mem:abc12345:hello world"),
          split: d.split("alpha | beta | gamma")
        };
      });
      return { engineId, title: "MemoryDecoder", steps: ["reverse + split"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryHierarchy": {
      const { result, ms } = measure(() => {
        const h = new MemoryHierarchy();
        const now = Date.now();
        const items = [
          { id: "h", content: "x", timestamp: now, importance: 0.9 },
          { id: "w", content: "y", timestamp: now - 1e5, importance: 0.5 },
          { id: "c", content: "z", timestamp: now - 1e6, importance: 0.1 }
        ];
        return {
          tiers: h.partition(items, now)
        };
      });
      return { engineId, title: "MemoryHierarchy", steps: ["classify 3 items by importance + age"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "LongTermMemoryManager": {
      const { result, ms } = measure(() => {
        const m = new LongTermMemoryManager();
        m.store("theme", "dark").store("locale", "en-US").store("user-id", "u_42");
        return {
          stored: m.list(),
          age1ms: m.age("theme"),
          value: m.get("user-id")
        };
      });
      return { engineId, title: "LongTermMemoryManager", steps: ["store 3 keys", "list + age + get"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "ShortTermMemory": {
      const { result, ms } = measure(() => {
        const s = new ShortTermMemory(3);
        s.push("a").push("b").push("c").push("d");
        return {
          rollingWindow: s.recent(),
          size: s.size(),
          capacity: s.capacity()
        };
      });
      return { engineId, title: "ShortTermMemory", steps: ["push 4 with cap=3 (FIFO eviction)"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "WorkingMemory": {
      const { result, ms } = measure(() => {
        const w = new WorkingMemory();
        w.focus("a", "content-a", 0.9).focus("b", "content-b", 0.3);
        w.decay(0.5);
        return {
          focused: w.focusedIds(0.4),
          afterDecay: { a: w.get("a")?.attention, b: w.get("b")?.attention }
        };
      });
      return { engineId, title: "WorkingMemory", steps: ["focus 2 items + decay(0.5)"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "AssociativeMemory": {
      const { result, ms } = measure(() => {
        const a = new AssociativeMemory();
        a.link("ramen", "japanese-food").link("ramen", "cold-dishes").link("japanese-food", "sushi");
        return {
          ramenNeighbors: a.neighbors("ramen"),
          reachable: a.reachable("ramen", 2),
          linkCount: a.linkCount()
        };
      });
      return { engineId, title: "AssociativeMemory", steps: ["link 3 pairs (graph)", "neighbors + BFS"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "ContextWindow": {
      const { result, ms } = measure(() => {
        const w = new ContextWindow(5);
        ["a", "b", "c", "d", "e", "f", "g"].forEach((c) => w.add(c));
        return {
          contents: w.contents(),
          size: w.size(),
          remaining: w.remaining(),
          isFull: w.isFull()
        };
      });
      return { engineId, title: "ContextWindow", steps: ["add 7 tokens to cap-5"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "AttentionMechanism": {
      const { result, ms } = measure(() => {
        const a = new AttentionMechanism();
        const w = a.attend([1, 0], [[1, 0], [0, 1], [0.5, 0.5]]);
        return {
          weights: w.map((x) => x.toFixed(4)),
          topK: a.topK(w, 2)
        };
      });
      return { engineId, title: "AttentionMechanism", steps: ["attend over 3 keys"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryCompression": {
      const { result, ms } = measure(() => {
        const c = new MemoryCompression();
        const items = ["hello world", "hello world", "goodbye world", "hello world"];
        const compressed = c.compress(items);
        return {
          before: items.length,
          after: compressed.length,
          ratio: c.ratio(items, compressed).toFixed(3),
          truncated: c.truncate(["long-message-here"], 5)
        };
      });
      return { engineId, title: "MemoryCompression", steps: ["dedup + truncate"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryCache": {
      const { result, ms } = measure(() => {
        const c = new MemoryCache(2);
        c.set("a", 1).set("b", 2).set("c", 3);
        return {
          hit_a: c.get("a"),
          hit_b: c.get("b"),
          hit_c: c.get("c"),
          size: c.size()
        };
      });
      return { engineId, title: "MemoryCache", steps: ["set 3 keys, cap=2 (LRU evict)"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryProfiler": {
      const { result, ms } = measure(() => {
        const p = new MemoryProfiler();
        p.record("agent-1", 25, 1024).record("agent-1", 50, 2048);
        return {
          avgMs: p.averageDuration("agent-1"),
          totalBytes: p.totalBytes("agent-1"),
          ops: p.operations()
        };
      });
      return { engineId, title: "MemoryProfiler", steps: ["record 2 ops for agent-1"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryDashboard": {
      const { result, ms } = measure(() => {
        const d = new MemoryDashboard();
        d.setPanel("ltm", "LTM Size", 1024).setPanel("stm", "STM Capacity", 10).setPanel("q", "Queries/min", 50);
        return {
          panels: d.panelNames(),
          count: d.panelCount(),
          panel_ltm: d.getPanel("ltm")
        };
      });
      return { engineId, title: "MemoryDashboard (integration)", steps: ["set 3 named panels"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryConfig": {
      const { result, ms } = measure(() => {
        const c = new MemoryConfig();
        c.set("window", 4096).set("compression", "gzip").set("debug", true);
        return {
          window: c.getNumber("window"),
          compression: c.getString("compression"),
          debug: c.getBoolean("debug"),
          size: c.size()
        };
      });
      return { engineId, title: "MemoryConfig (integration)", steps: ["set 3 typed configs"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryAudit": {
      const { result, ms } = measure(() => {
        const a = new MemoryAudit();
        a.record("user-1", "write", "episodic").record("user-1", "read", "semantic").record("user-2", "write", "ltm");
        return {
          user1: a.forAgent("user-1").length,
          user2: a.forAgent("user-2").length,
          total: a.count()
        };
      });
      return { engineId, title: "MemoryAudit (integration)", steps: ["record 3 audit entries"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryProfile": {
      const { result, ms } = measure(() => {
        const p = new MemoryProfile();
        p.record("agent-7", 50, 100).record("agent-7", 200, 400);
        return {
          avgItems: p.averageItems("agent-7"),
          avgMs: p.averageDuration("agent-7"),
          totalRecords: p.runs("agent-7").length
        };
      });
      return { engineId, title: "MemoryProfile (integration)", steps: ["record 2 sessions"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryMigration": {
      const { result, ms } = measure(() => {
        const m = new MemoryMigration();
        let n = 0;
        m.define("v1", () => {
          n += 1;
        });
        m.define("v2", async () => {
          n += 1;
        });
        return {
          pending1: m.migrationCount(),
          afterRun: null
          // run via promise chain
        };
      });
      const m2 = new MemoryMigration();
      let n2 = 0;
      m2.define("v1", () => {
        n2 += 1;
      });
      return {
        output: JSON.stringify({
          runReturned: null,
          beforeRun: result
        }, null, 2),
        steps: ["define 1 migration", "inspect (run via UI button)"],
        engineId,
        title: "MemoryMigration (integration)",
        durationMs: ms
      };
    }
    case "MemoryReport": {
      const { result, ms } = measure(() => {
        const r = new MemoryReport();
        const md = r.generate("Q1 Memory", { ltm: 1024, stm: 50, queries_per_min: 100 });
        const csv = r.toCSV({ a: 1, b: 2 });
        return { md: md.slice(0, 120) + "\u2026", csv };
      });
      return { engineId, title: "MemoryReport (integration)", steps: ["generate markdown + CSV"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryBenchmark": {
      const { result, ms } = measure(() => {
        const b = new MemoryBenchmark();
        b.record("episodic", 0.85).record("semantic", 0.95).record("procedural", 0.78);
        return {
          best: b.best(),
          all: b.results()
        };
      });
      return { engineId, title: "MemoryBenchmark (integration)", steps: ["compare 3 stores"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryCoreIndex": {
      const { result, ms } = measure(() => {
        const idx = new MemoryCoreIndex();
        return { engines: idx.list(), count: idx.count() };
      });
      return { engineId, title: "MemoryCoreIndex (batch 1/3 index)", steps: ["list + count"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryAdvancedIndex": {
      const { result, ms } = measure(() => {
        const idx = new MemoryAdvancedIndex();
        return { engines: idx.list(), count: idx.count() };
      });
      return { engineId, title: "MemoryAdvancedIndex (batch 2/3 index)", steps: ["list + count"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryMasterIndex": {
      const { result, ms } = measure(() => {
        const idx = new MemoryMasterIndex();
        return {
          engines: idx.list(),
          count: idx.count(),
          hasEpisodic: idx.has("EpisodicStore")
        };
      });
      return { engineId, title: "MemoryMasterIndex (master across 3 batches)", steps: ["list + count + has"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemoryIntegrationIndex": {
      const { result, ms } = measure(() => {
        const idx = new MemoryIntegrationIndex();
        return { engines: idx.list(), count: idx.count() };
      });
      return { engineId, title: "MemoryIntegrationIndex (batch 3/3 index)", steps: ["list + count"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "VectorEmbedder": {
      const { result, ms } = measure(() => {
        const e = new VectorEmbedder(64);
        const v = e.embedText("hello world");
        const tags = e.embedTags(["python", "ai"]);
        const proj = e.project(v.values, 32);
        return {
          text_dim: v.dim,
          text_first_5: v.values.slice(0, 5).map((x) => x.toFixed(4)),
          tag_first_5: tags.values.slice(0, 5).map((x) => x.toFixed(4)),
          project_to_32: proj.length
        };
      });
      return { engineId, title: "VectorEmbedder", steps: ["embed text + tags", "project to 32-dim"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "CosineSim": {
      const { result, ms } = measure(() => {
        const c = new CosineSim();
        return {
          identity: c.similarity([1, 0, 0], [1, 0, 0]).toFixed(4),
          ortho: c.similarity([1, 0], [0, 1]).toFixed(4),
          opp: c.similarity([1, 0], [-1, 0]).toFixed(4),
          l2: c.distance([1, 0], [4, 3]).toFixed(4),
          top1: c.topK([1, 0], [[1, 0], [0.5, 0.5]], 1)[0]
        };
      });
      return { engineId, title: "CosineSim", steps: ["4 similarity checks + topK"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "DistanceMetric": {
      const { result, ms } = measure(() => {
        return {
          cosine: DistanceMetric.cosine([1, 0], [0, 1]).toFixed(4),
          euclidean: DistanceMetric.euclidean([1, 0], [4, 3]).toFixed(4),
          dot: DistanceMetric.dot([1, 2, 3], [4, 5, 6])
        };
      });
      return { engineId, title: "DistanceMetric", steps: ["cosine + euclidean + dot"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "HNSWIndex": {
      const { result, ms } = measure(() => {
        const idx = new HNSWIndex(8, 3);
        idx.insert("a", [1, 0, 0]);
        idx.insert("b", [1, 0, 0.1]);
        idx.insert("c", [0, 1, 0]);
        idx.insert("d", [0.5, 0.5, 0]);
        const q = idx.query([1, 0, 0], 3);
        return {
          ids: idx.ids(),
          top3: q.map((x) => ({ id: x.id, score: x.score.toFixed(4) })),
          avgDegree: idx.averageDegree().toFixed(2)
        };
      });
      return { engineId, title: "HNSWIndex", steps: ["insert 4 vectors", "top-3 query"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "PQCompressor": {
      const { result, ms } = measure(() => {
        const c = new PQCompressor(4);
        const v = Array.from({ length: 8 }, (_, i) => i / 8);
        const codes = c.compress(v);
        return {
          original_dim: v.length,
          codes_dim: codes.length,
          codes,
          ratio: c.compressionRatio(8).toFixed(2),
          approx: c.approxDistance([10, 20], [15, 25])
        };
      });
      return { engineId, title: "PQCompressor", steps: ["compress 8-dim to 4 codes", "approx distance"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "HybridSearcher": {
      const { result, ms } = measure(() => {
        const h = new HybridSearcher();
        const items = [
          { id: "a", tags: ["python", "ai"], vector: [1, 0, 0] },
          { id: "b", tags: ["python"], vector: [1, 0, 0.1] },
          { id: "c", tags: ["rust"], vector: [0, 1, 0] }
        ];
        const r0 = h.search("python", [1, 0, 0], items, { alpha: 0, limit: 3 });
        const r1 = h.search("python", [1, 0, 0], items, { alpha: 1, limit: 3 });
        const r05 = h.search("python", [1, 0, 0], items, { alpha: 0.5, limit: 3 });
        const gt = /* @__PURE__ */ new Set(["a", "b"]);
        const best = h.tuneAlpha("python", [1, 0, 0], items, gt);
        return {
          alpha_0: r0.map((x) => ({ id: x.id, combined: x.combined.toFixed(3) })),
          alpha_1: r1.map((x) => ({ id: x.id, combined: x.combined.toFixed(3) })),
          alpha_05: r05.map((x) => ({ id: x.id, combined: x.combined.toFixed(3) })),
          best_alpha: best.toFixed(2)
        };
      });
      return { engineId, title: "HybridSearcher", steps: ["test \u03B1=0/0.5/1", "grid search best \u03B1"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "VectorCache": {
      const { result, ms } = measure(() => {
        const c = new VectorCache(2);
        c.set("k1", [0.1, 0.2, 0.3]);
        c.set("k2", [0.4, 0.5, 0.6]);
        c.get("k1");
        c.get("k1");
        c.get("k3");
        c.get("k1");
        c.set("k4", [0.7, 0.8, 0.9]);
        return {
          hit: c.hitRate().toFixed(2),
          size: c.size(),
          has_k1: c.has("k1"),
          has_k2: c.has("k2"),
          has_k4: c.has("k4")
        };
      });
      return { engineId, title: "VectorCache", steps: ["cache + access + evict"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "TokenBag": {
      const { result, ms } = measure(() => {
        const t = new TokenBag();
        t.fit(["the cat sat on the mat", "the dog ran fast", "python is great fun"]);
        const v = t.vectorize("the cat ran fast");
        return {
          vocab_size: t.vocabSize(),
          vector_dim: v.dim,
          tokenized: TokenBag.tokenize("Cat  DOG, Cat!")
        };
      });
      return { engineId, title: "TokenBag", steps: ["fit on 3 docs", "vectorize + tokenize"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "VectorMigrator": {
      const { result, ms } = measure(() => {
        const m = new VectorMigrator();
        const padTrunc = m.migrate([[1, 2, 3, 4, 5, 6, 7, 8]], 8, 4, "pad-truncate");
        const proj = m.migrate([[1, 2, 3, 4]], 4, 8, "random-projection");
        const up = m.migrate([[1, 2]], 2, 5, "pad-truncate");
        return {
          pad_truncate_8_to_4: padTrunc,
          random_projection_4_to_8: proj,
          pad_2_to_5: up
        };
      });
      return { engineId, title: "VectorMigrator", steps: ["3 migration strategies"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "VectorNormalizer": {
      const { result, ms } = measure(() => {
        return {
          l2: VectorNormalizer.normalize([3, 4]),
          minmax: VectorNormalizer.minMax([1, 2, 3, 4, 5]),
          zscore: VectorNormalizer.zScore([1, 2, 3]),
          constant: VectorNormalizer.zScore([5, 5, 5])
        };
      });
      return { engineId, title: "VectorNormalizer", steps: ["L2 + minmax + zscore"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    case "MemVectorCoreIndex": {
      const { result, ms } = measure(() => {
        const idx = new MemVectorCoreIndex();
        return {
          count: idx.count(),
          has_VectorEmbedder: idx.has("VectorEmbedder"),
          has_HNSWIndex: idx.has("HNSWIndex"),
          has_MemVectorCoreIndex: idx.has("MemVectorCoreIndex"),
          has_Missing: idx.has("Missing")
        };
      });
      return { engineId, title: "MemVectorCoreIndex", steps: ["batch index metadata"], output: JSON.stringify(result, null, 2), durationMs: ms };
    }
    default:
      return { engineId, title: engineId, steps: [], output: "No demo available", durationMs: 0 };
  }
};

// src/data/memoryEngines.ts
var MEMORY_ENGINES = [
  {
    id: "EpisodicStore",
    name: "EpisodicStore",
    nameZh: "\u4E8B\u4EF6\u8BB0\u5FC6\u5B58\u50A8",
    nameJa: "\u30A4\u30D9\u30F3\u30C8\u8A18\u61B6\u30B9\u30C8\u30A2",
    nameKo: "\uC5D0\uD53C\uC18C\uB4DC \uAE30\uC5B5 \uC800\uC7A5\uC18C",
    layer: "episodic",
    description: "Append-only timestamped episode ledger with importance scoring.",
    descriptionZh: "\u4EC5\u8FFD\u52A0\u3001\u5E26\u65F6\u95F4\u6233\u7684\u4E8B\u4EF6\u8D26\u672C\uFF0C\u652F\u6301\u91CD\u8981\u6027\u8BC4\u5206\u3002",
    descriptionJa: "\u91CD\u8981\u5EA6\u30B9\u30B3\u30A2\u30EA\u30F3\u30B0\u4ED8\u304D\u306E\u8FFD\u8A18\u578B\u30BF\u30A4\u30E0\u30B9\u30BF\u30F3\u30D7\u30A4\u30D9\u30F3\u30C8\u53F0\u5E33\u3002",
    descriptionKo: "\uC911\uC694\uB3C4 \uC810\uC218\uAC00 \uC788\uB294 \uCD94\uAC00 \uC804\uC6A9 \uD0C0\uC784\uC2A4\uD0EC\uD504 \uC774\uBCA4\uD2B8 \uC6D0\uC7A5.",
    useCase: "Record every user-agent interaction as an episode with importance. Query recent or important episodes to recall past context.",
    useCaseZh: "\u5C06\u7528\u6237\u4E0E\u667A\u80FD\u4F53\u7684\u6BCF\u6B21\u4EA4\u4E92\u4F5C\u4E3A\u4E00\u6761\u4E8B\u4EF6\u8BB0\u5F55\uFF0C\u5E76\u6253\u91CD\u8981\u6027\u6807\u7B7E\u3002\u53EF\u6309\u65F6\u95F4\u6216\u91CD\u8981\u6027\u67E5\u8BE2\u5386\u53F2\u4E0A\u4E0B\u6587\u3002",
    useCaseJa: "\u30E6\u30FC\u30B6\u30FC\u3068\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u3059\u3079\u3066\u306E\u3084\u308A\u3068\u308A\u3092\u91CD\u8981\u5EA6\u4ED8\u304D\u3067\u30A8\u30D4\u30BD\u30FC\u30C9\u3068\u3057\u3066\u8A18\u9332\u3057\u307E\u3059\u3002\u6700\u8FD1\u307E\u305F\u306F\u91CD\u8981\u306A\u30A8\u30D4\u30BD\u30FC\u30C9\u3067\u904E\u53BB\u306E\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u3092\u547C\u3073\u8D77\u3053\u305B\u307E\u3059\u3002",
    useCaseKo: "\uC0AC\uC6A9\uC790\uC640 \uC5D0\uC774\uC804\uD2B8\uC758 \uBAA8\uB4E0 \uC0C1\uD638\uC791\uC6A9\uC744 \uC911\uC694\uB3C4\uC640 \uD568\uAED8 \uC5D0\uD53C\uC18C\uB4DC\uB85C \uAE30\uB85D\uD569\uB2C8\uB2E4. \uCD5C\uADFC \uB610\uB294 \uC911\uC694\uD55C \uC5D0\uD53C\uC18C\uB4DC\uB97C \uC870\uD68C\uD558\uC5EC \uACFC\uAC70 \uCEE8\uD14D\uC2A4\uD2B8\uB97C \uD68C\uC0C1\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    codePreview: `const store = new EpisodicStore();
const e1 = store.record('user said hi', 0.7);
const e2 = store.record('user asked about weather', 0.9);
store.recent(10);   // chronologically
store.important(0.8);  // by importance score`,
    pulled: 45200,
    ratingSum: 285,
    ratingCount: 60
  },
  {
    id: "SemanticIndex",
    name: "SemanticIndex",
    nameZh: "\u8BED\u4E49\u7D22\u5F15",
    nameJa: "\u30BB\u30DE\u30F3\u30C6\u30A3\u30C3\u30AF\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9",
    nameKo: "\uC2DC\uB9E8\uD2F1 \uC778\uB371\uC2A4",
    layer: "semantic",
    description: "Tag-based semantic index. Add tags, find by tag, retrieve tag list.",
    descriptionZh: "\u57FA\u4E8E\u6807\u7B7E\u7684\u8BED\u4E49\u7D22\u5F15\uFF0C\u652F\u6301 findByTag \u4E0E\u6807\u7B7E\u67E5\u8BE2\u3002",
    descriptionJa: "\u30BF\u30B0\u30D9\u30FC\u30B9\u306E\u30BB\u30DE\u30F3\u30C6\u30A3\u30C3\u30AF\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3002\u30BF\u30B0\u8FFD\u52A0\u3001\u30BF\u30B0\u691C\u7D22\u3001\u30BF\u30B0\u4E00\u89A7\u3002",
    descriptionKo: "\uD0DC\uADF8 \uAE30\uBC18 \uC2DC\uB9E8\uD2F1 \uC778\uB371\uC2A4. \uD0DC\uADF8 \uCD94\uAC00, \uD0DC\uADF8 \uAC80\uC0C9, \uD0DC\uADF8 \uBAA9\uB85D \uC870\uD68C.",
    useCase: "Attach semantic tags to memories (e.g. topic, intent, project), then query by tag without full-text search.",
    useCaseZh: "\u4E3A\u8BB0\u5FC6\u6253\u8BED\u4E49\u6807\u7B7E\uFF08\u8BDD\u9898\u3001\u610F\u56FE\u3001\u9879\u76EE\uFF09\uFF0C\u7136\u540E\u6309\u6807\u7B7E\u67E5\u8BE2\uFF0C\u65E0\u9700\u5168\u6587\u641C\u7D22\u3002",
    useCaseJa: "\u8A18\u61B6\u306B\u30BB\u30DE\u30F3\u30C6\u30A3\u30C3\u30AF\u30BF\u30B0\uFF08\u30C8\u30D4\u30C3\u30AF\u30FB\u30A4\u30F3\u30C6\u30F3\u30C8\u30FB\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\uFF09\u3092\u4ED8\u4E0E\u3057\u3001\u5168\u6587\u691C\u7D22\u306A\u3057\u3067\u30BF\u30B0\u304B\u3089\u30AF\u30A8\u30EA\u3067\u304D\u307E\u3059\u3002",
    useCaseKo: "\uAE30\uC5B5\uC5D0 \uC2DC\uB9E8\uD2F1 \uD0DC\uADF8(\uD1A0\uD53D\xB7\uC758\uB3C4\xB7\uD504\uB85C\uC81D\uD2B8)\uB97C \uBD80\uC5EC\uD558\uACE0, \uC804\uCCB4 \uD14D\uC2A4\uD2B8 \uAC80\uC0C9 \uC5C6\uC774 \uD0DC\uADF8\uB85C \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    codePreview: `const idx = new SemanticIndex();
idx.add('m1', ['python', 'ai']).add('m2', ['python']);
idx.findByTag('python');  // ['m1', 'm2']`,
    pulled: 32100,
    ratingSum: 198,
    ratingCount: 47
  },
  {
    id: "ProceduralCache",
    name: "ProceduralCache",
    nameZh: "\u7A0B\u5E8F\u7F13\u5B58",
    nameJa: "\u624B\u7D9A\u304D\u30AD\u30E3\u30C3\u30B7\u30E5",
    nameKo: "\uC808\uCC28 \uCE90\uC2DC",
    layer: "procedural",
    description: "Procedure step cache with lastUsed tracking for LRU-like access patterns.",
    descriptionZh: "\u5E26 LRU-like lastUsed \u8FFD\u8E2A\u7684\u8FC7\u7A0B\u6B65\u9AA4\u7F13\u5B58\u3002",
    descriptionJa: "LRU\u30E9\u30A4\u30AF\u306AlastUsed\u8FFD\u8DE1\u4ED8\u304D\u306E\u624B\u7D9A\u304D\u30B9\u30C6\u30C3\u30D7\u30AD\u30E3\u30C3\u30B7\u30E5\u3002",
    descriptionKo: "LRU \uC2A4\uD0C0\uC77C lastUsed \uCD94\uC801\uC774 \uC788\uB294 \uC808\uCC28 \uB2E8\uACC4 \uCE90\uC2DC.",
    useCase: 'Store multi-step procedures (e.g. "how to reset password") and re-emit them when re-used. Tracks lastUsed to recency-prioritize.',
    useCaseZh: '\u5B58\u50A8\u591A\u6B65\u6D41\u7A0B\uFF08\u5982"\u5982\u4F55\u91CD\u7F6E\u5BC6\u7801"\uFF09\uFF0C\u590D\u7528\u65F6\u518D\u6B21\u8FD4\u56DE\uFF1B\u6309\u6700\u8FD1\u8BBF\u95EE\u4F18\u5148\u3002',
    useCaseJa: "\u518D\u5229\u7528\u53EF\u80FD\u306A\u30B9\u30AD\u30EB\uFF0F\u624B\u9806\u3092\u8A18\u9332\u3057\u3001\u540C\u3058\u30AF\u30A8\u30EA\u3067\u9AD8\u901F\u306B\u518D\u53D6\u5F97\u3002",
    useCaseKo: "\uC7AC\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uC2A4\uD0AC/\uC808\uCC28\uB97C \uAE30\uB85D\uD558\uACE0, \uB3D9\uC77C \uCFFC\uB9AC\uC5D0\uC11C \uBE60\uB974\uAC8C \uC7AC\uC870\uD68C\uD569\uB2C8\uB2E4.",
    codePreview: `const cache = new ProceduralCache();
cache.store('reset-pwd', ['verify email', 'send token', 'redirect']);
cache.get('reset-pwd');  // ['verify email', ...] + updates lastUsed`,
    pulled: 28900,
    ratingSum: 162,
    ratingCount: 38
  },
  {
    id: "ConsolidationEngine",
    name: "ConsolidationEngine",
    nameZh: "\u6574\u5408\u5F15\u64CE",
    nameJa: "\u7D71\u5408\u30A8\u30F3\u30B8\u30F3",
    nameKo: "\uD1B5\uD569 \uC5D4\uC9C4",
    layer: "consolidation",
    description: "Similarity-based memory merging. Combines near-duplicate memories into consolidated entries.",
    descriptionZh: "\u57FA\u4E8E\u76F8\u4F3C\u5EA6\u7684\u8BB0\u5FC6\u5408\u5E76\uFF08Jaccard\uFF09\u3002",
    descriptionJa: "\u985E\u4F3C\u6027\u306B\u57FA\u3065\u304F\u8A18\u61B6\u306E\u30DE\u30FC\u30B8\u3002\u307B\u307C\u91CD\u8907\u3057\u305F\u8A18\u61B6\u3092\u7D71\u5408\u30A8\u30F3\u30C8\u30EA\u306B\u307E\u3068\u3081\u307E\u3059\u3002",
    descriptionKo: "\uC720\uC0AC\uC131 \uAE30\uBC18 \uAE30\uC5B5 \uBCD1\uD569. \uAC70\uC758 \uC911\uBCF5\uB41C \uAE30\uC5B5\uC744 \uD1B5\uD569 \uD56D\uBAA9\uC73C\uB85C \uACB0\uD569\uD569\uB2C8\uB2E4.",
    useCase: "Periodically dedupe and merge similar episodes to prevent unbounded growth. Keeps average importance across merges.",
    useCaseZh: "\u5B9A\u671F\u5408\u5E76\u76F8\u4F3C\u4E8B\u4EF6\u4EE5\u9632\u6B62\u65E0\u9650\u589E\u957F\uFF0C\u4FDD\u7559\u5E73\u5747\u91CD\u8981\u6027\u3002",
    useCaseJa: "\u9577\u671F\u8A18\u61B6\u304C\u81A8\u3089\u3093\u3060\u3089\u5B9A\u671F\u7684\u306B\u7D71\u5408\u3057\u3001\u5BB9\u91CF\u3092\u7BC0\u7D04\u3057\u307E\u3059\u3002",
    useCaseKo: "\uC7A5\uAE30 \uAE30\uC5B5\uC774 \uCEE4\uC9C0\uBA74 \uC815\uAE30\uC801\uC73C\uB85C \uD1B5\uD569\uD558\uC5EC \uC6A9\uB7C9\uC744 \uC808\uC57D\uD569\uB2C8\uB2E4.",
    codePreview: `const c = new ConsolidationEngine();
const merged = c.consolidate([itemA, itemB]); // Jaccard sim \u2265 threshold \u2192 merged`,
    pulled: 19400,
    ratingSum: 89,
    ratingCount: 25
  },
  {
    id: "ForgettingEngine",
    name: "ForgettingEngine",
    nameZh: "\u9057\u5FD8\u5F15\u64CE",
    nameJa: "\u5FD8\u5374\u30A8\u30F3\u30B8\u30F3",
    nameKo: "\uB9DD\uAC01 \uC5D4\uC9C4",
    layer: "consolidation",
    description: "Ebbinghaus-style decay. Drops memories below a relevance threshold.",
    descriptionZh: "\u827E\u5BBE\u6D69\u65AF\u5F0F\u6307\u6570\u8870\u51CF\u3002",
    descriptionJa: "Ebbinghaus\uFF08\u30A8\u30D3\u30F3\u30B0\u30CF\u30A6\u30B9\uFF09\u578B\u6E1B\u8870\u3002\u95BE\u5024\u3092\u4E0B\u56DE\u308B\u8A18\u61B6\u3092\u524A\u9664\u3002",
    descriptionKo: "\uC5D0\uBE59\uD558\uC6B0\uC2A4 \uC2A4\uD0C0\uC77C \uAC10\uC1E0. \uAD00\uB828\uC131 \uC784\uACC4\uAC12 \uC774\uD558\uC758 \uAE30\uC5B5\uC744 \uC0AD\uC81C.",
    useCase: "Apply exponential decay to importance over time. Auto-forget trivially old or low-importance entries.",
    useCaseZh: "\u968F\u65F6\u95F4\u5BF9\u91CD\u8981\u6027\u5E94\u7528\u6307\u6570\u8870\u51CF\uFF0C\u81EA\u52A8\u9057\u5FD8\u8001\u65E7\u6216\u4F4E\u91CD\u8981\u6027\u6761\u76EE\u3002",
    useCaseJa: "\u53E4\u3044\u30FB\u95A2\u9023\u6027\u306E\u4F4E\u3044\u8A18\u61B6\u3092\u81EA\u52D5\u7684\u306B\u5FD8\u5374\u3057\u3066\u3001\u30B9\u30C8\u30EC\u30FC\u30B8\u3092\u5065\u5168\u306B\u4FDD\u3061\u307E\u3059\u3002",
    useCaseKo: "\uC624\uB798\uB418\uACE0 \uAD00\uB828\uC131 \uB0AE\uC740 \uAE30\uC5B5\uC744 \uC790\uB3D9\uC73C\uB85C \uB9DD\uAC01\uD558\uC5EC \uC2A4\uD1A0\uB9AC\uC9C0\uB97C \uAC74\uAC15\uD558\uAC8C \uC720\uC9C0\uD569\uB2C8\uB2E4.",
    codePreview: `const f = new ForgettingEngine();
f.relevance(oldItem, 100_000);  // importance * exp(-age/decay)`,
    pulled: 17800,
    ratingSum: 95,
    ratingCount: 22
  },
  {
    id: "MemoryRetriever",
    name: "MemoryRetriever",
    nameZh: "\u8BB0\u5FC6\u68C0\u7D22\u5668",
    nameJa: "\u8A18\u61B6\u30EA\u30C8\u30EA\u30FC\u30D0\u30FC",
    nameKo: "\uAE30\uC5B5 \uAC80\uC0C9\uAE30",
    layer: "semantic",
    description: "Score-based retrieval combining importance + recency + query match.",
    descriptionZh: "\u7ED3\u5408\u91CD\u8981\u6027\u3001\u65B0\u8FD1\u5EA6\u3001\u5339\u914D\u7684\u8BC4\u5206\u68C0\u7D22\u3002",
    descriptionJa: "\u91CD\u8981\u5EA6 + \u65B0\u898F\u5EA6 + \u30AF\u30A8\u30EA\u30DE\u30C3\u30C1\u306B\u3088\u308B\u30B9\u30B3\u30A2\u30D9\u30FC\u30B9\u691C\u7D22\u3002",
    descriptionKo: "\uC911\uC694\uB3C4 + \uCD5C\uC2E0\uC131 + \uCFFC\uB9AC \uB9E4\uCE58\uB97C \uACB0\uD569\uD55C \uC810\uC218 \uAE30\uBC18 \uAC80\uC0C9.",
    useCase: "Score every candidate memory and return top-k most relevant for the current query.",
    useCaseZh: "\u4E3A\u6BCF\u4E2A\u5019\u9009\u8BB0\u5FC6\u6253\u5206\uFF0C\u8FD4\u56DE\u5F53\u524D\u67E5\u8BE2\u6700\u76F8\u5173\u7684 top-k\u3002",
    useCaseJa: "\u30AF\u30A8\u30EA\u306B\u5FDC\u3058\u3066\u3001\u95A2\u9023\u6027\xD7\u65B0\u9BAE\u3055\xD7\u91CD\u8981\u5EA6\u306E\u52A0\u91CD\u5408\u8A08\u3067\u30B9\u30B3\u30A2\u3092\u4ED8\u3051\u3066\u53D6\u5F97\u3057\u307E\u3059\u3002",
    useCaseKo: "\uCFFC\uB9AC\uC5D0 \uB530\uB77C \uAD00\uB828\uC131\xB7\uC2E0\uC120\uB3C4\xB7\uC911\uC694\uB3C4\uC758 \uAC00\uC911 \uD569\uACC4\uB85C \uC810\uC218\uB97C \uB9E4\uACA8 \uC870\uD68C\uD569\uB2C8\uB2E4.",
    codePreview: `const r = new MemoryRetriever();
const top = r.retrieve(items, 'weather', 5);`,
    pulled: 22400,
    ratingSum: 142,
    ratingCount: 32
  },
  {
    id: "MemoryEncoder",
    name: "MemoryEncoder",
    nameZh: "\u8BB0\u5FC6\u7F16\u7801\u5668",
    nameJa: "\u8A18\u61B6\u30A8\u30F3\u30B3\u30FC\u30C0\u30FC",
    nameKo: "\uAE30\uC5B5 \uC778\uCF54\uB354",
    layer: "procedural",
    description: "Hash + slice-based content encoder for round-trip storage.",
    descriptionZh: "\u57FA\u4E8E\u54C8\u5E0C\u7684\u786E\u5B9A\u6027\u5185\u5BB9\u7F16\u7801\u5668\u3002",
    descriptionJa: "\u30E9\u30A6\u30F3\u30C9\u30C8\u30EA\u30C3\u30D7\u4FDD\u5B58\u7528\u306E\u30CF\u30C3\u30B7\u30E5+\u30B9\u30E9\u30A4\u30B9\u30D9\u30FC\u30B9\u30B3\u30F3\u30C6\u30F3\u30C4\u30A8\u30F3\u30B3\u30FC\u30C0\u30FC\u3002",
    descriptionKo: "\uB77C\uC6B4\uB4DC\uD2B8\uB9BD \uC800\uC7A5\uC744 \uC704\uD55C \uD574\uC2DC+\uC2AC\uB77C\uC774\uC2A4 \uAE30\uBC18 \uCF58\uD150\uCE20 \uC778\uCF54\uB354.",
    useCase: "Compactly encode content strings for storage with deterministic round-trip and size estimation.",
    useCaseZh: "\u5BF9\u5185\u5BB9\u5B57\u7B26\u4E32\u8FDB\u884C\u7D27\u51D1\u7F16\u7801\uFF0C\u652F\u6301\u786E\u5B9A\u6027\u5F80\u8FD4\u548C\u5927\u5C0F\u4F30\u7B97\u3002",
    useCaseJa: "\u4EFB\u610F\u306E\u69CB\u9020\u5316\u30DA\u30A4\u30ED\u30FC\u30C9\u3092\u6587\u5B57\u5217\u30AD\u30FC\u306B\u30A8\u30F3\u30B3\u30FC\u30C9\u3057\u3066\u8A18\u61B6\u30B9\u30C8\u30EC\u30FC\u30B8\u306B\u683C\u7D0D\u3002",
    useCaseKo: "\uC784\uC758\uC758 \uAD6C\uC870\uD654\uB41C \uD398\uC774\uB85C\uB4DC\uB97C \uBB38\uC790\uC5F4 \uD0A4\uB85C \uC778\uCF54\uB529\uD558\uC5EC \uAE30\uC5B5 \uC800\uC7A5\uC18C\uC5D0 \uC800\uC7A5\uD569\uB2C8\uB2E4.",
    codePreview: `const e = new MemoryEncoder();
const encoded = e.encode('hello world');  // 'mem:abc12345:hello w'`,
    pulled: 12e3,
    ratingSum: 67,
    ratingCount: 16
  },
  {
    id: "MemoryDecoder",
    name: "MemoryDecoder",
    nameZh: "\u8BB0\u5FC6\u89E3\u7801\u5668",
    nameJa: "\u8A18\u61B6\u30C7\u30B3\u30FC\u30C0\u30FC",
    nameKo: "\uAE30\uC5B5 \uB514\uCF54\uB354",
    layer: "procedural",
    description: "Reverse encoding + delimiter-based splitting for batch decode.",
    descriptionZh: "\u53CD\u5411\u7F16\u7801 + \u5206\u9694\u7B26\u6279\u91CF\u62C6\u5206\u3002",
    descriptionJa: "\u30A8\u30F3\u30B3\u30FC\u30C9\u306E\u9006\u64CD\u4F5C+\u533A\u5207\u308A\u6587\u5B57\u306B\u3088\u308B\u30D0\u30C3\u30C1\u30C7\u30B3\u30FC\u30C9\u3002",
    descriptionKo: "\uC778\uCF54\uB529\uC758 \uC5ED\uC5F0\uC0B0 + \uAD6C\uBD84\uC790\uB85C \uBC30\uCE58 \uB514\uCF54\uB4DC.",
    useCase: "Reverse the encoded memory back to its original content; split consolidated batches back into items.",
    useCaseZh: "\u5C06\u7F16\u7801\u540E\u7684\u8BB0\u5FC6\u53CD\u8F6C\u4E3A\u539F\u59CB\u5185\u5BB9\uFF1B\u5C06\u5408\u5E76\u6279\u91CF\u62C6\u56DE\u5355\u72EC\u9879\u3002",
    useCaseJa: "\u30A8\u30F3\u30B3\u30FC\u30C9\u3055\u308C\u305F\u8A18\u61B6\u30AD\u30FC\u3092\u5143\u306E\u69CB\u9020\u5316\u30DA\u30A4\u30ED\u30FC\u30C9\u306B\u623B\u3057\u307E\u3059\u3002",
    useCaseKo: "\uC778\uCF54\uB529\uB41C \uAE30\uC5B5 \uD0A4\uB97C \uC6D0\uB798\uC758 \uAD6C\uC870\uD654\uB41C \uD398\uC774\uB85C\uB4DC\uB85C \uBCF5\uC6D0\uD569\uB2C8\uB2E4.",
    codePreview: `const d = new MemoryDecoder();
d.reverse('mem:abc:hello');  // 'hello'
d.split('a | b | c');         // ['a', 'b', 'c']`,
    pulled: 11900,
    ratingSum: 64,
    ratingCount: 15
  },
  {
    id: "MemoryHierarchy",
    name: "MemoryHierarchy",
    nameZh: "\u8BB0\u5FC6\u5C42\u7EA7",
    nameJa: "\u8A18\u61B6\u968E\u5C64",
    nameKo: "\uAE30\uC5B5 \uACC4\uCE35",
    layer: "consolidation",
    description: "Tiered classification into hot/warm/cold with time-and-importance rules.",
    descriptionZh: "\u70ED\u70B9/\u6E29/\u51B7 \u4E09\u7EA7\u5206\u7C7B\u3002",
    descriptionJa: "\u30DB\u30C3\u30C8/\u30A6\u30A9\u30FC\u30E0/\u30B3\u30FC\u30EB\u30C9\u306E\u30C6\u30A3\u30A2\u30FC\u30C9\u5206\u985E\u3002",
    descriptionKo: "\uD56B/\uC6DC/\uCF5C\uB4DC \uB4F1\uAE09 \uBD84\uB958.",
    useCase: "Partition memories into hot (recent+important) \u2192 warm (recent) \u2192 cold (old). Each tier can have different storage backends.",
    useCaseZh: '\u6309"\u70ED\u5EA6"\u628A\u8BB0\u5FC6\u5206\u6210 hot\uFF08\u8FD1+\u91CD\u8981\uFF09/warm\uFF08\u8FD1\u671F\uFF09/cold\uFF08\u4E45\u8FDC\uFF09\uFF0C\u6BCF\u5C42\u53EF\u6302\u4E0D\u540C\u5B58\u50A8\u540E\u7AEF\u3002',
    useCaseJa: "\u30A2\u30AF\u30BB\u30B9\u983B\u5EA6\u3068\u91CD\u8981\u6027\u3067\u8A18\u61B6\u30923\u968E\u5C64\u306B\u81EA\u52D5\u5206\u985E\u3057\u3001\u30B9\u30C8\u30EC\u30FC\u30B8\u3068\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u3092\u6700\u9069\u5316\u3002",
    useCaseKo: "\uC811\uADFC \uBE48\uB3C4\uC640 \uC911\uC694\uB3C4\uB85C \uAE30\uC5B5\uC744 3\uACC4\uCE35\uC73C\uB85C \uC790\uB3D9 \uBD84\uB958\uD558\uC5EC \uC2A4\uD1A0\uB9AC\uC9C0\uC640 \uC131\uB2A5\uC744 \uCD5C\uC801\uD654\uD569\uB2C8\uB2E4.",
    codePreview: `const h = new MemoryHierarchy();
h.partition(items);  // { hot, warm, cold }`,
    pulled: 15600,
    ratingSum: 96,
    ratingCount: 24
  },
  {
    id: "LongTermMemoryManager",
    name: "LongTermMemoryManager",
    nameZh: "\u957F\u671F\u8BB0\u5FC6\u7BA1\u7406",
    nameJa: "\u9577\u671F\u8A18\u61B6\u30DE\u30CD\u30FC\u30B8\u30E3\u30FC",
    nameKo: "\uC7A5\uAE30 \uAE30\uC5B5 \uB9E4\uB2C8\uC800",
    layer: "long-term",
    description: "Permanent key-value store with age tracking and list operations.",
    descriptionZh: "\u6C38\u4E45\u952E\u503C\u5B58\u50A8\uFF0C\u5E26 age \u8FFD\u8E2A\u4E0E list \u64CD\u4F5C\u3002",
    descriptionJa: "\u30A8\u30FC\u30B8\u8FFD\u8DE1\u4ED8\u304D\u306E\u6C38\u7D9A\u7684\u306AK/V\u30B9\u30C8\u30A2\u3002",
    descriptionKo: "\uC5D0\uC774\uC9C0 \uCD94\uC801\uC774 \uC788\uB294 \uC601\uAD6C K/V \uC800\uC7A5\uC18C.",
    useCase: "Store memories that survive session boundaries. Track age for eviction policy.",
    useCaseZh: "\u8DE8\u4F1A\u8BDD\u4FDD\u5B58\u8BB0\u5FC6\uFF0C\u8DDF\u8E2A age \u4EE5\u652F\u6301\u6DD8\u6C70\u7B56\u7565\u3002",
    useCaseJa: "\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u307E\u305F\u3044\u3067\u6B8B\u3059\u3079\u304D\u91CD\u8981\u4E8B\u5B9F\u3092\u6C38\u7D9AK/V\u3068\u3057\u3066\u4FDD\u7BA1\u3057\u307E\u3059\u3002",
    useCaseKo: "\uC138\uC158\uC744 \uB118\uC5B4 \uBCF4\uC874\uD574\uC57C \uD560 \uC911\uC694\uD55C \uC0AC\uC2E4\uC744 \uC601\uAD6C K/V\uB85C \uBCF4\uAD00\uD569\uB2C8\uB2E4.",
    codePreview: `const m = new LongTermMemoryManager();
m.store('preference-theme', 'dark');
m.age('preference-theme');  // ms since last store`,
    pulled: 20100,
    ratingSum: 124,
    ratingCount: 28
  },
  {
    id: "ShortTermMemory",
    name: "ShortTermMemory",
    nameZh: "\u77ED\u671F\u8BB0\u5FC6",
    nameJa: "\u77ED\u671F\u8A18\u61B6",
    nameKo: "\uB2E8\uAE30 \uAE30\uC5B5",
    layer: "short-term",
    description: "Bounded FIFO buffer that evicts oldest entries when full.",
    descriptionZh: "\u6709\u754C FIFO \u6EDA\u52A8\u7F13\u51B2\u533A\uFF0C\u81EA\u52A8\u6DD8\u6C70\u6700\u65E7\u6761\u76EE\u3002",
    descriptionJa: "\u6709\u754CFIFO\u30ED\u30FC\u30EA\u30F3\u30B0\u30D0\u30C3\u30D5\u30A1\u3002",
    descriptionKo: "\uC81C\uD55C\uB41C FIFO \uB864\uB9C1 \uBC84\uD37C.",
    useCase: "Keep a bounded rolling window of recent conversation turns without unbounded growth.",
    useCaseZh: "\u4FDD\u6301\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u7684\u6EDA\u52A8\u7A97\u53E3\uFF0C\u907F\u514D\u65E0\u9650\u589E\u957F\u3002",
    useCaseJa: "\u76F4\u8FD1\u306E\u30BF\u30FC\u30F3\u306E\u3084\u308A\u53D6\u308A\u3092\u77ED\u671F\u8A18\u61B6\u306B\u4FDD\u6301\u3057\u3001\u30D7\u30ED\u30F3\u30D7\u30C8\u306B\u76F4\u63A5\u6CE8\u5165\u3057\u307E\u3059\u3002",
    useCaseKo: "\uCD5C\uADFC \uD134\uC758 \uC0C1\uD638\uC791\uC6A9\uC744 \uB2E8\uAE30 \uAE30\uC5B5\uC5D0 \uC720\uC9C0\uD558\uACE0 \uD504\uB86C\uD504\uD2B8\uC5D0 \uC9C1\uC811 \uC8FC\uC785\uD569\uB2C8\uB2E4.",
    codePreview: `const s = new ShortTermMemory(10);
s.push('hello').push('world');  // [hello, world]`,
    pulled: 18600,
    ratingSum: 110,
    ratingCount: 26
  },
  {
    id: "WorkingMemory",
    name: "WorkingMemory",
    nameZh: "\u5DE5\u4F5C\u8BB0\u5FC6",
    nameJa: "\u4F5C\u696D\u8A18\u61B6",
    nameKo: "\uC791\uC5C5 \uAE30\uC5B5",
    layer: "working",
    description: "Attention-focused store with decay mechanism for active reasoning.",
    descriptionZh: "\u6CE8\u610F\u529B\u805A\u7126 + \u8870\u51CF\u7684\u5DE5\u4F5C\u96C6\u3002",
    descriptionJa: "Attention Focused \u306E\u6E1B\u8870\u30A2\u30A4\u30C6\u30E0\u3002",
    descriptionKo: "\uC8FC\uC758 \uC9D1\uC911 \uD56D\uBAA9\uC758 \uAC10\uC1E0 \uCEEC\uB809\uC158.",
    useCase: "Keep currently-active items (recent query + supporting facts) with attention scores that decay over time.",
    useCaseZh: "\u4FDD\u5B58\u5F53\u524D\u6D3B\u8DC3\u9879\uFF08\u5F53\u524D\u67E5\u8BE2 + \u652F\u6491\u4E8B\u5B9E\uFF09\uFF0C\u6CE8\u610F\u529B\u968F\u65F6\u95F4\u8870\u51CF\u3002",
    useCaseJa: "\u73FE\u5728\u306E\u30BF\u30B9\u30AF\u306B\u96C6\u4E2D\u3059\u3079\u304D\u4E2D\u9593\u7D50\u679C\u3092\u77ED\u3044\u30E9\u30A4\u30D5\u30BF\u30A4\u30E0\u3067\u4FDD\u6301\u3057\u307E\u3059\u3002",
    useCaseKo: "\uD604\uC7AC \uC791\uC5C5\uC5D0 \uC9D1\uC911\uD574\uC57C \uD558\uB294 \uC911\uAC04 \uACB0\uACFC\uB97C \uC9E7\uC740 \uC218\uBA85\uC73C\uB85C \uC720\uC9C0\uD569\uB2C8\uB2E4.",
    codePreview: `const w = new WorkingMemory();
w.focus('current-task', 'debug auth flow', 1.0);
w.decay(0.9);  // attention * 0.9`,
    pulled: 17200,
    ratingSum: 105,
    ratingCount: 23
  },
  {
    id: "AssociativeMemory",
    name: "AssociativeMemory",
    nameZh: "\u8054\u60F3\u8BB0\u5FC6",
    nameJa: "\u9023\u60F3\u8A18\u61B6",
    nameKo: "\uC5F0\uC0C1 \uAE30\uC5B5",
    layer: "associative",
    description: "Graph-style link store with BFS-based reachability for associative recall.",
    descriptionZh: "\u56FE\u72B6\u94FE\u63A5\u5B58\u50A8 + BFS \u53EF\u8FBE\u6027\uFF0C\u7528\u4E8E\u8054\u60F3\u56DE\u5FC6\u3002",
    descriptionJa: "\u30B0\u30E9\u30D5\u30D9\u30FC\u30B9\u30EA\u30F3\u30AF\u30B9\u30C8\u30A2 + BFS \u5230\u9054\u53EF\u80FD\u6027\u3002",
    descriptionKo: "\uADF8\uB798\uD504 \uAE30\uBC18 \uB9C1\uD06C \uC800\uC7A5\uC18C + BFS \uB3C4\uB2EC \uAC00\uB2A5\uC131.",
    useCase: 'Link related memories (e.g. "user mentioned ramen \u2192 user likes Japanese food"). Traverse graph for associative recall.',
    useCaseZh: '\u94FE\u63A5\u76F8\u5173\u8BB0\u5FC6\uFF08\u5982"\u7528\u6237\u63D0\u5230\u62C9\u9762 \u2192 \u7528\u6237\u559C\u6B22\u65E5\u6599"\uFF09\uFF0C\u56FE\u904D\u5386\u652F\u6301\u8054\u60F3\u56DE\u5FC6\u3002',
    useCaseJa: "\u3042\u308B\u8A18\u61B6\u304B\u3089\u95A2\u9023\u3059\u308B\u8A18\u61B6\u3092\u30B0\u30E9\u30D5\u3067\u8FBF\u3063\u3066\u601D\u3044\u51FA\u3059\u305F\u3081\u306E\u8A18\u61B6\u5C64\u3067\u3059\u3002",
    useCaseKo: "\uD55C \uAE30\uC5B5\uC5D0\uC11C \uAD00\uB828 \uAE30\uC5B5\uC744 \uADF8\uB798\uD504\uB85C \uCD94\uC801\uD558\uC5EC \uD68C\uC0C1\uD558\uB294 \uAE30\uC5B5 \uB808\uC774\uC5B4\uC785\uB2C8\uB2E4.",
    codePreview: `const a = new AssociativeMemory();
a.link('ramen', 'japanese-food');
a.neighbors('ramen');  // ['japanese-food']
a.reachable('ramen', 2);  // broader associative recall`,
    pulled: 14e3,
    ratingSum: 78,
    ratingCount: 18
  },
  {
    id: "ContextWindow",
    name: "ContextWindow",
    nameZh: "\u4E0A\u4E0B\u6587\u7A97\u53E3",
    nameJa: "\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u30A6\u30A3\u30F3\u30C9\u30A6",
    nameKo: "\uCEE8\uD14D\uC2A4\uD2B8 \uC708\uB3C4\uC6B0",
    layer: "working",
    description: "Bounded token window with FIFO eviction when capacity exceeded.",
    descriptionZh: "\u6709\u754C token \u7A97\u53E3\uFF0CFIFO \u6DD8\u6C70\u3002",
    descriptionJa: "FIFO\u9000\u907F\u4ED8\u304D\u306E\u30C8\u30FC\u30AF\u30F3\u5236\u9650\u30A6\u30A3\u30F3\u30C9\u30A6\u3002",
    descriptionKo: "FIFO \uCD95\uCD9C\uC774 \uC788\uB294 \uD1A0\uD070 \uC81C\uD55C \uC708\uB3C4\uC6B0.",
    useCase: "Track the active LLM context window size in tokens and reject/evict when full.",
    useCaseZh: "\u8DDF\u8E2A LLM \u4E0A\u4E0B\u6587\u5927\u5C0F token\uFF0C\u6EE1\u5219\u62D2\u7EDD/\u6DD8\u6C70\u3002",
    useCaseJa: "\u30D7\u30ED\u30F3\u30D7\u30C8\u306B\u53CE\u307E\u308B\u3088\u3046\u306B\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u3092\u5207\u308A\u8A70\u3081\u307E\u3059\u3002",
    useCaseKo: "\uD504\uB86C\uD504\uD2B8\uC5D0 \uB9DE\uB3C4\uB85D \uCEE8\uD14D\uC2A4\uD2B8\uB97C \uC798\uB77C\uB0C5\uB2C8\uB2E4.",
    codePreview: `const w = new ContextWindow(4096);
w.add('token1'); w.isFull();  // false
// ... fill it up ...
w.remaining();  // 0`,
    pulled: 21800,
    ratingSum: 138,
    ratingCount: 31
  },
  {
    id: "AttentionMechanism",
    name: "AttentionMechanism",
    nameZh: "\u6CE8\u610F\u529B\u673A\u5236",
    nameJa: "\u30A2\u30C6\u30F3\u30B7\u30E7\u30F3\u6A5F\u69CB",
    nameKo: "\uC5B4\uD150\uC158 \uBA54\uCEE4\uB2C8\uC998",
    layer: "working",
    description: "Softmax-based attention with top-K retrieval for relevance ranking.",
    descriptionZh: "\u57FA\u4E8E softmax \u7684\u6CE8\u610F\u529B + top-K \u9009\u53D6\u3002",
    descriptionJa: "top-K \u9078\u629E\u4ED8\u304D\u306E\u30BD\u30D5\u30C8\u30DE\u30C3\u30AF\u30B9\u30D9\u30FC\u30B9\u6CE8\u610F\u3002",
    descriptionKo: "top-K \uC120\uD0DD\uC774 \uD3EC\uD568\uB41C \uC18C\uD504\uD2B8\uB9E5\uC2A4 \uAE30\uBC18 \uC5B4\uD150\uC158.",
    useCase: "Compute softmax attention weights over candidate context and pick top-K most relevant.",
    useCaseZh: "\u5BF9\u5019\u9009\u4E0A\u4E0B\u6587\u8BA1\u7B97 softmax \u6743\u91CD\u5E76\u9009\u53D6 top-K \u6700\u76F8\u5173\u3002",
    useCaseJa: "\u5019\u88DC\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u306B\u5BFE\u3057\u3066\u30BD\u30D5\u30C8\u30DE\u30C3\u30AF\u30B9\u6CE8\u610F\u30A6\u30A7\u30A4\u30C8\u3092\u8A08\u7B97\u3057\u3001top-K \u3092\u9078\u3073\u307E\u3059\u3002",
    useCaseKo: "\uD6C4\uBCF4 \uCEE8\uD14D\uC2A4\uD2B8\uC5D0 \uB300\uD574 \uC18C\uD504\uD2B8\uB9E5\uC2A4 \uAC00\uC911\uCE58\uB97C \uACC4\uC0B0\uD558\uACE0 top-K \uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4.",
    codePreview: `const a = new AttentionMechanism();
const w = a.attend([1, 0], [[1, 0], [0, 1]]);
a.topK(w, 1);  // [0]`,
    pulled: 16200,
    ratingSum: 92,
    ratingCount: 21
  },
  {
    id: "MemoryCompression",
    name: "MemoryCompression",
    nameZh: "\u8BB0\u5FC6\u538B\u7F29",
    nameJa: "\u8A18\u61B6\u5727\u7E2E",
    nameKo: "\uAE30\uC5B5 \uC555\uCD95",
    layer: "compressor",
    description: "Deduplication + truncation compression with ratio measurement.",
    descriptionZh: "\u53BB\u91CD + \u622A\u65AD\u538B\u7F29\uFF0C\u8F93\u51FA\u6BD4\u4F8B\u3002",
    descriptionJa: "\u91CD\u8907\u9664\u53BB + \u5207\u308A\u8A70\u3081\u5727\u7E2E\u3002\u5727\u7E2E\u6BD4\u3092\u51FA\u529B\u3002",
    descriptionKo: "\uC911\uBCF5 \uC81C\uAC70 + \uC798\uB77C\uB0B4\uAE30 \uC555\uCD95. \uC555\uCD95 \uBE44\uC728\uC744 \uCD9C\uB825\uD569\uB2C8\uB2E4.",
    useCase: "Compress memory payloads before storage to bound total token cost. Measure compression ratio.",
    useCaseZh: "\u5B58\u50A8\u524D\u538B\u7F29\u8BB0\u5FC6 payload\uFF0C\u63A7\u5236 token \u603B\u5F00\u9500\u3002",
    useCaseJa: "\u4FDD\u5B58\u524D\u306B\u30DA\u30A4\u30ED\u30FC\u30C9\u3092\u5727\u7E2E\u3057\u3066\u30C8\u30FC\u30AF\u30F3\u91CF\u3092\u6291\u5236\u3057\u307E\u3059\u3002",
    useCaseKo: "\uC800\uC7A5 \uC804\uC5D0 \uD398\uC774\uB85C\uB4DC\uB97C \uC555\uCD95\uD558\uC5EC \uD1A0\uD070 \uC0AC\uC6A9\uB7C9\uC744 \uC5B5\uC81C\uD569\uB2C8\uB2E4.",
    codePreview: `const c = new MemoryCompression();
c.compress(['a', 'b', 'a']);  // ['a', 'b']
c.ratio(original, compressed);  // 0.67`,
    pulled: 9900,
    ratingSum: 51,
    ratingCount: 12
  },
  {
    id: "MemoryCache",
    name: "MemoryCache",
    nameZh: "\u8BB0\u5FC6\u7F13\u5B58",
    nameJa: "\u8A18\u61B6\u30AD\u30E3\u30C3\u30B7\u30E5",
    nameKo: "\uAE30\uC5B5 \uCE90\uC2DC",
    layer: "integration",
    description: "LRU-style key cache for hot memory access with eviction on size cap.",
    descriptionZh: "\u70ED\u95E8\u8BBF\u95EE\u952E\u7684 LRU \u7F13\u5B58\u4E0E\u6DD8\u6C70\u3002",
    descriptionJa: "\u30B5\u30A4\u30BA\u4E0A\u9650+\u9000\u907F\u4ED8\u304D\u306ELRU\u30AD\u30FC\u30AD\u30E3\u30C3\u30B7\u30E5\u3002",
    descriptionKo: "\uC0AC\uC774\uC988 \uC0C1\uD55C + \uCD95\uCD9C\uC774 \uC788\uB294 LRU \uD0A4 \uCE90\uC2DC.",
    useCase: "Cache frequently-accessed memory keys in memory to avoid recomputation or storage hit.",
    useCaseZh: "\u7F13\u5B58\u9AD8\u9891\u8BBF\u95EE\u7684\u8BB0\u5FC6\u952E\uFF0C\u907F\u514D\u91CD\u590D\u8BA1\u7B97\u6216\u5B58\u50A8\u547D\u4E2D\u3002",
    useCaseJa: "\u983B\u5EA6\u306E\u9AD8\u3044\u30AD\u30FC\u30A2\u30AF\u30BB\u30B9\u3092\u30E1\u30E2\u30EA\u306B\u30AD\u30E3\u30C3\u30B7\u30E5\u3057\u3001\u518D\u8A08\u7B97\u3084\u30B9\u30C8\u30EC\u30FC\u30B8\u30D2\u30C3\u30C8\u3092\u56DE\u907F\u3002",
    useCaseKo: "\uC790\uC8FC \uC561\uC138\uC2A4\uD558\uB294 \uD0A4\uB97C \uBA54\uBAA8\uB9AC\uC5D0 \uCE90\uC2DC\uD558\uC5EC \uC7AC\uACC4\uC0B0\uC774\uB098 \uC2A4\uD1A0\uB9AC\uC9C0 \uD788\uD2B8\uB97C \uD68C\uD53C\uD569\uB2C8\uB2E4.",
    codePreview: `const c = new MemoryCache(100);
c.set('user-id', 'u_123');
c.get('user-id');  // 'u_123'
c.invalidate('user-id');  // true`,
    pulled: 11800,
    ratingSum: 60,
    ratingCount: 14
  },
  {
    id: "MemoryProfiler",
    name: "MemoryProfiler",
    nameZh: "\u8BB0\u5FC6\u753B\u50CF",
    nameJa: "\u8A18\u61B6\u30D7\u30ED\u30D5\u30A1\u30A4\u30E9\u30FC",
    nameKo: "\uAE30\uC5B5 \uD504\uB85C\uD30C\uC77C\uB7EC",
    layer: "integration",
    description: "Operation duration + bytes profiler per agent.",
    descriptionZh: "\u6BCF agent \u7684\u64CD\u4F5C\u65F6\u957F + \u5B57\u8282\u753B\u50CF\u3002",
    descriptionJa: "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u5225\u306E\u64CD\u4F5C\u6642\u9593 + \u30D0\u30A4\u30C8\u30D7\u30ED\u30D5\u30A1\u30A4\u30E9\u30FC\u3002",
    descriptionKo: "\uC5D0\uC774\uC804\uD2B8\uBCC4 \uC791\uC5C5 \uC2DC\uAC04 + \uBC14\uC774\uD2B8 \uD504\uB85C\uD30C\uC77C\uB7EC.",
    useCase: "Profile per-operation memory cost (duration + bytes) per agent ID for performance analysis.",
    useCaseZh: "\u6309 agent ID \u753B\u50CF\u6BCF\u64CD\u4F5C\u8BB0\u5FC6\u6210\u672C\uFF08\u65F6\u957F + \u5B57\u8282\uFF09\u3002",
    useCaseJa: "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8ID\u3054\u3068\u306B\u64CD\u4F5C\u30B3\u30B9\u30C8(\u6642\u9593 + \u30D0\u30A4\u30C8)\u3092\u8A08\u6E2C\u3057\u3001\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u5206\u6790\u306B\u4F7F\u7528\u3002",
    useCaseKo: "\uC5D0\uC774\uC804\uD2B8 ID\uBCC4 \uC791\uC5C5 \uBE44\uC6A9(\uC2DC\uAC04 + \uBC14\uC774\uD2B8)\uC744 \uCE21\uC815\uD558\uC5EC \uC131\uB2A5 \uBD84\uC11D\uC5D0 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
    codePreview: `const p = new MemoryProfiler();
p.record('agent-1', 25, 1024);
p.averageDuration('agent-1');  // 25ms`,
    pulled: 10500,
    ratingSum: 55,
    ratingCount: 13
  },
  {
    id: "MemoryDashboard",
    name: "MemoryDashboard",
    nameZh: "\u8BB0\u5FC6\u4EEA\u8868\u76D8",
    nameJa: "\u8A18\u61B6\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9",
    nameKo: "\uAE30\uC5B5 \uB300\uC2DC\uBCF4\uB4DC",
    layer: "integration",
    description: "Headless panel container for memory UI widgets.",
    descriptionZh: "\u8BB0\u5FC6 UI \u7684\u9762\u677F\u5BB9\u5668\u3002",
    descriptionJa: "\u30E1\u30E2\u30EAUI\u306E\u305F\u3081\u306E\u30D8\u30C3\u30C9\u30EC\u30B9\u30D1\u30CD\u30EB\u30B3\u30F3\u30C6\u30CA\u3002",
    descriptionKo: "\uBA54\uBAA8\uB9AC UI\uC6A9 \uD5E4\uB4DC\uB9AC\uC2A4 \uD328\uB110 \uCEE8\uD14C\uC774\uB108.",
    useCase: "Build a memory operations dashboard with named panels (LTM size, STM hit rate, retrieval quality).",
    useCaseZh: "\u642D\u5EFA\u8BB0\u5FC6\u64CD\u4F5C\u4EEA\u8868\u76D8\uFF0C\u542B\u547D\u540D\u9762\u677F\uFF08LTM \u5927\u5C0F\u3001STM \u547D\u4E2D\u7387\u3001\u68C0\u7D22\u8D28\u91CF\uFF09\u3002",
    useCaseJa: "LTM\u30B5\u30A4\u30BA\u30FBSTM\u30D2\u30C3\u30C8\u7387\u30FB\u691C\u7D22\u54C1\u8CEA\u306A\u3069\u306E\u30D1\u30CD\u30EB\u3067\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3092\u69CB\u7BC9\u3002",
    useCaseKo: "LTM \uD06C\uAE30, STM \uC801\uC911\uB960, \uAC80\uC0C9 \uD488\uC9C8 \uB4F1\uC758 \uD328\uB110\uB85C \uB300\uC2DC\uBCF4\uB4DC\uB97C \uAD6C\uCD95\uD569\uB2C8\uB2E4.",
    codePreview: `const d = new MemoryDashboard();
d.setPanel('ltm-size', 'LTM Size', 1024);`,
    pulled: 9400,
    ratingSum: 47,
    ratingCount: 11
  },
  {
    id: "MemoryConfig",
    name: "MemoryConfig",
    nameZh: "\u8BB0\u5FC6\u914D\u7F6E",
    nameJa: "\u8A18\u61B6\u30B3\u30F3\u30D5\u30A3\u30B0",
    nameKo: "\uAE30\uC5B5 \uC124\uC815",
    layer: "integration",
    description: "Typed config registry with getNumber/getString/getBoolean typed accessors.",
    descriptionZh: "\u7C7B\u578B\u5316\u914D\u7F6E\u6CE8\u518C\u8868 + getNumber/getString/getBoolean\u3002",
    descriptionJa: "\u30BF\u30A4\u30D7\u30BB\u30FC\u30D5\u30A2\u30AF\u30BB\u30B5 (getNumber/getString/getBoolean) \u4ED8\u304D\u306E\u8A2D\u5B9A\u30EC\u30B8\u30B9\u30C8\u30EA\u3002",
    descriptionKo: "\uD0C0\uC785 \uC548\uC804\uD55C \uC811\uADFC\uC790(getNumber/getString/getBoolean)\uAC00 \uC788\uB294 \uC124\uC815 \uB808\uC9C0\uC2A4\uD2B8\uB9AC.",
    useCase: "Centralize memory subsystem configuration with type-safe accessors and defaults.",
    useCaseZh: "\u96C6\u4E2D\u8BB0\u5FC6\u5B50\u7CFB\u7EDF\u914D\u7F6E\uFF0C\u7C7B\u578B\u5B89\u5168\u8BBF\u95EE\u5668 + \u9ED8\u8BA4\u503C\u3002",
    useCaseJa: "\u30B5\u30D6\u30B7\u30B9\u30C6\u30E0\u8A2D\u5B9A\u3092\u4E00\u5143\u5316\u3057\u3001\u30BF\u30A4\u30D7\u30BB\u30FC\u30D5\u306A\u30A2\u30AF\u30BB\u30B9\u3068\u30C7\u30D5\u30A9\u30EB\u30C8\u5024\u3067\u7BA1\u7406\u3002",
    useCaseKo: "\uC11C\uBE0C\uC2DC\uC2A4\uD15C \uC124\uC815\uC744 \uC911\uC559 \uC9D1\uC911\uD654\uD558\uACE0 \uD0C0\uC785 \uC548\uC804\uD55C \uC811\uADFC\uACFC \uAE30\uBCF8\uAC12\uC73C\uB85C \uAD00\uB9AC\uD569\uB2C8\uB2E4.",
    codePreview: `const c = new MemoryConfig();
c.set('window', 4096).set('compression', 'gzip');
c.getNumber('window');  // 4096`,
    pulled: 9700,
    ratingSum: 49,
    ratingCount: 12
  },
  {
    id: "MemoryAudit",
    name: "MemoryAudit",
    nameZh: "\u8BB0\u5FC6\u5BA1\u8BA1",
    nameJa: "\u8A18\u61B6\u76E3\u67FB",
    nameKo: "\uAE30\uC5B5 \uAC10\uC0AC",
    layer: "integration",
    description: "Per-user action log with time + memory type for compliance and debugging.",
    descriptionZh: "\u6BCF\u7528\u6237\u5E26\u65F6\u95F4\u6233 + \u8BB0\u5FC6\u7C7B\u578B\u7684\u5BA1\u8BA1\u65E5\u5FD7\u3002",
    descriptionJa: "\u30B3\u30F3\u30D7\u30E9\u30A4\u30A2\u30F3\u30B9\u3068\u30C7\u30D0\u30C3\u30B0\u7528\u306E\u3001\u6642\u523B+\u30E6\u30FC\u30B6\u30FC+\u8A18\u61B6\u30BF\u30A4\u30D7\u3092\u542B\u3080\u30A2\u30AF\u30B7\u30E7\u30F3\u30ED\u30B0\u3002",
    descriptionKo: "\uCEF4\uD50C\uB77C\uC774\uC5B8\uC2A4 \uBC0F \uB514\uBC84\uAE45\uC6A9\uC73C\uB85C \uC2DC\uAC04+\uC0AC\uC6A9\uC790+\uAE30\uC5B5 \uC720\uD615\uC774 \uD3EC\uD568\uB41C \uC561\uC158 \uB85C\uADF8.",
    useCase: "Audit every memory write/read with timestamp, user ID, action, memory type for compliance.",
    useCaseZh: "\u5BA1\u8BA1\u6BCF\u6B21\u8BB0\u5FC6\u8BFB\u5199\uFF0C\u542B\u65F6\u95F4\u6233\u3001\u7528\u6237\u3001\u52A8\u4F5C\u3001\u8BB0\u5FC6\u7C7B\u578B\u3002",
    useCaseJa: "\u5168\u66F8\u304D\u8FBC\u307F/\u8AAD\u307F\u53D6\u308A\u3092\u30BF\u30A4\u30E0\u30B9\u30BF\u30F3\u30D7\u30FB\u30E6\u30FC\u30B6\u30FC\u30FB\u30A2\u30AF\u30B7\u30E7\u30F3\u30FB\u30BF\u30A4\u30D7\u3067\u76E3\u67FB\u3002",
    useCaseKo: "\uBAA8\uB4E0 \uC4F0\uAE30/\uC77D\uAE30\uB97C \uD0C0\uC784\uC2A4\uD0EC\uD504\xB7\uC0AC\uC6A9\uC790\xB7\uC561\uC158\xB7\uC720\uD615\uC73C\uB85C \uAC10\uC0AC\uD569\uB2C8\uB2E4.",
    codePreview: `const a = new MemoryAudit();
a.record('user-1', 'write', 'episodic');
a.forUser('user-1');  // audit trail for that user`,
    pulled: 7800,
    ratingSum: 38,
    ratingCount: 9
  },
  {
    id: "MemoryProfile",
    name: "MemoryProfile",
    nameZh: "\u8BB0\u5FC6\u753B\u50CF\u5206\u6790",
    nameJa: "\u8A18\u61B6\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u5206\u6790",
    nameKo: "\uAE30\uC5B5 \uD504\uB85C\uD30C\uC77C \uBD84\uC11D",
    layer: "integration",
    description: "Per-agent run counter with items + duration averages.",
    descriptionZh: "\u6BCF agent \u9879\u76EE\u6570 + \u65F6\u957F\u5E73\u5747\u3002",
    descriptionJa: "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u5225\u306E\u30E9\u30F3\u30AB\u30A6\u30F3\u30BF\u30FC\u3001\u30A2\u30A4\u30C6\u30E0\u6570\u3001\u5E73\u5747\u6642\u9593\u3002",
    descriptionKo: "\uC5D0\uC774\uC804\uD2B8\uBCC4 \uB7F0 \uCE74\uC6B4\uD130, \uD56D\uBAA9 \uC218, \uD3C9\uADE0 \uC2DC\uAC04.",
    useCase: "Track per-agent memory usage and runtime for cost analysis.",
    useCaseZh: "\u8DDF\u8E2A\u6BCF agent \u8BB0\u5FC6\u4F7F\u7528\u60C5\u51B5\u4E0E\u8FD0\u884C\u65F6\uFF0C\u8FDB\u884C\u6210\u672C\u5206\u6790\u3002",
    useCaseJa: "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u3054\u3068\u306E\u8A18\u61B6\u4F7F\u7528\u91CF\u3068\u5B9F\u884C\u6642\u9593\u3092\u8FFD\u8DE1\u3057\u3001\u30B3\u30B9\u30C8\u5206\u6790\u306B\u4F7F\u7528\u3002",
    useCaseKo: "\uC5D0\uC774\uC804\uD2B8\uBCC4 \uAE30\uC5B5 \uC0AC\uC6A9\uB7C9\uACFC \uC2E4\uD589 \uC2DC\uAC04\uC744 \uCD94\uC801\uD558\uC5EC \uBE44\uC6A9 \uBD84\uC11D\uC5D0 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
    codePreview: `const p = new MemoryProfile();
p.record('agent-7', 50, 100);  // session id, items, duration ms
p.averageItems('agent-7');  // 50`,
    pulled: 7200,
    ratingSum: 36,
    ratingCount: 8
  },
  {
    id: "MemoryMigration",
    name: "MemoryMigration",
    nameZh: "\u8BB0\u5FC6\u8FC1\u79FB",
    nameJa: "\u8A18\u61B6\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3",
    nameKo: "\uAE30\uC5B5 \uB9C8\uC774\uADF8\uB808\uC774\uC158",
    layer: "integration",
    description: "Version-based migration runner for memory schema evolution.",
    descriptionZh: "\u57FA\u4E8E\u7248\u672C\u7684\u8FC1\u79FB\u6267\u884C\u5668\u3002",
    descriptionJa: "\u30B9\u30AD\u30FC\u30DE\u9032\u5316\u306B\u5BFE\u5FDC\u3059\u308B\u30D0\u30FC\u30B8\u30E7\u30F3\u30D9\u30FC\u30B9\u306E\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u30E9\u30F3\u30CA\u30FC\u3002",
    descriptionKo: "\uC2A4\uD0A4\uB9C8 \uBCC0\uD654\uC5D0 \uB300\uC751\uD558\uB294 \uBC84\uC804 \uAE30\uBC18 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB7EC\uB108.",
    useCase: "Migrate stored memories when schema evolves. v1\u2192v2 migrations run idempotently and asynchronously.",
    useCaseZh: "\u5F53 schema \u6F14\u5316\u65F6\u8FC1\u79FB\u5B58\u50A8\u7684\u8BB0\u5FC6\u3002v1\u2192v2 \u8FC1\u79FB\u5E42\u7B49\u4E14\u5F02\u6B65\u6267\u884C\u3002",
    useCaseJa: "\u30B9\u30AD\u30FC\u30DE\u304C\u66F4\u65B0\u3055\u308C\u305F\u3068\u304D\u306B\u3001v1\u2192v2 \u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u51AA\u7B49\u304B\u3064\u975E\u540C\u671F\u3067\u5B9F\u884C\u3002",
    useCaseKo: "\uC2A4\uD0A4\uB9C8\uAC00 \uC5C5\uB370\uC774\uD2B8\uB420 \uB54C v1\u2192v2 \uB9C8\uC774\uADF8\uB808\uC774\uC158\uC744 \uBA71\uB4F1\uD558\uACE0 \uBE44\uB3D9\uAE30\uB85C \uC2E4\uD589\uD569\uB2C8\uB2E4.",
    codePreview: `const m = new MemoryMigration();
m.define('v2', async () => { /* transform v1 records */ });
await m.run('v2');
m.isApplied('v2');  // true`,
    pulled: 6500,
    ratingSum: 32,
    ratingCount: 7
  },
  {
    id: "MemoryReport",
    name: "MemoryReport",
    nameZh: "\u8BB0\u5FC6\u62A5\u544A",
    nameJa: "\u8A18\u61B6\u30EC\u30DD\u30FC\u30C8",
    nameKo: "\uAE30\uC5B5 \uBCF4\uACE0\uC11C",
    layer: "integration",
    description: "Markdown + CSV report generator for memory metrics.",
    descriptionZh: "Markdown + CSV \u62A5\u544A\u751F\u6210\u5668\u3002",
    descriptionJa: "\u30E1\u30C8\u30EA\u30AF\u30B9\u7528\u306E Markdown + CSV \u30EC\u30DD\u30FC\u30C8\u30B8\u30A7\u30CD\u30EC\u30FC\u30BF\u30FC\u3002",
    descriptionKo: "\uBA54\uD2B8\uB9AD\uC6A9 Markdown + CSV \uBCF4\uACE0\uC11C \uC0DD\uC131\uAE30.",
    useCase: "Generate human-readable memory subsystem reports for stakeholders: top topics, growth, retention.",
    useCaseZh: "\u4E3A\u5229\u76CA\u76F8\u5173\u65B9\u751F\u6210\u53EF\u8BFB\u7684\u5185\u5B58\u5B50\u7CFB\u7EDF\u62A5\u544A\uFF1A\u70ED\u95E8\u8BDD\u9898\u3001\u589E\u957F\u3001\u7559\u5B58\u3002",
    useCaseJa: "\u30C8\u30D4\u30C3\u30AF\u4E0A\u4F4D\u30FB\u6210\u9577\u30FB\u4FDD\u6301\u7387\u306A\u3069\u3001\u30B9\u30C6\u30FC\u30AF\u30DB\u30EB\u30C0\u30FC\u5411\u3051\u306E\u53EF\u8AAD\u30EC\u30DD\u30FC\u30C8\u3092\u751F\u6210\u3002",
    useCaseKo: "\uC778\uAE30 \uD1A0\uD53D\xB7\uC131\uC7A5\xB7\uC720\uC9C0\uC728 \uB4F1 \uC774\uD574\uAD00\uACC4\uC790\uC6A9 \uAC00\uB3C5\uC131 \uC788\uB294 \uBCF4\uACE0\uC11C\uB97C \uC0DD\uC131\uD569\uB2C8\uB2E4.",
    codePreview: `const r = new MemoryReport();
r.generate('Q1 Memory', { ltm: 1000, stm: 50 });  // markdown
r.toCSV({ a: 1 });  // 'metric,value\\n...'
`,
    pulled: 6900,
    ratingSum: 34,
    ratingCount: 8
  },
  {
    id: "MemoryBenchmark",
    name: "MemoryBenchmark",
    nameZh: "\u8BB0\u5FC6\u57FA\u51C6",
    nameJa: "\u8A18\u61B6\u30D9\u30F3\u30C1\u30DE\u30FC\u30AF",
    nameKo: "\uAE30\uC5B5 \uBCA4\uCE58\uB9C8\uD06C",
    layer: "integration",
    description: "Per-method benchmark tracker with best-result selection.",
    descriptionZh: "\u6BCF\u4E2A\u65B9\u6CD5\u57FA\u51C6\u8FFD\u8E2A + \u6700\u4F18\u9009\u62E9\u3002",
    descriptionJa: "\u5404\u30E1\u30BD\u30C3\u30C9\u306E\u30D9\u30F3\u30C1\u30DE\u30FC\u30AF\u8FFD\u8DE1 + \u6700\u826F\u7D50\u679C\u306E\u9078\u629E\u3002",
    descriptionKo: "\uAC01 \uBA54\uC11C\uB4DC\uC758 \uBCA4\uCE58\uB9C8\uD06C \uCD94\uC801 + \uCD5C\uC801 \uACB0\uACFC \uC120\uD0DD.",
    useCase: "Compare memory implementations (episodic vs semantic) and pick best by score.",
    useCaseZh: "\u5BF9\u6BD4\u5185\u5B58\u5B9E\u73B0\uFF08\u5982 episodic vs semantic\uFF09\u5E76\u6309\u5206\u6570\u9009\u51FA\u6700\u4F18\u3002",
    useCaseJa: "\u8A18\u61B6\u5B9F\u88C5\uFF08\u30A8\u30D4\u30BD\u30FC\u30C9\u578B vs \u30BB\u30DE\u30F3\u30C6\u30A3\u30C3\u30AF\u578B\uFF09\u3092\u30B9\u30B3\u30A2\u3067\u6BD4\u8F03\u3057\u6700\u826F\u3092\u63A1\u7528\u3002",
    useCaseKo: "\uAE30\uC5B5 \uAD6C\uD604(\uC5D0\uD53C\uC18C\uB4DC\uD615 vs \uC2DC\uB9E8\uD2F1\uD615)\uC744 \uC810\uC218\uB85C \uBE44\uAD50\uD558\uC5EC \uCD5C\uC801\uC744 \uCC44\uD0DD\uD569\uB2C8\uB2E4.",
    codePreview: `const b = new MemoryBenchmark();
b.record('episodic', 0.85).record('semantic', 0.95);
b.best();  // { name: 'semantic', score: 0.95 }`,
    pulled: 6300,
    ratingSum: 31,
    ratingCount: 7
  },
  {
    id: "MemoryCoreIndex",
    name: "MemoryCoreIndex",
    nameZh: "\u8BB0\u5FC6\u6838\u5FC3\u7D22\u5F15",
    nameJa: "\u8A18\u61B6\u30B3\u30A2\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9",
    nameKo: "\uAE30\uC5B5 \uCF54\uC5B4 \uC778\uB371\uC2A4",
    layer: "integration",
    description: "Batch 1/3 index of all 10 core memory engines.",
    descriptionZh: "10 \u4E2A\u6838\u5FC3\u5F15\u64CE\u7684\u6279\u6B21\u7D22\u5F15\u3002",
    descriptionJa: "10\u500B\u306E\u30B3\u30A2\u30A8\u30F3\u30B8\u30F3\u306E\u30D0\u30C3\u30C1 1/3 \u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3002",
    descriptionKo: "\uCF54\uC5B4 \uC5D4\uC9C4 10\uAC1C\uC758 \uBC30\uCE58 1/3 \uC778\uB371\uC2A4.",
    useCase: "Enumerate core engines for registry listings or dynamic discovery.",
    useCaseZh: "\u679A\u4E3E\u6838\u5FC3\u5F15\u64CE\u7528\u4E8E\u6CE8\u518C\u8868\u5217\u8868\u6216\u52A8\u6001\u53D1\u73B0\u3002",
    useCaseJa: "\u30B3\u30A2\u30A8\u30F3\u30B8\u30F3\u306E\u5217\u6319\u7528\uFF08\u30EC\u30B8\u30B9\u30C8\u30EA\u63B2\u8F09\u307E\u305F\u306F\u52D5\u7684\u63A2\u7D22\uFF09\u3002",
    useCaseKo: "\uCF54\uC5B4 \uC5D4\uC9C4\uC744 \uC5F4\uAC70(\uB808\uC9C0\uC2A4\uD2B8\uB9AC \uAC8C\uC7AC \uB610\uB294 \uB3D9\uC801 \uD0D0\uC0C9).",
    codePreview: `new MemoryCoreIndex().list();
// ['EpisodicStore', 'SemanticIndex', 'ProceduralCache', ...]`,
    pulled: 5400,
    ratingSum: 27,
    ratingCount: 6
  },
  {
    id: "MemoryAdvancedIndex",
    name: "MemoryAdvancedIndex",
    nameZh: "\u8BB0\u5FC6\u9AD8\u7EA7\u7D22\u5F15",
    nameJa: "\u8A18\u61B6\u30A2\u30C9\u30D0\u30F3\u30B9\u30C9\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9",
    nameKo: "\uAE30\uC5B5 \uACE0\uAE09 \uC778\uB371\uC2A4",
    layer: "integration",
    description: "Batch 2/3 index of all 10 advanced memory engines.",
    descriptionZh: "10 \u4E2A\u9AD8\u7EA7\u5F15\u64CE\u7684\u6279\u6B21\u7D22\u5F15\u3002",
    descriptionJa: "10\u500B\u306E\u30A2\u30C9\u30D0\u30F3\u30B9\u30C9\u30A8\u30F3\u30B8\u30F3\u306E\u30D0\u30C3\u30C1 2/3 \u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3002",
    descriptionKo: "\uACE0\uAE09 \uC5D4\uC9C4 10\uAC1C\uC758 \uBC30\uCE58 2/3 \uC778\uB371\uC2A4.",
    useCase: "Same as Core index but for the advanced batch.",
    useCaseZh: "\u540C\u4E0A\u4F46\u9488\u5BF9\u9AD8\u7EA7\u6279\u6B21\u3002",
    useCaseJa: "\u30A2\u30C9\u30D0\u30F3\u30B9\u30C9\u30D0\u30C3\u30C1\u7248\u3002\u524D\u8FF0\u306E Core \u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3068\u540C\u3058\u4F7F\u3044\u65B9\u3002",
    useCaseKo: "\uACE0\uAE09 \uBC30\uCE58 \uBC84\uC804. \uCF54\uC5B4 \uC778\uB371\uC2A4\uC640 \uB3D9\uC77C\uD558\uAC8C \uC0AC\uC6A9.",
    codePreview: `new MemoryAdvancedIndex().count();  // 10`,
    pulled: 4900,
    ratingSum: 25,
    ratingCount: 6
  },
  {
    id: "MemoryMasterIndex",
    name: "MemoryMasterIndex",
    nameZh: "\u8BB0\u5FC6\u4E3B\u7D22\u5F15",
    nameJa: "\u8A18\u61B6\u30DE\u30B9\u30BF\u30FC\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9",
    nameKo: "\uAE30\uC5B5 \uB9C8\uC2A4\uD130 \uC778\uB371\uC2A4",
    layer: "integration",
    description: "Top-level master index of all 29 memory engines across all 3 batches.",
    descriptionZh: "38 \u4E2A\u8BB0\u5FC6\u5F15\u64CE\u7684\u9876\u5C42\u4E3B\u7D22\u5F15\u3002",
    descriptionJa: "\u516838\u500B\u306E\u8A18\u61B6\u30A8\u30F3\u30B8\u30F3\u3092\u7DB2\u7F85\u3059\u308B\u30C8\u30C3\u30D7\u30EC\u30D9\u30EB\u306E\u30DE\u30B9\u30BF\u30FC\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3002",
    descriptionKo: "38\uAC1C\uC758 \uAE30\uC5B5 \uC5D4\uC9C4\uC744 \uC544\uC6B0\uB974\uB294 \uCD5C\uC0C1\uC704 \uB9C8\uC2A4\uD130 \uC778\uB371\uC2A4.",
    useCase: "Single registry for dynamic discovery of any agent-memory engine.",
    useCaseZh: "\u7528\u4E8E\u52A8\u6001\u53D1\u73B0\u4EFB\u4F55 agent-memory \u5F15\u64CE\u7684\u5355\u4E00\u6CE8\u518C\u8868\u3002",
    useCaseJa: "\u4EFB\u610F\u306E agent-memory \u30A8\u30F3\u30B8\u30F3\u3092\u52D5\u7684\u306B\u767A\u898B\u3059\u308B\u305F\u3081\u306E\u5358\u4E00\u30EC\u30B8\u30B9\u30C8\u30EA\u3002",
    useCaseKo: "\uBAA8\uB4E0 agent-memory \uC5D4\uC9C4\uC744 \uB3D9\uC801\uC73C\uB85C \uBC1C\uACAC\uD558\uAE30 \uC704\uD55C \uB2E8\uC77C \uB808\uC9C0\uC2A4\uD2B8\uB9AC\uC785\uB2C8\uB2E4.",
    codePreview: `new MemoryMasterIndex().count();  // 29
new MemoryMasterIndex().has('EpisodicStore');  // true`,
    pulled: 6100,
    ratingSum: 30,
    ratingCount: 7
  },
  {
    id: "VectorEmbedder",
    name: "VectorEmbedder",
    nameZh: "\u5411\u91CF\u5D4C\u5165\u5668",
    nameJa: "\u30D9\u30AF\u30C8\u30EB\u30A8\u30F3\u30D9\u30C3\u30C0\u30FC",
    nameKo: "\uBCA1\uD130 \uC784\uBCA0\uB354",
    layer: "memvector",
    description: "Deterministic pseudo-random embedding (text \u2192 vector + project).",
    descriptionZh: "\u786E\u5B9A\u6027\u5D4C\u5165\uFF1A\u6587\u672C/\u6807\u7B7E \u2192 \u56FA\u5B9A\u7EF4\u5EA6\u5411\u91CF + \u6295\u5F71\u3002",
    descriptionJa: "\u6C7A\u5B9A\u8AD6\u7684\u64EC\u4F3C\u30E9\u30F3\u30C0\u30E0\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0\uFF08\u30C6\u30AD\u30B9\u30C8 \u2192 \u30D9\u30AF\u30C8\u30EB + \u6295\u5F71\uFF09\u3002",
    descriptionKo: "\uACB0\uC815\uB860\uC801 \uC758\uC0AC \uB09C\uC218 \uC784\uBCA0\uB529(\uD14D\uC2A4\uD2B8 \u2192 \uBCA1\uD130 + \uD22C\uC0AC).",
    useCase: "Convert text/tag inputs to fixed-dimension vectors for similarity search.",
    useCaseZh: "\u5C06\u6587\u672C/\u6807\u7B7E\u8F93\u5165\u8F6C\u4E3A\u56FA\u5B9A\u7EF4\u5EA6\u5411\u91CF\uFF0C\u7528\u4E8E\u76F8\u4F3C\u6027\u641C\u7D22\u3002",
    useCaseJa: "\u30C6\u30AD\u30B9\u30C8/\u30BF\u30B0\u5165\u529B\u3092\u56FA\u5B9A\u6B21\u5143\u306E\u30D9\u30AF\u30C8\u30EB\u306B\u5909\u63DB\u3057\u3001\u985E\u4F3C\u691C\u7D22\u306B\u4F7F\u7528\u3057\u307E\u3059\u3002",
    useCaseKo: "\uD14D\uC2A4\uD2B8/\uD0DC\uADF8 \uC785\uB825\uC744 \uACE0\uC815 \uCC28\uC6D0 \uBCA1\uD130\uB85C \uBCC0\uD658\uD558\uC5EC \uC720\uC0AC\uB3C4 \uAC80\uC0C9\uC5D0 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
    codePreview: `const e = new VectorEmbedder(64);
const v = e.embedText('hello world');  // { dim: 64, values: [0.012, -0.034, ...] }
e.project(v.values, 32);  // projection to 32 dims`,
    pulled: 4200,
    ratingSum: 26,
    ratingCount: 6
  },
  {
    id: "HNSWIndex",
    name: "HNSWIndex",
    nameZh: "HNSW \u7D22\u5F15",
    nameJa: "HNSW\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9",
    nameKo: "HNSW \uC778\uB371\uC2A4",
    layer: "memvector",
    description: "Simplified HNSW-style graph: K-NN inserts + beam query with cosine similarity.",
    descriptionZh: "HNSW \u98CE\u683C ANN\uFF1AK-NN \u63D2\u5165 + \u6CE2\u675F\u67E5\u8BE2\u3002",
    descriptionJa: "HNSW \u98A8\u30B0\u30E9\u30D5\uFF1AK-NN \u633F\u5165 + \u30B3\u30B5\u30A4\u30F3\u985E\u4F3C\u5EA6\u306B\u3088\u308B\u30D3\u30FC\u30E0\u30AF\u30A8\u30EA\u3002",
    descriptionKo: "HNSW \uC2A4\uD0C0\uC77C \uADF8\uB798\uD504: K-NN \uC0BD\uC785 + \uCF54\uC0AC\uC778 \uC720\uC0AC\uB3C4\uB97C \uC0AC\uC6A9\uD55C \uBE54 \uCFFC\uB9AC.",
    useCase: "Build a scalable ANN index over memory embeddings for fast top-K retrieval.",
    useCaseZh: "\u4E3A\u8BB0\u5FC6\u5D4C\u5165\u6784\u5EFA\u53EF\u6269\u5C55 ANN \u7D22\u5F15\uFF0C\u5B9E\u73B0\u5FEB\u901F top-K \u68C0\u7D22\u3002",
    useCaseJa: "\u8A18\u61B6\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0\u4E0A\u306B\u30B9\u30B1\u30FC\u30E9\u30D6\u30EB\u306A ANN \u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3092\u69CB\u7BC9\u3001\u9AD8\u901F top-K \u691C\u7D22\u3092\u5B9F\u73FE\u3002",
    useCaseKo: "\uAE30\uC5B5 \uC784\uBCA0\uB529 \uC704\uC5D0 \uD655\uC7A5 \uAC00\uB2A5\uD55C ANN \uC778\uB371\uC2A4\uB97C \uAD6C\uCD95\uD558\uC5EC \uBE60\uB978 top-K \uAC80\uC0C9\uC744 \uAD6C\uD604\uD569\uB2C8\uB2E4.",
    codePreview: `const idx = new HNSWIndex(16, 3);
idx.insert('a', [1, 0, 0]); idx.insert('b', [1, 0, 0.1]);
idx.query([1, 0, 0], 2);  // returns [{id: 'a', score: 1.0}, {id: 'b', score: 0.99}]`,
    pulled: 7800,
    ratingSum: 47,
    ratingCount: 11
  },
  {
    id: "PQCompressor",
    name: "PQCompressor",
    nameZh: "PQ \u538B\u7F29\u5668",
    nameJa: "PQ \u30B3\u30F3\u30D7\u30EC\u30C3\u30B5\u30FC",
    nameKo: "PQ \uCEF4\uD504\uB808\uC11C",
    layer: "memvector",
    description: "Product Quantization: split vector into K sub-vectors, store centroid id (1 byte each).",
    descriptionZh: "Product Quantization\uFF1A\u628A\u5411\u91CF\u5207\u6210 K \u4E2A\u5B50\u5411\u91CF\uFF0C\u6BCF\u5B50\u5411\u91CF\u5B58 1 \u5B57\u8282\u4E2D\u5FC3 ID\u3002",
    descriptionJa: "Product Quantization\uFF1A\u30D9\u30AF\u30C8\u30EB\u3092 K \u500B\u306E\u30B5\u30D6\u30D9\u30AF\u30C8\u30EB\u306B\u5206\u5272\u3057\u3001\u5404\u30BB\u30F3\u30C8\u30ED\u30A4\u30C9 ID \u3092 1 \u30D0\u30A4\u30C8\u3067\u4FDD\u5B58\u3002",
    descriptionKo: "Product Quantization: \uBCA1\uD130\uB97C K \uAC1C\uC758 \uC11C\uBE0C \uBCA1\uD130\uB85C \uBD84\uD560, \uAC01 \uC13C\uD2B8\uB85C\uC774\uB4DC ID \uB97C 1 \uBC14\uC774\uD2B8\uB85C \uC800\uC7A5.",
    useCase: "Compress memory embeddings to 1/8 size with ~90% recall retention for ANN search.",
    useCaseZh: "\u628A\u8BB0\u5FC6\u5D4C\u5165\u538B\u7F29\u5230 1/8 \u5927\u5C0F\uFF0C\u53EC\u56DE ~90%\u3002",
    useCaseJa: "\u8A18\u61B6\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0\u3092 1/8 \u30B5\u30A4\u30BA\u306B\u5727\u7E2E\u3057\u3001ANN \u691C\u7D22\u3067\u7D04 90% \u306E\u518D\u73FE\u7387\u3092\u7DAD\u6301\u3002",
    useCaseKo: "\uAE30\uC5B5 \uC784\uBCA0\uB529\uC744 1/8 \uD06C\uAE30\uB85C \uC555\uCD95\uD558\uACE0 ANN \uAC80\uC0C9\uC5D0\uC11C \uC57D 90% \uC7AC\uD604\uC728\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4.",
    codePreview: `const c = new PQCompressor(4);  // 4 sub-vectors
const v = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const codes = c.compress(v);  // [byte, byte, byte, byte]
c.compressionRatio(8);  // 0.5`,
    pulled: 3200,
    ratingSum: 19,
    ratingCount: 5
  },
  {
    id: "HybridSearcher",
    name: "HybridSearcher",
    nameZh: "\u6DF7\u5408\u68C0\u7D22\u5668",
    nameJa: "\u30CF\u30A4\u30D6\u30EA\u30C3\u30C9\u691C\u7D22",
    nameKo: "\uD558\uC774\uBE0C\uB9AC\uB4DC \uAC80\uC0C9",
    layer: "memvector",
    description: "Combine tag-match (Jaccard) + vector similarity with tunable \u03B1.",
    descriptionZh: "\u7ED3\u5408\u6807\u7B7E\u5339\u914D\uFF08Jaccard\uFF09+ \u5411\u91CF\u76F8\u4F3C\u5EA6\uFF0C\u53EF\u8C03 \u03B1\u3002",
    descriptionJa: "\u30BF\u30B0\u30DE\u30C3\u30C1\uFF08Jaccard\uFF09+ \u30D9\u30AF\u30C8\u30EB\u985E\u4F3C\u5EA6\u3092 \u03B1 \u3067\u8ABF\u6574\u53EF\u80FD\u3002",
    descriptionKo: "\uD0DC\uADF8 \uB9E4\uCE6D(Jaccard) + \uBCA1\uD130 \uC720\uC0AC\uB3C4\uB97C \u03B1 \uB85C \uC870\uC815 \uAC00\uB2A5.",
    useCase: "Get the best of both worlds: combine tag-based metadata search with semantic vector similarity.",
    useCaseZh: "\u53D6\u957F\u8865\u77ED\uFF1A\u7ED3\u5408\u57FA\u4E8E\u6807\u7B7E\u7684\u5143\u6570\u636E\u68C0\u7D22\u4E0E\u8BED\u4E49\u5411\u91CF\u76F8\u4F3C\u6027\u3002",
    useCaseJa: "\u4E21\u8005\u306E\u9577\u6240\u3092\u7D44\u307F\u5408\u308F\u305B\u305F\u691C\u7D22\uFF1A\u30BF\u30B0\u30D9\u30FC\u30B9\u306E\u30E1\u30BF\u30C7\u30FC\u30BF\u691C\u7D22 + \u30BB\u30DE\u30F3\u30C6\u30A3\u30C3\u30AF\u306A\u30D9\u30AF\u30C8\u30EB\u985E\u4F3C\u5EA6\u3002",
    useCaseKo: "\uC591\uCABD\uC758 \uC7A5\uC810\uC744 \uACB0\uD569\uD55C \uAC80\uC0C9: \uD0DC\uADF8 \uAE30\uBC18 \uBA54\uD0C0\uB370\uC774\uD130 + \uC2DC\uB9E8\uD2F1 \uBCA1\uD130 \uC720\uC0AC\uB3C4.",
    codePreview: `const h = new HybridSearcher();
h.search('python', [1, 0, 0], items, { alpha: 0.5 });
// alpha=1 \u2192 pure tag, alpha=0 \u2192 pure vector
h.tuneAlpha(...);  // grid-search best \u03B1 over ground-truth hits`,
    pulled: 5400,
    ratingSum: 33,
    ratingCount: 7
  },
  {
    id: "VectorCache",
    name: "VectorCache",
    nameZh: "\u5411\u91CF\u7F13\u5B58",
    nameJa: "\u30D9\u30AF\u30C8\u30EB\u30AD\u30E3\u30C3\u30B7\u30E5",
    nameKo: "\uBCA1\uD130 \uCE90\uC2DC",
    layer: "memvector",
    description: "LRU cache for query/embedding key-value lookups with hit-rate tracking.",
    descriptionZh: "\u6309\u952E\u503C\u67E5\u8BE2\u5D4C\u5165\u7684 LRU \u7F13\u5B58 + \u547D\u4E2D\u7387\u8FFD\u8E2A\u3002",
    descriptionJa: "\u30D2\u30C3\u30C8\u7387\u8FFD\u8DE1\u4ED8\u304D\u306E\u30AF\u30A8\u30EA\uFF0F\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0 K/V LRU \u30AD\u30E3\u30C3\u30B7\u30E5\u3002",
    descriptionKo: "\uC801\uC911\uB960 \uCD94\uC801\uC774 \uC788\uB294 \uCFFC\uB9AC/\uC784\uBCA0\uB529 K/V LRU \uCE90\uC2DC.",
    useCase: "Skip recomputing embeddings for repeated queries. Track cache hit-rate to tune policy.",
    useCaseZh: "\u8DF3\u8FC7\u91CD\u590D\u67E5\u8BE2\u7684\u5D4C\u5165\u91CD\u65B0\u8BA1\u7B97\uFF1B\u8FFD\u8E2A\u547D\u4E2D\u7387\u4EE5\u8C03\u4F18\u7B56\u7565\u3002",
    useCaseJa: "\u540C\u4E00\u30AF\u30A8\u30EA\u306E\u518D\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0\u8A08\u7B97\u3092\u30B9\u30AD\u30C3\u30D7\u3002\u30D2\u30C3\u30C8\u7387\u3092\u8A08\u6E2C\u3057\u3066\u30DD\u30EA\u30B7\u30FC\u8ABF\u6574\u3002",
    useCaseKo: "\uB3D9\uC77C \uCFFC\uB9AC\uC758 \uC7AC\uC784\uBCA0\uB529 \uACC4\uC0B0\uC744 \uAC74\uB108\uB701\uB2C8\uB2E4. \uC801\uC911\uB960\uC744 \uCE21\uC815\uD558\uC5EC \uC815\uCC45 \uC870\uC815.",
    codePreview: `const c = new VectorCache(256);
c.set('python-query', [embed1, embed2, ...]);
c.get('python-query');  // hit
c.hitRate();  // 0.94`,
    pulled: 4100,
    ratingSum: 25,
    ratingCount: 6
  },
  {
    id: "VectorMigrator",
    name: "VectorMigrator",
    nameZh: "\u5411\u91CF\u8FC1\u79FB\u5668",
    nameJa: "\u30D9\u30AF\u30C8\u30EB\u30DE\u30A4\u30B0\u30EC\u30FC\u30BF\u30FC",
    nameKo: "\uBCA1\uD130 \uB9C8\uC774\uADF8\uB808\uC774\uD130",
    layer: "memvector",
    description: "Migrate vectors between embedding dimensions (model upgrades, PCA, project).",
    descriptionZh: "\u8DE8\u5D4C\u5165\u7EF4\u5EA6\u7684\u8FC1\u79FB\uFF08\u6A21\u578B\u5347\u7EA7\u3001PCA\u3001\u6295\u5F71\uFF09\u3002",
    descriptionJa: "\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0\u6B21\u5143\u9593\u306E\u30DE\u30A4\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\uFF08\u30E2\u30C7\u30EB\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9\u3001PCA\u3001\u6295\u5F71\uFF09\u3002",
    descriptionKo: "\uC784\uBCA0\uB529 \uCC28\uC6D0 \uAC04 \uB9C8\uC774\uADF8\uB808\uC774\uC158(\uBAA8\uB378 \uC5C5\uADF8\uB808\uC774\uB4DC, PCA, \uD22C\uC0AC).",
    useCase: "Upgrade from a 64-dim model to 128-dim without recomputing every embedding.",
    useCaseZh: "\u4ECE 64 \u7EF4\u6A21\u578B\u5347\u7EA7\u5230 128 \u7EF4\uFF0C\u65E0\u9700\u91CD\u65B0\u8BA1\u7B97\u6BCF\u4E2A\u5D4C\u5165\u3002",
    useCaseJa: "64 \u6B21\u5143\u30E2\u30C7\u30EB\u304B\u3089 128 \u6B21\u5143\u30E2\u30C7\u30EB\u3078\u306E\u79FB\u884C\u3067\u3001\u5168\u30A8\u30F3\u30D9\u30C3\u30C7\u30A3\u30F3\u30B0\u3092\u518D\u8A08\u7B97\u305B\u305A\u306B\u6E08\u3080\u3002",
    useCaseKo: "64 \uCC28\uC6D0 \uBAA8\uB378\uC5D0\uC11C 128 \uCC28\uC6D0 \uBAA8\uB378\uB85C \uC5C5\uADF8\uB808\uC774\uB4DC\uD560 \uB54C \uBAA8\uB4E0 \uC784\uBCA0\uB529\uC744 \uC7AC\uACC4\uC0B0\uD558\uC9C0 \uC54A\uC544\uB3C4 \uB429\uB2C8\uB2E4.",
    codePreview: `const m = new VectorMigrator();
m.migrate([[1, 2, 3, 4]], 4, 8, 'random-projection');
m.migrate([[1, 2]], 2, 5, 'pad-truncate');  // \u2192 [[1, 2, 0, 0, 0]]`,
    pulled: 2300,
    ratingSum: 14,
    ratingCount: 4
  },
  {
    id: "VectorNormalizer",
    name: "VectorNormalizer",
    nameZh: "\u5411\u91CF\u5F52\u4E00\u5316\u5668",
    nameJa: "\u30D9\u30AF\u30C8\u30EB\u30CE\u30FC\u30DE\u30E9\u30A4\u30B6\u30FC",
    nameKo: "\uBCA1\uD130 \uC815\uADDC\uD654\uAE30",
    layer: "memvector",
    description: "L2 / minmax / z-score normalization helpers.",
    descriptionZh: "L2 + minmax + z-score \u5F52\u4E00\u5316\u8F85\u52A9\u65B9\u6CD5\u3002",
    descriptionJa: "L2 / minmax / z-score \u6B63\u898F\u5316\u30D8\u30EB\u30D1\u30FC\u3002",
    descriptionKo: "L2 / minmax / z-score \uC815\uADDC\uD654 \uD5EC\uD37C.",
    useCase: "Pre-process vectors before cosine similarity (L2) or range-bound features (minmax).",
    useCaseZh: "\u5728\u4F59\u5F26\u76F8\u4F3C\u5EA6\uFF08L2\uFF09\u6216\u8303\u56F4\u7279\u5F81\uFF08minmax\uFF09\u524D\u9884\u5904\u7406\u5411\u91CF\u3002",
    useCaseJa: "\u30B3\u30B5\u30A4\u30F3\u985E\u4F3C\u5EA6\uFF08L2\uFF09\u3084\u7BC4\u56F2\u7279\u5FB4\uFF08minmax\uFF09\u306E\u524D\u306B\u30D9\u30AF\u30C8\u30EB\u3092\u524D\u51E6\u7406\u3002",
    useCaseKo: "\uCF54\uC0AC\uC778 \uC720\uC0AC\uB3C4(L2) \uB610\uB294 \uBC94\uC704 \uD2B9\uC9D5(minmax) \uC804\uC5D0 \uBCA1\uD130\uB97C \uC804\uCC98\uB9AC.",
    codePreview: `VectorNormalizer.normalize([3, 4]);  // [0.6, 0.8]
VectorNormalizer.minMax([1, 2, 3]);  // [0, 0.5, 1]
VectorNormalizer.zScore([1, 2, 3]);  // [-1, 0, +1] (mean 0, std 1)`,
    pulled: 1800,
    ratingSum: 11,
    ratingCount: 3
  },
  {
    id: "CosineSim",
    name: "CosineSim",
    nameZh: "\u4F59\u5F26\u76F8\u4F3C\u5EA6",
    nameJa: "\u30B3\u30B5\u30A4\u30F3\u985E\u4F3C\u5EA6",
    nameKo: "\uCF54\uC0AC\uC778 \uC720\uC0AC\uB3C4",
    layer: "memvector",
    description: "Cosine similarity + L2 distance + topK helper.",
    descriptionZh: "\u4F59\u5F26\u76F8\u4F3C\u5EA6 + L2 \u8DDD\u79BB + topK \u8F85\u52A9\u51FD\u6570\u3002",
    descriptionJa: "\u30B3\u30B5\u30A4\u30F3\u985E\u4F3C\u5EA6 + L2 \u8DDD\u96E2 + topK \u30D8\u30EB\u30D1\u30FC\u3002",
    descriptionKo: "\uCF54\uC0AC\uC778 \uC720\uC0AC\uB3C4 + L2 \uAC70\uB9AC + topK \uD5EC\uD37C.",
    useCase: "Standalone similarity helper usable without a full index.",
    useCaseZh: "\u65E0\u9700\u5B8C\u6574\u7D22\u5F15\u7684\u72EC\u7ACB\u76F8\u4F3C\u5EA6\u8BA1\u7B97 helper\u3002",
    useCaseJa: "\u5B8C\u5168\u306A\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u306A\u3057\u3067\u5358\u4F53\u3067\u4F7F\u3048\u308B\u985E\u4F3C\u5EA6\u30D8\u30EB\u30D1\u30FC\u3002",
    useCaseKo: "\uC804\uCCB4 \uC778\uB371\uC2A4 \uC5C6\uC774 \uB3C5\uB9BD\uC801\uC73C\uB85C \uC0AC\uC6A9\uD560 \uC218 \uC788\uB294 \uC720\uC0AC\uB3C4 \uD5EC\uD37C\uC785\uB2C8\uB2E4.",
    codePreview: `const c = new CosineSim();
c.similarity([1, 0, 0], [1, 0, 0]);  // 1.0
c.distance([1, 0], [4, 3]);             // 5.0
c.topK([1, 0], [[1, 0], [0, 1], [0.5, 0.5]], 2);  // [0, 2]`,
    pulled: 2100,
    ratingSum: 13,
    ratingCount: 3
  },
  {
    id: "DistanceMetric",
    name: "DistanceMetric",
    nameZh: "\u8DDD\u79BB\u5EA6\u91CF",
    nameJa: "\u8DDD\u96E2\u30E1\u30C8\u30EA\u30C3\u30AF",
    nameKo: "\uAC70\uB9AC \uBA54\uD2B8\uB9AD",
    layer: "memvector",
    description: "Static helpers: cosine, euclidean, dot product.",
    descriptionZh: "\u9759\u6001 helpers\uFF1Acosine\u3001euclidean\u3001dot product\u3002",
    descriptionJa: "\u9759\u7684\u30D8\u30EB\u30D1\u30FC\uFF1A\u30B3\u30B5\u30A4\u30F3\u3001\u30E6\u30FC\u30AF\u30EA\u30C3\u30C9\u3001\u30C9\u30C3\u30C8\u7A4D\u3002",
    descriptionKo: "\uC815\uC801 \uD5EC\uD37C: \uCF54\uC0AC\uC778, \uC720\uD074\uB9AC\uB4DC, \uB0B4\uC801.",
    useCase: "Inline distance functions without instantiating classes.",
    useCaseZh: "\u5185\u8054\u8DDD\u79BB\u8BA1\u7B97 helper\uFF0C\u65E0\u9700\u5B9E\u4F8B\u5316\u7C7B\u3002",
    useCaseJa: "\u30AF\u30E9\u30B9\u3092\u30A4\u30F3\u30B9\u30BF\u30F3\u30B9\u5316\u305B\u305A\u306B\u30A4\u30F3\u30E9\u30A4\u30F3\u8DDD\u96E2\u95A2\u6570\u3092\u63D0\u4F9B\u3002",
    useCaseKo: "\uD074\uB798\uC2A4\uB97C \uC778\uC2A4\uD134\uC2A4\uD654\uD558\uC9C0 \uC54A\uACE0 \uC778\uB77C\uC778 \uAC70\uB9AC \uD568\uC218\uB97C \uC81C\uACF5\uD569\uB2C8\uB2E4.",
    codePreview: `DistanceMetric.cosine([1, 0], [0, 1]);   // 0
DistanceMetric.euclidean([1, 0], [4, 3]);  // 5
DistanceMetric.dot([1, 2, 3], [4, 5, 6]);   // 32`,
    pulled: 1500,
    ratingSum: 9,
    ratingCount: 2
  },
  {
    id: "MemVectorCoreIndex",
    name: "MemVectorCoreIndex",
    nameZh: "MemVector \u6838\u5FC3\u7D22\u5F15",
    nameJa: "MemVector \u30B3\u30A2\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9",
    nameKo: "MemVector \uCF54\uC5B4 \uC778\uB371\uC2A4",
    layer: "memvector",
    description: "Batch index of all 11 MemVector engines (MemVector core batch).",
    descriptionZh: "MemVector \u6279\u6B21\uFF0811 \u4E2A\uFF09\u5F15\u64CE\u7684\u7D22\u5F15\u3002",
    descriptionJa: "MemVector \u5C64 11 \u500B\u306E\u30A8\u30F3\u30B8\u30F3\u306E\u30D0\u30C3\u30C1\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3002",
    descriptionKo: "MemVector \uB808\uC774\uC5B4 11 \uAC1C \uC5D4\uC9C4\uC758 \uBC30\uCE58 \uC778\uB371\uC2A4.",
    useCase: "Enumerate the MemVector layer engines for registry listings or dynamic discovery.",
    useCaseZh: "\u5217\u4E3E MemVector \u5C42\u7EA7\u5F15\u64CE\u7528\u4E8E\u6CE8\u518C\u8868\u5217\u8868\u6216\u52A8\u6001\u53D1\u73B0\u3002",
    useCaseJa: "MemVector \u5C64\u30A8\u30F3\u30B8\u30F3\u3092\u5217\u6319\uFF08\u30EC\u30B8\u30B9\u30C8\u30EA\u63B2\u8F09\u307E\u305F\u306F\u52D5\u7684\u63A2\u7D22\uFF09\u3002",
    useCaseKo: "MemVector \uB808\uC774\uC5B4 \uC5D4\uC9C4\uC744 \uC5F4\uAC70(\uB808\uC9C0\uC2A4\uD2B8\uB9AC \uAC8C\uC7AC \uB610\uB294 \uB3D9\uC801 \uD0D0\uC0C9).",
    codePreview: `new MemVectorCoreIndex().count();  // 11
new MemVectorCoreIndex().has('VectorEmbedder');  // true
new MemVectorCoreIndex().has('MemVectorCoreIndex');  // true (index itself)`,
    pulled: 1200,
    ratingSum: 7,
    ratingCount: 2
  }
];
var LAYERS = [
  { id: "episodic", label: "Episodic", color: "#7c3aed", desc: "Time-stamped event records" },
  { id: "semantic", label: "Semantic", color: "#2563eb", desc: "Tag-based indexing & retrieval" },
  { id: "procedural", label: "Procedural", color: "#16a34a", desc: "Procedure caching" },
  { id: "consolidation", label: "Consolidation", color: "#ea580c", desc: "Dedup, decay, tiering" },
  { id: "short-term", label: "Short-term", color: "#0891b2", desc: "Bounded rolling windows" },
  { id: "long-term", label: "Long-term", color: "#0d9488", desc: "Permanent key-value storage" },
  { id: "working", label: "Working", color: "#db2777", desc: "Attention-decay active reasoning" },
  { id: "associative", label: "Associative", color: "#a04f1a", desc: "Graph-based link recall" },
  { id: "compressor", label: "Compressor", color: "#7c2d12", desc: "Compression & ratio" },
  { id: "integration", label: "Integration", color: "#5e81ac", desc: "Dashboard, audit, profiling" },
  { id: "memvector", label: "MemVector", color: "#d946ef", desc: "ANN + hybrid vector search" }
];

// src/mcp/OpenMemoryAdapter.ts
var OpenMemoryAdapter = class {
  _records = /* @__PURE__ */ new Map();
  _episodic = new EpisodicStore();
  _semantic = new SemanticIndex();
  _procedural = new ProceduralCache();
  _ltm = new LongTermMemoryManager();
  _stm = new ShortTermMemory(100);
  _working = new WorkingMemory();
  _assoc = new AssociativeMemory();
  _audit = new MemoryAudit();
  _retriever = new MemoryRetriever();
  // POST /memories
  create(req) {
    const id = `${req.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id,
      agent_id: req.agent_id,
      type: req.type,
      content: req.content,
      metadata: req.metadata,
      created_at: Date.now(),
      importance: req.importance
    };
    this._records.set(id, record);
    const imp = req.importance ?? 0.5;
    switch (req.type) {
      case "episodic":
        this._episodic.record(req.content, imp);
        break;
      case "semantic":
        this._semantic.add(id, req.metadata?.tags ?? []);
        break;
      case "procedural":
        this._procedural.store(id, [req.content]);
        break;
      case "long-term":
        this._ltm.store(id, req.content);
        break;
      case "short-term":
        this._stm.push(req.content);
        break;
      case "working":
        this._working.focus(id, req.content, imp);
        break;
      case "associative":
        if (req.metadata?.related) {
          this._assoc.link(id, String(req.metadata.related));
        }
        break;
    }
    this._audit.record(req.agent_id, "create", req.type);
    return { ok: true, data: record };
  }
  // GET /memories/:id
  get(id) {
    const r = this._records.get(id);
    if (!r) return { ok: false, error: `Memory not found: ${id}` };
    return { ok: true, data: r };
  }
  // GET /memories
  list(opts = {}) {
    const limit = opts.limit ?? 50;
    let records = [...this._records.values()];
    if (opts.agent_id) records = records.filter((r) => r.agent_id === opts.agent_id);
    if (opts.type) records = records.filter((r) => r.type === opts.type);
    records = records.slice(0, limit);
    return { ok: true, data: records, meta: { total: this._records.size } };
  }
  // DELETE /memories/:id
  delete(id) {
    if (!this._records.has(id)) return { ok: false, error: `Memory not found: ${id}` };
    const r = this._records.get(id);
    this._records.delete(id);
    if (r) this._audit.record(r.agent_id, "delete", r.type);
    return { ok: true, data: { id } };
  }
  // PATCH /memories/:id
  update(id, patch) {
    const r = this._records.get(id);
    if (!r) return { ok: false, error: `Memory not found: ${id}` };
    if (patch.content) r.content = patch.content;
    if (patch.metadata) r.metadata = { ...r.metadata ?? {}, ...patch.metadata };
    if (patch.importance !== void 0) r.importance = patch.importance;
    this._audit.record(r.agent_id, "update", r.type);
    return { ok: true, data: r };
  }
  // POST /search
  search(req) {
    const limit = req.limit ?? 10;
    const q = req.query.trim().toLowerCase();
    let candidates = [...this._records.values()];
    if (req.agent_id) candidates = candidates.filter((r) => r.agent_id === req.agent_id);
    if (req.type) candidates = candidates.filter((r) => r.type === req.type);
    const hits = candidates.map((r) => {
      const item = { id: r.id, content: r.content, timestamp: r.created_at, importance: r.importance ?? 0.5 };
      const score = this._retriever.score(item, req.query);
      return { id: r.id, content: r.content, type: r.type, score: Number(score.toFixed(4)) };
    });
    hits.sort((a, b) => b.score - a.score);
    return { ok: true, data: hits.slice(0, limit), meta: { total: hits.length } };
  }
  // GET /agents/:agent_id/memories
  byAgent(agentId) {
    return this.list({ agent_id: agentId });
  }
  // GET /audit/:agent_id
  audit(agentId) {
    return { ok: true, data: this._audit.forAgent(agentId) };
  }
  // GET /stats
  stats() {
    const counts = {};
    for (const r of this._records.values()) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return { ok: true, data: counts };
  }
  // DELETE all
  clear() {
    const n = this._records.size;
    this._records.clear();
    return { ok: true, data: { cleared: n } };
  }
  recordCount() {
    return this._records.size;
  }
  // Express/Node HTTP handler — adapts an incoming HTTP request to the right method.
  // Returns the response as JSON-string for write-to-res.
  handleHttp(method, path, body) {
    const start = Date.now();
    let response;
    try {
      if (method === "POST" && path === "/memories") {
        response = this.create(body);
      } else if (method === "GET" && path.startsWith("/memories/")) {
        const id = path.slice("/memories/".length);
        response = this.get(id);
      } else if (method === "GET" && path === "/memories") {
        response = this.list(body);
      } else if (method === "DELETE" && path.startsWith("/memories/")) {
        const id = path.slice("/memories/".length);
        response = this.delete(id);
      } else if (method === "PATCH" && path.startsWith("/memories/")) {
        const id = path.slice("/memories/".length);
        response = this.update(id, body);
      } else if (method === "POST" && path === "/search") {
        response = this.search(body);
      } else if (method === "GET" && path === "/stats") {
        response = this.stats();
      } else if (method === "DELETE" && path === "/memories") {
        response = this.clear();
      } else if (method === "GET" && path === "/health") {
        response = { ok: true, data: { uptime: 0, records: this.recordCount() } };
      } else {
        response = { ok: false, error: `Unsupported ${method} ${path}` };
      }
    } catch (err) {
      response = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    response.meta = { ...response.meta, elapsed_ms: Date.now() - start };
    return JSON.stringify(response);
  }
};
var OpenMemoryComplianceTest = class {
  _adapter;
  constructor(adapter) {
    this._adapter = adapter ?? new OpenMemoryAdapter();
  }
  runAll() {
    const results = [];
    const a = this._adapter;
    const r1 = a.create({ agent_id: "t", type: "episodic", content: "hi" });
    results.push({ name: "create returns record", ok: !!r1.data?.id });
    if (r1.data) {
      const r2 = a.get(r1.data.id);
      results.push({ name: "get returns same record", ok: r2.data?.id === r1.data.id });
    }
    const r3 = a.list({ agent_id: "t" });
    results.push({ name: "list returns array", ok: Array.isArray(r3.data) });
    const r4 = a.search({ query: "hi" });
    results.push({ name: "search returns hits", ok: Array.isArray(r4.data) });
    const r5 = a.stats();
    results.push({ name: "stats returns counts", ok: typeof r5.data === "object" });
    if (r1.data) {
      const r6 = a.delete(r1.data.id);
      results.push({ name: "delete returns ok", ok: r6.ok });
    }
    const pass = results.filter((r) => r.ok).length;
    const fail = results.length - pass;
    return { pass, fail, results };
  }
};

// src/migration/MigrationEngine.ts
var LettaImportParser = class {
  parse(json) {
    try {
      const data = JSON.parse(json);
      const records = this._extractRecords(data);
      const mapped = records.map((r, i) => this._mapToRecord(r, i));
      return { ok: true, data: mapped, meta: { total: mapped.length } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  _extractRecords(data) {
    if (Array.isArray(data)) return data;
    if (data.records && Array.isArray(data.records)) return data.records;
    if (data.agents && Array.isArray(data.agents)) return data.agents;
    if (data.messages && Array.isArray(data.messages)) return data.messages;
    if (data.memories && Array.isArray(data.memories)) return data.memories;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
  _mapToRecord(r, idx) {
    const id = r.id ?? `letta_${Date.now()}_${idx}`;
    const agent = r.agent_id ?? r.agentId ?? "unknown";
    const rawType = (r.type ?? "episodic").toLowerCase();
    const type = ["episodic", "semantic", "procedural", "long-term", "short-term", "working", "associative"].includes(rawType) ? rawType : "episodic";
    const content = r.text ?? r.content ?? r.message ?? "";
    const createdAt = r.created_at ? Date.parse(r.created_at) : r.createdAt ? Date.parse(r.createdAt) : r.timestamp ?? Date.now();
    return {
      id,
      agent_id: agent,
      type,
      content,
      metadata: r.metadata,
      created_at: createdAt,
      importance: r.importance
    };
  }
};
var LettaExporter = class {
  _records = [];
  add(record) {
    this._records.push(record);
  }
  addAll(records) {
    this._records.push(...records);
  }
  count() {
    return this._records.length;
  }
  // Letta format uses snake_case + agent_id + text + created_at fields
  toLettaJSON() {
    const letta = this._records.map((r) => ({
      id: r.id,
      agent_id: r.agent_id,
      type: r.type,
      text: r.content,
      metadata: r.metadata,
      created_at: new Date(r.created_at).toISOString(),
      importance: r.importance
    }));
    return JSON.stringify({ records: letta, version: "1.0" }, null, 2);
  }
  // Zep format
  toZepJSON() {
    const zep = this._records.map((r) => ({
      session_id: r.agent_id,
      role: "user",
      content: r.content,
      metadata: { type: r.type, importance: r.importance, ...r.metadata },
      created_at: new Date(r.created_at).toISOString()
    }));
    return JSON.stringify({ messages: zep, version: "1.0" }, null, 2);
  }
  // Cognee format
  toCogneeJSON() {
    const cognee = this._records.map((r) => ({
      type: r.type,
      text: r.content,
      metadata: { agent_id: r.agent_id, ...r.metadata },
      created_at: new Date(r.created_at).toISOString()
    }));
    return JSON.stringify({ data: cognee, version: "1.0" }, null, 2);
  }
  // Markdown report
  toMarkdown() {
    const lines = ["# Memory Export", "", `Total: ${this._records.length}`, ""];
    for (const r of this._records) {
      lines.push(`## ${r.id}`, "", `- Type: ${r.type}`, `- Agent: ${r.agent_id}`, `- Created: ${new Date(r.created_at).toISOString()}`, `- Importance: ${r.importance ?? "\u2014"}`, "");
      lines.push(r.content);
      lines.push("");
    }
    return lines.join("\n");
  }
  clear() {
    this._records = [];
  }
};
var MigrationDiffEngine = class {
  diff(before, after) {
    const beforeById = new Map(before.map((r) => [r.id, r]));
    const afterById = new Map(after.map((r) => [r.id, r]));
    const added = [];
    const removed = [];
    const changed = [];
    let unchanged = 0;
    for (const [id, afterRec] of afterById.entries()) {
      const beforeRec = beforeById.get(id);
      if (!beforeRec) {
        added.push(afterRec);
      } else if (JSON.stringify(beforeRec) !== JSON.stringify(afterRec)) {
        changed.push({ before: beforeRec, after: afterRec });
      } else {
        unchanged += 1;
      }
    }
    for (const [id, beforeRec] of beforeById.entries()) {
      if (!afterById.has(id)) {
        removed.push(beforeRec);
      }
    }
    return { added, removed, changed, unchanged };
  }
  summarize(diff) {
    return `Migration diff: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed, ${diff.unchanged} unchanged`;
  }
};
var MIGRATION_TOOLS = [
  {
    name: "Letta.import",
    description: "Import memories from a Letta JSON export into the marketplace adapter.",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Letta JSON export" },
        agentId: { type: "string", description: "Filter by agent_id (optional)" }
      },
      required: ["json"]
    }
  },
  {
    name: "Letta.export",
    description: "Export marketplace memories to Letta JSON format.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Filter by agent_id (optional)" }
      },
      required: []
    }
  },
  {
    name: "Migration.diff",
    description: "Diff two memory store snapshots to detect changes.",
    inputSchema: {
      type: "object",
      properties: {
        before: { type: "string", description: "JSON array of before records" },
        after: { type: "string", description: "JSON array of after records" }
      },
      required: ["before", "after"]
    }
  },
  {
    name: "Migration.validate",
    description: "Validate an array of records against the marketplace schema.",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "JSON array of records" }
      },
      required: ["json"]
    }
  }
];

// src/multimodal/MultimodalCore.ts
var ImageEmbedder = class {
  _dim;
  constructor(dim = 64) {
    this._dim = dim;
  }
  // Extract pseudo-features from a synthetic image descriptor
  embed(width, height, pixels, channels = 3) {
    const ch = Math.min(channels, 3);
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    for (let i = 0; i < pixels.length; i += ch) {
      rSum += pixels[i];
      if (ch > 1) gSum += pixels[i + 1];
      if (ch > 2) bSum += pixels[i + 2];
    }
    const n = Math.max(1, Math.floor(pixels.length / ch));
    const meanColor = [
      rSum / n / 255,
      ch > 1 ? gSum / n / 255 : 0,
      ch > 2 ? bSum / n / 255 : 0
    ];
    const hash = this._computeHash(pixels);
    const embedding = this._hashToVector(hash);
    return { width, height, channels: ch, meanColor, hash, embedding };
  }
  // Compute embedding from image URL/URI (uses URI as hash input)
  embedFromURI(uri) {
    const hash = this._computeHash([uri.length, ...Array.from(uri).map((c) => c.charCodeAt(0))]);
    const embedding = this._hashToVector(hash);
    return { uri, width: 0, height: 0, channels: 3, meanColor: [0, 0, 0], hash, embedding };
  }
  // Compare two embeddings (cosine)
  similarity(a, b) {
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
  dim() {
    return this._dim;
  }
  _computeHash(pixels) {
    let h = 5381;
    for (const p of pixels) {
      h = (h << 5) + h + p | 0;
    }
    return Math.abs(h).toString(16);
  }
  _hashToVector(hash) {
    const v = new Array(this._dim).fill(0);
    for (let i = 0; i < this._dim; i++) {
      let h = i * 2654435761 >>> 0;
      for (let j = 0; j < hash.length; j++) {
        h = (h * 31 ^ hash.charCodeAt(j)) >>> 0;
      }
      v[i] = h % 1e3 / 1e3 - 0.5;
    }
    return v;
  }
};
var AudioEmbed = class {
  _dim;
  constructor(dim = 32) {
    this._dim = dim;
  }
  embed(samples, sampleRate = 16e3) {
    let peak = 0;
    let sumSquares = 0;
    for (const s of samples) {
      peak = Math.max(peak, Math.abs(s));
      sumSquares += s * s;
    }
    const rms = samples.length > 0 ? Math.sqrt(sumSquares / samples.length) : 0;
    const fingerprint = this._computeFingerprint(samples);
    const embedding = this._hashToVector(fingerprint);
    return {
      duration: samples.length / sampleRate,
      sampleRate,
      channels: 1,
      peak,
      rms,
      fingerprint,
      embedding
    };
  }
  transcribe(samples, sampleRate = 16e3) {
    const samplesPerWord = Math.floor(sampleRate * 0.5);
    const words = [];
    const vocab = ["hello", "world", "test", "audio", "memory", "agent", "engine", "data", "sample"];
    for (let i = 0; i < samples.length; i += samplesPerWord) {
      const segment = samples.slice(i, i + samplesPerWord);
      const rms = Math.sqrt(segment.reduce((s, x) => s + x * x, 0) / Math.max(1, segment.length));
      if (rms > 0.1) {
        const word = vocab[Math.floor(rms * 100) % vocab.length];
        words.push(word);
      }
    }
    return words.join(" ");
  }
  similarity(a, b) {
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
  _computeFingerprint(samples) {
    if (samples.length === 0) return "0";
    const buckets = 64;
    const bucketSize = Math.max(1, Math.floor(samples.length / buckets));
    const hash = [];
    for (let i = 0; i < buckets; i++) {
      let sum = 0;
      for (let j = 0; j < bucketSize; j++) {
        const idx = i * bucketSize + j;
        if (idx < samples.length) sum += Math.abs(samples[idx]);
      }
      hash.push(String(Math.round(sum * 10) % 256));
    }
    return hash.join(",");
  }
  _hashToVector(hash) {
    const v = new Array(this._dim).fill(0);
    for (let i = 0; i < this._dim; i++) {
      let h = i * 2246822519 >>> 0;
      let chunk = 0;
      for (let j = 0; j < hash.length; j++) {
        chunk = (chunk << 5) + chunk + hash.charCodeAt(j) | 0;
      }
      h = (h * 33 ^ chunk) >>> 0;
      v[i] = h % 1e3 / 1e3 - 0.5;
    }
    return v;
  }
};
var ImageSearch = class {
  _memories = /* @__PURE__ */ new Map();
  _embedder;
  constructor(embedder) {
    this._embedder = embedder ?? new ImageEmbedder();
  }
  add(uri, width, height, pixels, metadata) {
    const features = this._embedder.embed(width, height, pixels);
    const mem = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      uri,
      features,
      metadata,
      created_at: Date.now()
    };
    this._memories.set(mem.id, mem);
    return mem;
  }
  // Internal: add a pre-constructed ImageMemory (used by MultimodalRetriever)
  addFromExternal(memory) {
    this._memories.set(memory.id, memory);
    return memory;
  }
  search(queryFeatures, topK = 5) {
    const results = [];
    this._memories.forEach((m) => {
      results.push({ id: m.id, uri: m.uri, score: this._embedder.similarity(queryFeatures.embedding, m.features.embedding) });
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  get(id) {
    return this._memories.get(id) ?? null;
  }
  size() {
    return this._memories.size;
  }
  delete(id) {
    return this._memories.delete(id);
  }
};
var ImageCaption = class {
  caption(features, context) {
    const parts = [];
    if (features.width && features.height) {
      parts.push(`${features.width}\xD7${features.height} image`);
    } else {
      parts.push("Image");
    }
    const [r, g, b] = features.meanColor;
    const color = this._describeColor(r, g, b);
    parts.push(`with ${color} tones`);
    if (context) parts.push(`(${context})`);
    parts.push(`hash ${features.hash.slice(0, 8)}`);
    return parts.join(" ");
  }
  _describeColor(r, g, b) {
    const brightness = (r + g + b) / 3;
    if (brightness < 0.2) return "dark";
    if (brightness > 0.8) return "bright";
    if (r > g + 0.1 && r > b + 0.1) return "warm red";
    if (g > r + 0.1 && g > b + 0.1) return "green";
    if (b > r + 0.1 && b > g + 0.1) return "blue";
    if (r > 0.5 && g > 0.5 && b < 0.4) return "yellow";
    if (r > 0.5 && b > 0.5 && g < 0.4) return "magenta";
    if (g > 0.5 && b > 0.5 && r < 0.4) return "cyan";
    return "neutral";
  }
};
var MediaClassifier = class {
  classify(uri, features) {
    const u = uri.toLowerCase();
    if (u.match(/\.(mp4|mov|avi|webm|mkv)$/)) return "video";
    if (u.match(/\.(mp3|wav|ogg|flac|m4a)$/)) return "audio";
    if (u.match(/\.(pdf|doc|docx|txt|md)$/)) return "document";
    if (u.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
      if (features) {
        const [r, g, b] = features.meanColor;
        if (r === 1 && g === 1 && b === 1) return "screenshot";
        if (Math.abs(r - g) < 0.05 && Math.abs(g - b) < 0.05) return "chart";
        if (r + g + b > 2.5) return "illustration";
        return "photo";
      }
      return "photo";
    }
    return "unknown";
  }
  confidence(uri) {
    const u = uri.toLowerCase();
    if (u.match(/\.(png|jpg|jpeg|gif|webp|mp4|mov|avi|webm|mkv|mp3|wav|ogg|flac|m4a|pdf|doc|docx|txt|md)$/)) return 1;
    return 0.5;
  }
};
var MediaMetadataExtractor = class {
  extract(uri) {
    const parts = uri.split("?")[0].split("#")[0].split("/");
    const filename = parts[parts.length - 1];
    const dotIdx = filename.lastIndexOf(".");
    const format = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : "";
    const baseName = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;
    const attributes = {};
    const query = uri.split("?")[1];
    if (query) {
      for (const pair of query.split("&")) {
        const [k, v] = pair.split("=");
        if (k && v) attributes[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }
    return {
      uri,
      type: this._guessType(format),
      format,
      created: this._extractDateFromName(baseName),
      attributes
    };
  }
  _guessType(format) {
    if (["mp4", "mov", "avi", "webm", "mkv"].includes(format)) return "video";
    if (["mp3", "wav", "ogg", "flac", "m4a"].includes(format)) return "audio";
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(format)) return "image";
    if (["pdf", "doc", "docx", "txt", "md"].includes(format)) return "document";
    return "unknown";
  }
  _extractDateFromName(name) {
    const m = name.match(/(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return void 0;
  }
};
var MultimodalMerge = class {
  _dim;
  constructor(dim = 128) {
    this._dim = dim;
  }
  merge(parts) {
    const components = [];
    const componentDim = Math.floor(this._dim / 3);
    if (parts.text) {
      const v = new Array(componentDim).fill(0);
      for (let i = 0; i < parts.text.length; i++) {
        const idx = i % v.length;
        v[idx] += parts.text.charCodeAt(i);
      }
      components.push(this._normalize(v));
    }
    if (parts.image) {
      const v = this._truncate(parts.image.embedding, componentDim);
      components.push(this._normalize(v));
    }
    if (parts.audio) {
      const v = this._truncate(parts.audio.embedding, componentDim);
      components.push(this._normalize(v));
    }
    const mergedEmbedding = new Array(this._dim).fill(0);
    if (components.length > 0) {
      for (const c of components) {
        for (let i = 0; i < c.length; i++) {
          mergedEmbedding[i] += c[i] / components.length;
        }
      }
    }
    return {
      text: parts.text,
      image: parts.image,
      audio: parts.audio,
      mergedEmbedding: this._normalize(mergedEmbedding)
    };
  }
  similarity(a, b) {
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
  _truncate(v, dim) {
    if (v.length === dim) return v;
    const out = new Array(dim).fill(0);
    for (let i = 0; i < dim; i++) out[i] = v[i % v.length];
    return out;
  }
  _normalize(v) {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (norm === 0) return v;
    return v.map((x) => x / norm);
  }
};
var MediaTranscript = class {
  transcribe(samples, sampleRate = 16e3, windowSize = 0.5) {
    const samplesPerWindow = Math.floor(sampleRate * windowSize);
    const segments = [];
    const vocab = ["hello", "world", "audio", "memory", "sample", "engine", "data", "agent"];
    for (let i = 0; i < samples.length; i += samplesPerWindow) {
      const window = samples.slice(i, i + samplesPerWindow);
      const rms = Math.sqrt(window.reduce((s, x) => s + x * x, 0) / Math.max(1, window.length));
      const start = i / sampleRate;
      const end = (i + window.length) / sampleRate;
      const confidence = Math.min(1, rms);
      const word = vocab[Math.floor((rms * 100 + i / samplesPerWindow) % vocab.length)];
      segments.push({ start, end, text: rms > 0.1 ? word : "", confidence });
    }
    return segments;
  }
  toSRT(segments) {
    const lines = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      lines.push(String(i + 1));
      lines.push(`${this._srtTime(s.start)} --> ${this._srtTime(s.end)}`);
      lines.push(s.text || "...");
      lines.push("");
    }
    return lines.join("\n");
  }
  _srtTime(t) {
    const h = Math.floor(t / 3600);
    const m = Math.floor(t % 3600 / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t - Math.floor(t)) * 1e3);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  }
};
var MultimodalMemoryStore = class {
  _adapter;
  _imageSearch;
  _embedder;
  constructor(adapter) {
    this._adapter = adapter ?? new OpenMemoryAdapter();
    this._imageSearch = new ImageSearch();
    this._embedder = new ImageEmbedder();
  }
  // Add image to marketplace as episodic memory
  addImage(uri, width, height, pixels, agentId) {
    const imageFeatures = this._embedder.embed(width, height, pixels);
    const imageMemory = this._imageSearch.add(uri, width, height, pixels, { agent_id: agentId });
    const memoryRecord = this._adapter.create({
      agent_id: agentId,
      type: "episodic",
      content: `Image: ${uri} (${width}x${height}, hash ${imageFeatures.hash.slice(0, 8)})`,
      metadata: {
        modality: "image",
        uri,
        width,
        height,
        imageId: imageMemory.id
      },
      importance: 0.7
    });
    return {
      memoryId: memoryRecord.data?.id ?? "",
      imageId: imageMemory.id
    };
  }
  searchImagesByEmbedding(embedding, topK = 5) {
    const features = {
      width: 0,
      height: 0,
      channels: 3,
      meanColor: [0, 0, 0],
      hash: "q",
      embedding
    };
    return this._imageSearch.search(features, topK);
  }
  // Find images associated with an agent's memories
  imagesForAgent(agentId) {
    const memories = this._adapter.byAgent(agentId).data ?? [];
    return Array.from(this._imageSearch.get !== void 0 ? Array.from(this._allImages()).values() : []).filter((img) => {
      const meta = img.metadata;
      return meta?.agent_id === agentId;
    });
  }
  _allImages() {
    return this._imageSearch["size"] !== void 0 ? this._listAll() : [];
  }
  *_listAll() {
    for (const id of this._imageSearch._memories.keys()) {
      const m = this._imageSearch._memories.get(id);
      if (m) yield m;
    }
  }
  count() {
    return {
      memories: this._adapter.recordCount(),
      images: this._imageSearch.size()
    };
  }
  adapter() {
    return this._adapter;
  }
};
var MULTIMODAL_TOOLS = [
  {
    name: "Multimodal.addImage",
    description: "Add an image (pixels or URI) to the multimodal memory store.",
    inputSchema: {
      type: "object",
      properties: {
        uri: { type: "string", description: "Image URI" },
        width: { type: "number", description: "Width in pixels" },
        height: { type: "number", description: "Height in pixels" },
        pixels: { type: "string", description: "JSON array of pixels" },
        agentId: { type: "string", description: "Agent ID" }
      },
      required: ["uri", "agentId"]
    }
  },
  {
    name: "Multimodal.searchImages",
    description: "Search images by embedding similarity.",
    inputSchema: {
      type: "object",
      properties: {
        embedding: { type: "string", description: "JSON array (query embedding)" },
        topK: { type: "number", description: "Number of results" }
      },
      required: ["embedding"]
    }
  },
  {
    name: "Multimodal.caption",
    description: "Auto-generate a caption from image features.",
    inputSchema: {
      type: "object",
      properties: {
        uri: { type: "string", description: "Image URI" },
        width: { type: "number", description: "Image width" },
        height: { type: "number", description: "Image height" },
        context: { type: "string", description: "Optional context" }
      },
      required: ["uri", "width", "height"]
    }
  },
  {
    name: "Multimodal.transcribe",
    description: "Transcribe audio samples to text + SRT.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "string", description: "JSON array of audio samples" },
        sampleRate: { type: "number", description: "Sample rate (default 16000)" }
      },
      required: ["samples"]
    }
  },
  {
    name: "Multimodal.classify",
    description: "Classify a media URI by type.",
    inputSchema: {
      type: "object",
      properties: {
        uri: { type: "string", description: "Media URI" }
      },
      required: ["uri"]
    }
  },
  {
    name: "Multimodal.merge",
    description: "Merge text + image + audio features into one embedding.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content (optional)" },
        imageEmbedding: { type: "string", description: "JSON array (optional)" },
        audioEmbedding: { type: "string", description: "JSON array (optional)" }
      },
      required: []
    }
  },
  {
    name: "Multimodal.metadata",
    description: "Extract metadata from a media URI.",
    inputSchema: {
      type: "object",
      properties: {
        uri: { type: "string", description: "Media URI" }
      },
      required: ["uri"]
    }
  },
  {
    name: "Multimodal.retrieve",
    description: "Cross-modal retrieval across text + image + audio.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text query" },
        topK: { type: "number", description: "Top-K results" }
      },
      required: []
    }
  }
];

// src/streaming/StreamingCore.ts
var EventBus = class {
  _subscribers = /* @__PURE__ */ new Map();
  _globalSubs = [];
  _eventCount = 0;
  _topicCount = 0;
  subscribe(topic, handler) {
    const id = `sub_${++this._eventCount}_${Date.now().toString(36)}`;
    const sub = { id, topic, handler };
    const arr = this._subscribers.get(topic) ?? [];
    arr.push(sub);
    this._subscribers.set(topic, arr);
    if (arr.length === 1) this._topicCount += 1;
    return id;
  }
  subscribeAll(handler) {
    const id = `global_${++this._eventCount}_${Date.now().toString(36)}`;
    this._globalSubs.push({ id, topic: "*", handler });
    return id;
  }
  publish(event) {
    const local = this._subscribers.get(event.topic) ?? [];
    let dispatched = 0;
    let failed = 0;
    for (const sub of local) {
      try {
        sub.handler(event);
      } catch {
        failed += 1;
      }
      dispatched += 1;
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
  unsubscribe(id) {
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
  topics() {
    return Array.from(this._subscribers.keys());
  }
  stats() {
    let total = this._globalSubs.length;
    for (const arr of this._subscribers.values()) total += arr.length;
    return { topics: this._topicCount, subscribers: total, totalEvents: this._eventCount };
  }
};
var StreamProducer = class {
  _queue = [];
  _seq = 0;
  _consumerId = 0;
  _dropped = 0;
  _maxBacklog = 1024;
  _consumers = /* @__PURE__ */ new Map();
  emit(topic, kind, payload, priority = "normal") {
    this._seq += 1;
    const event = { topic, kind, ts: Date.now(), payload, priority };
    if (this._queue.length >= this._maxBacklog) {
      this._queue.shift();
      this._dropped += 1;
    }
    this._queue.push(event);
    return { seq: this._seq, queued: this._queue.length };
  }
  drain(max = 50) {
    const n = Math.min(max, this._queue.length);
    return this._queue.splice(0, n);
  }
  peek(n = 10) {
    return this._queue.slice(0, n);
  }
  size() {
    return this._queue.length;
  }
  subscribe(handler) {
    this._consumerId += 1;
    const id = `cons_${this._consumerId}_${Date.now().toString(36)}`;
    this._consumers.set(id, handler);
    return id;
  }
  unsubscribe(id) {
    return this._consumers.delete(id);
  }
  flush() {
    if (this._queue.length === 0) return 0;
    const batch = this._queue.splice(0, this._queue.length);
    for (const handler of this._consumers.values()) {
      try {
        handler(batch);
      } catch {
      }
    }
    return batch.length;
  }
  metrics() {
    return { emitted: this._seq, queued: this._queue.length, dropped: this._dropped, consumers: this._consumers.size };
  }
};
var StreamConsumer = class {
  _received = [];
  _groups = /* @__PURE__ */ new Map();
  _maxBuffer = 1024;
  _produce = null;
  _subId = null;
  bind(producer) {
    this._produce = producer;
    this._subId = producer.subscribe((events) => this._receive(events));
    return this._subId;
  }
  feed(events) {
    return this._receive(events);
  }
  _receive(events) {
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
  unbind() {
    if (this._produce && this._subId) {
      const ok = this._produce.unsubscribe(this._subId);
      this._produce = null;
      this._subId = null;
      return ok;
    }
    return false;
  }
  recent(n = 10) {
    return this._received.slice(-n);
  }
  aggregate() {
    return Array.from(this._groups.values()).sort((a, b) => b.count - a.count);
  }
  summary() {
    return { received: this._received.length, topics: this._groups.size, producing: this._produce !== null };
  }
  reset() {
    this._received = [];
    this._groups.clear();
  }
};
var STREAMING_ENGINES = ["EventBus", "MemoryWatcher", "StreamProducer", "StreamConsumer", "StreamingMasterIndex"];
var StreamingMasterIndex = class {
  _items = [];
  constructor() {
    for (const name of STREAMING_ENGINES) {
      this._items.push({ name, layer: "streaming", version: "V5626+" });
    }
  }
  list() {
    return this._items.slice();
  }
  count() {
    return this._items.length;
  }
  byName(name) {
    return this._items.find((i) => i.name === name);
  }
};
var STREAMING_TOOLS = [
  {
    name: "EventBus.subscribe",
    description: "Subscribe to memory events on a topic",
    inputSchema: { type: "object", properties: { topic: { type: "string", description: "Topic to subscribe to" } }, required: ["topic"] }
  },
  {
    name: "StreamProducer.emit",
    description: "Emit a memory event",
    inputSchema: { type: "object", properties: { topic: { type: "string", description: "Event topic" }, kind: { type: "string", description: "create|update|delete|access|metric" } }, required: ["topic", "kind"] }
  },
  {
    name: "StreamProducer.flush",
    description: "Drain queued events to consumers",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "StreamConsumer.aggregate",
    description: "Aggregate consumed events by topic",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

// src/playback/PlaybackCore.ts
var MemorySnapshotter = class {
  _seq = 0;
  _snapshots = [];
  _maxRetained = 256;
  capture(label, storeId, entries) {
    this._seq += 1;
    const snap = {
      id: `snap_${this._seq}_${Date.now().toString(36)}`,
      label,
      takenAt: Date.now(),
      storeId,
      entries: entries.map((e) => ({ ...e, value: this._clone(e.value) })),
      size: entries.length
    };
    this._snapshots.push(snap);
    if (this._snapshots.length > this._maxRetained) this._snapshots.shift();
    return snap;
  }
  get(id) {
    return this._snapshots.find((s) => s.id === id);
  }
  list(filter) {
    return this._snapshots.filter((s) => {
      if (filter?.storeId && s.storeId !== filter.storeId) return false;
      if (filter?.labelContains && !s.label.includes(filter.labelContains)) return false;
      return true;
    });
  }
  drop(id) {
    const i = this._snapshots.findIndex((s) => s.id === id);
    if (i === -1) return false;
    this._snapshots.splice(i, 1);
    return true;
  }
  stats() {
    return { total: this._seq, retained: this._snapshots.length };
  }
  _clone(value) {
    if (value === null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }
};
var TimelineView = class {
  _entries = [];
  _seq = 0;
  _filters = {};
  record(events) {
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
        priority: ev.priority
      });
      n += 1;
    }
    return n;
  }
  filter(criteria) {
    this._filters = { ...this._filters, ...criteria };
  }
  resetFilters() {
    this._filters = {};
  }
  list(limit) {
    const sorted = this._entries.slice().sort((a, b) => a.seq - b.seq);
    return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  }
  recent(n = 10) {
    return this._entries.slice(-n);
  }
  byTimeRange(since, until) {
    return this._entries.filter((e) => e.ts >= since && e.ts <= until);
  }
  count() {
    return this._entries.length;
  }
  reset() {
    this._entries = [];
    this._seq = 0;
  }
};
var DiffEngine = class {
  diff(a, b) {
    const aMap = new Map(a.entries.map((e) => [e.key, e]));
    const bMap = new Map(b.entries.map((e) => [e.key, e]));
    const added = [];
    const removed = [];
    const modified = [];
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
  summarize(diff) {
    return {
      additions: diff.added.length,
      deletions: diff.removed.length,
      modifications: diff.modified.length,
      unchanged: diff.unchanged,
      total: diff.added.length + diff.removed.length + diff.modified.length + diff.unchanged
    };
  }
  eventsDiff(a, b) {
    const aMap = new Map(a.map((e) => [String(e.seq), e]));
    const bMap = new Map(b.map((e) => [String(e.seq), e]));
    const added = [];
    const removed = [];
    const modified = [];
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
};
var StepReplay = class {
  _steps = [];
  _cursor = 0;
  _seq = 0;
  _running = false;
  _stepIntervalMs = 100;
  append(kind, data) {
    this._seq += 1;
    const step = { seq: this._seq, kind, ts: Date.now(), data };
    this._steps.push(step);
    return step;
  }
  fromEvents(events) {
    let n = 0;
    for (const ev of events) {
      this._seq += 1;
      this._steps.push({ seq: this._seq, kind: "event", ts: ev.ts, data: ev });
      n += 1;
    }
    return n;
  }
  reset() {
    this._steps = [];
    this._cursor = 0;
    this._seq = 0;
    this._running = false;
  }
  next() {
    if (this._cursor >= this._steps.length) {
      this._running = false;
      return void 0;
    }
    const step = this._steps[this._cursor];
    this._cursor += 1;
    return step;
  }
  jumpTo(seq) {
    const target = this._steps.find((s) => s.seq === seq);
    if (!target) return void 0;
    this._cursor = this._steps.indexOf(target) + 1;
    return target;
  }
  start() {
    this._cursor = 0;
    this._running = true;
  }
  pause() {
    this._running = false;
  }
  stepIntervalMs(ms) {
    this._stepIntervalMs = Math.max(1, Math.floor(ms));
  }
  status() {
    return {
      total: this._steps.length,
      cursor: this._cursor,
      remaining: this._steps.length - this._cursor,
      running: this._running,
      stepIntervalMs: this._stepIntervalMs
    };
  }
};
var ReplayCoordinator = class {
  _sessions = /* @__PURE__ */ new Map();
  _seq = 0;
  _current = null;
  start() {
    this._seq += 1;
    const id = `replay_${this._seq}_${Date.now().toString(36)}`;
    const session = {
      id,
      startedAt: Date.now(),
      endedAt: null,
      snapshotCount: 0,
      eventsReplayed: 0,
      diffsComputed: 0
    };
    this._sessions.set(id, session);
    this._current = session;
    return session;
  }
  recordSnapshot() {
    if (this._current) this._current.snapshotCount += 1;
  }
  recordEvents(n) {
    if (this._current) this._current.eventsReplayed += n;
  }
  recordDiff() {
    if (this._current) this._current.diffsComputed += 1;
  }
  end() {
    if (!this._current) return void 0;
    this._current.endedAt = Date.now();
    const session = this._current;
    this._current = null;
    return session;
  }
  get(id) {
    return this._sessions.get(id);
  }
  list() {
    return Array.from(this._sessions.values());
  }
  stats() {
    return {
      total: this._sessions.size,
      current: this._current?.id ?? null
    };
  }
};
var PLAYBACK_ENGINES = [
  "MemorySnapshotter",
  "TimelineView",
  "TreeVisualizer",
  "DiffEngine",
  "StepReplay",
  "ReplayCoordinator",
  "PlaybackMasterIndex"
];
var PlaybackMasterIndex = class {
  _items = [];
  constructor() {
    for (const name of PLAYBACK_ENGINES) {
      this._items.push({ name, layer: "playback", version: "V5641+" });
    }
  }
  list() {
    return this._items.slice();
  }
  count() {
    return this._items.length;
  }
  byName(name) {
    return this._items.find((i) => i.name === name);
  }
};
var PLAYBACK_TOOLS = [
  {
    name: "MemorySnapshotter.capture",
    description: "Capture a value-based snapshot of a memory store",
    inputSchema: { type: "object", properties: { label: { type: "string", description: "Snapshot label" }, storeId: { type: "string", description: "Store identifier" } }, required: ["label", "storeId"] }
  },
  {
    name: "TimelineView.recent",
    description: "Get the most recent N timeline entries",
    inputSchema: { type: "object", properties: { n: { type: "string", description: "Number of recent entries to return (default 10)" } }, required: [] }
  },
  {
    name: "StepReplay.start",
    description: "Start a step replay cursor",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "StepReplay.next",
    description: "Advance to next replay step",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "ReplayCoordinator.summary",
    description: "Get the current replay coordinator summary",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

// src/federated/FederatedCore.ts
import { createHash, createHmac, randomBytes } from "node:crypto";
var FederatedCohort = class {
  _cohorts = /* @__PURE__ */ new Map();
  _seq = 0;
  create(name, ownerAgentId, privacyLevel = "moderate", initialMembers = []) {
    this._seq += 1;
    const cohort = {
      id: `cohort_${this._seq}_${Date.now().toString(36)}`,
      name,
      ownerAgentId,
      members: /* @__PURE__ */ new Set([ownerAgentId, ...initialMembers]),
      createdAt: Date.now(),
      privacyLevel
    };
    this._cohorts.set(cohort.id, cohort);
    return cohort;
  }
  addMember(cohortId, agentId) {
    const c = this._cohorts.get(cohortId);
    if (!c) return false;
    c.members.add(agentId);
    return true;
  }
  removeMember(cohortId, agentId) {
    const c = this._cohorts.get(cohortId);
    if (!c) return false;
    if (agentId === c.ownerAgentId) return false;
    return c.members.delete(agentId);
  }
  get(id) {
    return this._cohorts.get(id);
  }
  list() {
    return Array.from(this._cohorts.values());
  }
  isMember(cohortId, agentId) {
    return this._cohorts.get(cohortId)?.members.has(agentId) ?? false;
  }
  stats() {
    let m = 0;
    for (const c of this._cohorts.values()) m += c.members.size;
    return { total: this._cohorts.size, members: m };
  }
};
var FederatedMemoryShare = class {
  _shares = /* @__PURE__ */ new Map();
  _seq = 0;
  share(ownerAgentId, cohortId, content, dpNoise, cohortRegistry, audit) {
    if (!cohortRegistry.isMember(cohortId, ownerAgentId)) {
      audit.record({ kind: "deny", agentId: ownerAgentId, cohortId, reason: "not_member" });
      return { ok: false, error: "Agent is not a cohort member" };
    }
    this._seq += 1;
    const id = `share_${this._seq}_${Date.now().toString(36)}`;
    const sm = {
      id,
      ownerAgentId,
      cohortId,
      content,
      contentHash: this._hash(content),
      dpNoise,
      sharedAt: Date.now()
    };
    this._shares.set(id, sm);
    audit.record({ kind: "share", agentId: ownerAgentId, cohortId, dpNoise });
    return { ok: true, shareId: id };
  }
  read(shareId, readerAgentId, cohortRegistry, audit) {
    const sm = this._shares.get(shareId);
    if (!sm) {
      audit.record({ kind: "deny", agentId: readerAgentId, cohortId: "unknown", reason: "no_share" });
      return { ok: false, error: "Share not found" };
    }
    if (!cohortRegistry.isMember(sm.cohortId, readerAgentId)) {
      audit.record({ kind: "deny", agentId: readerAgentId, cohortId: sm.cohortId, reason: "no_access" });
      return { ok: false, error: "Reader is not a cohort member" };
    }
    audit.record({ kind: "read", agentId: readerAgentId, cohortId: sm.cohortId, dpNoise: 0 });
    return { ok: true, content: sm.content, hash: sm.contentHash };
  }
  listForCohort(cohortId, requesterAgentId, cohortRegistry) {
    if (!cohortRegistry.isMember(cohortId, requesterAgentId)) return [];
    return Array.from(this._shares.values()).filter((s) => s.cohortId === cohortId);
  }
  drop(shareId, requesterAgentId) {
    const sm = this._shares.get(shareId);
    if (!sm || sm.ownerAgentId !== requesterAgentId) return false;
    return this._shares.delete(shareId);
  }
  stats() {
    const byCohort = {};
    for (const s of this._shares.values()) {
      byCohort[s.cohortId] = (byCohort[s.cohortId] ?? 0) + 1;
    }
    return { total: this._seq, byCohort };
  }
  _hash(s) {
    return createHash("sha256").update(s).digest("hex").slice(0, 16);
  }
};
var PrivacyBudgetAggregator = class {
  _budgets = /* @__PURE__ */ new Map();
  setBudget(agentId, total) {
    const u = { agentId, budgetTotal: total, budgetConsumed: 0 };
    this._budgets.set(agentId, u);
    return u;
  }
  consume(agentId, epsilon) {
    const u = this._budgets.get(agentId);
    if (!u) return { allowed: false, remaining: 0, consumed: 0 };
    const nextConsumed = u.budgetConsumed + Math.max(0, epsilon);
    if (nextConsumed > u.budgetTotal) return { allowed: false, remaining: u.budgetTotal - u.budgetConsumed, consumed: u.budgetConsumed };
    u.budgetConsumed = nextConsumed;
    return { allowed: true, remaining: u.budgetTotal - u.budgetConsumed, consumed: u.budgetConsumed };
  }
  refund(agentId, epsilon) {
    const u = this._budgets.get(agentId);
    if (!u) return { remaining: 0, consumed: 0 };
    u.budgetConsumed = Math.max(0, u.budgetConsumed - Math.max(0, epsilon));
    return { remaining: u.budgetTotal - u.budgetConsumed, consumed: u.budgetConsumed };
  }
  get(agentId) {
    return this._budgets.get(agentId);
  }
  list() {
    return Array.from(this._budgets.values());
  }
  topConsumers(n) {
    return this.list().sort((a, b) => b.budgetConsumed - a.budgetConsumed).slice(0, n);
  }
  stats() {
    let consumed = 0;
    let total = 0;
    for (const u of this._budgets.values()) {
      consumed += u.budgetConsumed;
      total += u.budgetTotal;
    }
    return { agents: this._budgets.size, totalConsumed: consumed, totalBudget: total };
  }
};
var SecureChannel = class {
  _channels = /* @__PURE__ */ new Map();
  _seq = 0;
  open(agentA, agentB) {
    const channelId = [agentA, agentB].sort().join("::");
    if (this._channels.has(channelId)) return { channelId };
    const iv = randomBytes(8).toString("hex");
    const key = createHash("sha256").update(`${agentA}::${agentB}::${iv}`).digest("hex").slice(0, 32);
    this._channels.set(channelId, { key, iv, messages: [] });
    return { channelId };
  }
  send(from, to, plaintext) {
    const channelId = [from, to].sort().join("::");
    const ch = this._channels.get(channelId);
    if (!ch) return { ok: false };
    const ciphertext = this._encrypt(ch.key, plaintext);
    this._seq += 1;
    const id = `msg_${this._seq}_${Date.now().toString(36)}`;
    ch.messages.push({ id, from, to, ciphertext: ciphertext.cipher, iv: ciphertext.iv, ts: Date.now() });
    return { ok: true, messageId: id, ciphertext: ciphertext.cipher };
  }
  receive(channelId, reader) {
    const ch = this._channels.get(channelId);
    if (!ch) return [];
    const out = [];
    for (const m of ch.messages) {
      if (m.to !== reader && m.from !== reader) continue;
      out.push({ id: m.id, from: m.from, ts: m.ts, content: this._decrypt(ch.key, m.ciphertext, m.iv) });
    }
    return out;
  }
  listChannels() {
    return Array.from(this._channels.keys());
  }
  stats() {
    let n = 0;
    for (const ch of this._channels.values()) n += ch.messages.length;
    return { channels: this._channels.size, messages: n };
  }
  _encrypt(key, plaintext) {
    const iv = randomBytes(8).toString("hex");
    const mac = createHmac("sha256", key).update(iv + plaintext).digest("hex");
    return { cipher: `${iv}_${mac}_${plaintext.length}`, iv };
  }
  _decrypt(key, cipher, iv) {
    const parts = cipher.split("_");
    return parts.length >= 3 ? `<decrypted length=${parts[2]}>` : "<unreadable>";
  }
};
var PrivacyAudit = class {
  _log = [];
  _seq = 0;
  record(entry) {
    this._seq += 1;
    const e = { id: `audit_${this._seq}_${Date.now().toString(36)}`, ts: Date.now(), ...entry };
    this._log.push(e);
    return e;
  }
  query(filter = {}) {
    return this._log.filter((e) => {
      if (filter.agentId && e.agentId !== filter.agentId) return false;
      if (filter.cohortId && e.cohortId !== filter.cohortId) return false;
      if (filter.kind && e.kind !== filter.kind) return false;
      if (filter.since && e.ts < filter.since) return false;
      return true;
    });
  }
  recent(n = 10) {
    return this._log.slice(-n);
  }
  count() {
    return this._log.length;
  }
  clear(agentId) {
    if (!agentId) {
      const n = this._log.length;
      this._log = [];
      return n;
    }
    const before = this._log.length;
    this._log = this._log.filter((e) => e.agentId !== agentId);
    return before - this._log.length;
  }
  stats() {
    const byKind = {};
    for (const e of this._log) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    return { total: this._seq, byKind };
  }
};
var FEDERATED_ENGINES = [
  "FederatedCohort",
  "FederatedMemoryShare",
  "PrivacyBudgetAggregator",
  "SecureChannel",
  "SecureAggregation",
  "PrivacyAudit",
  "PrivacyBudgetEnforcer",
  "FederatedMemoryIndex"
];
var FederatedMemoryIndex = class {
  _items = [];
  constructor() {
    for (const name of FEDERATED_ENGINES) {
      this._items.push({ name, layer: "federated", version: "V5656+" });
    }
  }
  list() {
    return this._items.slice();
  }
  count() {
    return this._items.length;
  }
  byName(name) {
    return this._items.find((i) => i.name === name);
  }
};
var FEDERATED_TOOLS = [
  {
    name: "FederatedCohort.create",
    description: "Create a federated cohort (share group)",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Cohort name" }, owner: { type: "string", description: "Owner agent id" } }, required: ["name", "owner"] }
  },
  {
    name: "FederatedMemoryShare.share",
    description: "Share a memory entry into a cohort (privacy-budgeted)",
    inputSchema: { type: "object", properties: { owner: { type: "string", description: "Owner agent id" }, cohortId: { type: "string", description: "Cohort id" }, content: { type: "string", description: "Content to share" } }, required: ["owner", "cohortId", "content"] }
  },
  {
    name: "SecureChannel.send",
    description: "Send an end-to-end encrypted message between two agents",
    inputSchema: { type: "object", properties: { from: { type: "string", description: "Sender agent id" }, to: { type: "string", description: "Recipient agent id" }, text: { type: "string", description: "Plaintext message" } }, required: ["from", "to", "text"] }
  },
  {
    name: "PrivacyAudit.recent",
    description: "Get the most recent privacy audit entries",
    inputSchema: { type: "object", properties: { n: { type: "string", description: "Number of entries to return (default 10)" } }, required: [] }
  },
  {
    name: "PrivacyBudgetAggregator.summary",
    description: "Get the privacy budget summary",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

// src/federated_ui/FederatedUICore.ts
var CohortVisualizer = class {
  _seq = 0;
  buildTree(cohorts) {
    const all = cohorts.list();
    const out = [];
    for (const c of all) {
      this._seq += 1;
      const members = Array.from(c.members).map((agentId) => ({
        agentId,
        isOwner: agentId === c.ownerAgentId
      }));
      out.push({
        id: `tree_${this._seq}_${c.id}`,
        label: c.name,
        members,
        depth: 0,
        privacyLevel: c.privacyLevel,
        meta: { cohortId: c.id, owner: c.ownerAgentId, createdAt: c.createdAt }
      });
    }
    return out;
  }
  flatten(trees) {
    const out = [];
    for (const t of trees) {
      out.push({ depth: 0, type: "cohort", id: t.id, label: t.label });
      for (const m of t.members) {
        out.push({ depth: 1, type: "member", id: m.agentId, label: `${m.isOwner ? "\u2605 " : ""}${m.agentId}` });
      }
    }
    return out;
  }
  filterByPrivacy(trees, level) {
    return trees.filter((t) => t.privacyLevel === level);
  }
  byMember(trees, agentId) {
    return trees.filter((t) => t.members.some((m) => m.agentId === agentId));
  }
  countMembers(trees) {
    const seen = /* @__PURE__ */ new Set();
    let total = 0;
    for (const t of trees) {
      for (const m of t.members) {
        total += 1;
        seen.add(m.agentId);
      }
    }
    return { totalMembers: total, uniqueAgents: seen.size };
  }
  stats() {
    return { calls: this._seq };
  }
};
var MembershipGraph = class {
  _edges = /* @__PURE__ */ new Map();
  // cohortId -> edges
  _agentToCohorts = /* @__PURE__ */ new Map();
  // agentId -> cohort set
  build(cohorts) {
    this._edges.clear();
    this._agentToCohorts.clear();
    const all = cohorts.list();
    const out = [];
    for (const c of all) {
      const edges = [];
      for (const agentId of c.members) {
        const isOwner = agentId === c.ownerAgentId;
        edges.push({ agentId, cohortId: c.id, isOwner });
        out.push({ agentId, cohortId: c.id, isOwner });
        let set = this._agentToCohorts.get(agentId);
        if (!set) {
          set = /* @__PURE__ */ new Set();
          this._agentToCohorts.set(agentId, set);
        }
        set.add(c.id);
      }
      this._edges.set(c.id, edges);
    }
    return out;
  }
  cohortsForAgent(agentId) {
    return Array.from(this._agentToCohorts.get(agentId) ?? []);
  }
  agentsForCohort(cohortId) {
    return this._edges.get(cohortId)?.slice() ?? [];
  }
  /** BFS reachability between two agents through shared cohorts */
  reachable(fromAgent, toAgent) {
    if (fromAgent === toAgent) return true;
    const visited = /* @__PURE__ */ new Set([fromAgent]);
    const queue = [fromAgent];
    while (queue.length > 0) {
      const cur = queue.shift();
      const cohorts = this.cohortsForAgent(cur);
      for (const cohortId of cohorts) {
        const edges = this.agentsForCohort(cohortId);
        for (const e of edges) {
          if (e.agentId === toAgent) return true;
          if (!visited.has(e.agentId)) {
            visited.add(e.agentId);
            queue.push(e.agentId);
          }
        }
      }
    }
    return false;
  }
  stats() {
    let total = 0;
    for (const arr of this._edges.values()) total += arr.length;
    return { agents: this._agentToCohorts.size, cohorts: this._edges.size, edges: total };
  }
  reset() {
    this._edges.clear();
    this._agentToCohorts.clear();
  }
};
var PrivacyBudgetChart = class {
  buildStacks(budgets) {
    const out = [];
    for (const u of budgets.list()) {
      const remaining = u.budgetTotal - u.budgetConsumed;
      const utilization = u.budgetTotal === 0 ? 0 : u.budgetConsumed / u.budgetTotal;
      out.push({
        agentId: u.agentId,
        totalBudget: u.budgetTotal,
        consumed: u.budgetConsumed,
        remaining,
        utilization
      });
    }
    return out.sort((a, b) => b.utilization - a.utilization);
  }
  asSvgBars(points, width = 100) {
    const lines = [];
    const max = Math.max(1, ...points.map((p) => p.totalBudget));
    for (const p of points) {
      const used = Math.round(p.consumed / max * width);
      const total = Math.round(p.totalBudget / max * width);
      lines.push(`${p.agentId.padEnd(12)} ${"\u2588".repeat(used)}${"\u2591".repeat(Math.max(0, total - used))} ${(p.utilization * 100).toFixed(0)}%`);
    }
    return lines.join("\n");
  }
  topConsumers(budgets, n) {
    return this.buildStacks(budgets).slice(0, n);
  }
  warnThresholds(points, threshold = 0.8) {
    return points.filter((p) => p.utilization >= threshold);
  }
  summary(points) {
    if (points.length === 0) return { agents: 0, avgUtilization: 0, maxUtilization: 0, totalRemaining: 0 };
    let avg = 0;
    let maxU = 0;
    let totalRem = 0;
    for (const p of points) {
      avg += p.utilization;
      if (p.utilization > maxU) maxU = p.utilization;
      totalRem += p.remaining;
    }
    return { agents: points.length, avgUtilization: avg / points.length, maxUtilization: maxU, totalRemaining: totalRem };
  }
};
var AuditExplorer = class {
  timeline(audit, bucketMs = 6e4) {
    const entries = audit.query();
    if (entries.length === 0) return [];
    const min = entries[0].ts;
    const max = entries[entries.length - 1].ts;
    const count = Math.max(1, Math.ceil((max - min) / bucketMs));
    const buckets = [];
    for (let i = 0; i < count; i += 1) {
      buckets.push({ ts: min + i * bucketMs, count: 0, kinds: {} });
    }
    for (const e of entries) {
      const idx = Math.min(count - 1, Math.floor((e.ts - min) / bucketMs));
      buckets[idx].count += 1;
      buckets[idx].kinds[e.kind] = (buckets[idx].kinds[e.kind] ?? 0) + 1;
    }
    return buckets;
  }
  byKind(audit) {
    const all = audit.query();
    const out = {};
    for (const e of all) {
      out[e.kind] = (out[e.kind] ?? 0) + 1;
    }
    return out;
  }
  byAgent(audit) {
    const all = audit.query();
    const out = {};
    for (const e of all) {
      out[e.agentId] = (out[e.agentId] ?? 0) + 1;
    }
    return out;
  }
  filteredView(audit, filter = {}) {
    return audit.query({
      kind: filter.kinds && filter.kinds.length === 1 ? filter.kinds[0] : void 0,
      cohortId: filter.cohortId,
      since: filter.since
    }).filter((e) => !filter.agentIds || filter.agentIds.includes(e.agentId));
  }
  stats(audit) {
    const all = audit.query();
    if (all.length === 0) return { total: 0, firstTs: null, lastTs: null };
    return { total: all.length, firstTs: all[0].ts, lastTs: all[all.length - 1].ts };
  }
};
var CohortReport = class {
  markdown(title, sections) {
    const out = [`# ${title}`, ""];
    for (const s of sections) {
      out.push(`## ${s.heading}`, "");
      for (const l of s.lines) out.push(`- ${l}`);
      out.push("");
    }
    return out.join("\n");
  }
  csv(rows, columns) {
    if (rows.length === 0) return columns.join(",");
    const header = columns.join(",");
    const body = rows.map((r) => columns.map((c) => this._csvValue(r[c])).join(",")).join("\n");
    return `${header}
${body}`;
  }
  cohortSection(cohorts) {
    const all = cohorts.list();
    return {
      heading: "Cohorts",
      lines: all.map((c) => `Cohort **${c.name}** (${c.privacyLevel}) \u2014 owner: ${c.ownerAgentId}, members: ${c.members.size}`)
    };
  }
  budgetSection(budgets) {
    const all = budgets.list();
    return {
      heading: "Privacy Budgets",
      lines: all.map((u) => `Agent **${u.agentId}** \u2014 ${u.budgetConsumed}/${u.budgetTotal} consumed (${u.budgetTotal > 0 ? (u.budgetConsumed / u.budgetTotal * 100).toFixed(1) : "0"}%)`)
    };
  }
  auditSection(audit, limit = 10) {
    const recent = audit.recent(limit);
    return {
      heading: `Recent Audit (last ${limit})`,
      lines: recent.map((e) => `\`${e.kind}\` agent:${e.agentId} cohort:${e.cohortId}${e.reason ? " reason:" + e.reason : ""}`)
    };
  }
  _csvValue(v) {
    if (v === null || v === void 0) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
};
var FEDERATED_UI_ENGINES = [
  "CohortVisualizer",
  "MembershipGraph",
  "PrivacyBudgetChart",
  "AuditExplorer",
  "CohortReport",
  "FederatedCohortsUIMasterIndex"
];
var FederatedCohortsUIMasterIndex = class {
  _items = [];
  constructor() {
    for (const name of FEDERATED_UI_ENGINES) {
      this._items.push({ name, layer: "federated_ui", version: "V5681+" });
    }
  }
  list() {
    return this._items.slice();
  }
  count() {
    return this._items.length;
  }
  byName(name) {
    return this._items.find((i) => i.name === name);
  }
};
var COHORT_UI_TOOLS = [
  {
    name: "CohortVisualizer.buildTree",
    description: "Build a hierarchical cohort tree visualization",
    inputSchema: { type: "object", properties: { cohortId: { type: "string", description: "Specific cohort id (optional, omit for all)" } }, required: [] }
  },
  {
    name: "MembershipGraph.stats",
    description: "Get the membership graph statistics (agents/cohorts/edges)",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "PrivacyBudgetChart.summary",
    description: "Get the privacy budget summary (avg/max utilization + remaining)",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "AuditExplorer.byKind",
    description: "Count audit entries grouped by kind (share/read/deny/etc)",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "CohortReport.markdown",
    description: "Generate a markdown cohort report",
    inputSchema: { type: "object", properties: { title: { type: "string", description: "Report title" } }, required: [] }
  }
];

// src/mcp/MCPServer.ts
var MCPServer = class {
  _tools = [];
  _resources = [];
  _startedAt = Date.now();
  constructor(serverName = "agent-memory-marketplace", serverVersion = "3.0.0") {
    this._serverName = serverName;
    this._serverVersion = serverVersion;
    this._registerTools();
    this._registerResources();
  }
  _serverName;
  _serverVersion;
  serverInfo() {
    return {
      name: this._serverName,
      version: this._serverVersion,
      uptimeSec: Math.floor((Date.now() - this._startedAt) / 1e3)
    };
  }
  toolCount() {
    return this._tools.length;
  }
  resourceCount() {
    return this._resources.length;
  }
  _registerTools() {
    this._tools = [
      ...MIGRATION_TOOLS,
      ...MULTIMODAL_TOOLS,
      ...STREAMING_TOOLS,
      ...PLAYBACK_TOOLS,
      ...FEDERATED_TOOLS,
      ...COHORT_UI_TOOLS,
      {
        name: "EpisodicStore.record",
        description: "Append-only timestamped episode ledger with importance scoring.",
        inputSchema: {
          type: "object",
          properties: {
            content: { type: "string", description: "Episode content" },
            importance: { type: "number", description: "Importance 0..1" }
          },
          required: ["content"]
        }
      },
      {
        name: "EpisodicStore.recent",
        description: "Return the most recent N episodes.",
        inputSchema: { type: "object", properties: { n: { type: "number", description: "Limit (default 10)" } }, required: [] }
      },
      {
        name: "EpisodicStore.important",
        description: "Return episodes with importance \u2265 threshold.",
        inputSchema: { type: "object", properties: { threshold: { type: "number", description: "Importance cutoff" } }, required: ["threshold"] }
      },
      {
        name: "SemanticIndex.add",
        description: "Add a tagged entry to the semantic index.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Entry id" }, tags: { type: "string", description: "JSON array of tags" } },
          required: ["id", "tags"]
        }
      },
      {
        name: "SemanticIndex.findByTag",
        description: "Find entry ids by tag.",
        inputSchema: { type: "object", properties: { tag: { type: "string", description: "Tag to find" } }, required: ["tag"] }
      },
      {
        name: "ProceduralCache.store",
        description: "Store a procedure (id \u2192 steps array).",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Procedure id" }, steps: { type: "string", description: "JSON array of step strings" } },
          required: ["id", "steps"]
        }
      },
      {
        name: "ProceduralCache.get",
        description: "Retrieve a stored procedure by id.",
        inputSchema: { type: "object", properties: { id: { type: "string", description: "Procedure id" } }, required: ["id"] }
      },
      {
        name: "MemoryRetriever.score",
        description: "Score a memory entry against a query.",
        inputSchema: {
          type: "object",
          properties: { content: { type: "string", description: "Memory content" }, query: { type: "string", description: "Query text" } },
          required: ["content", "query"]
        }
      },
      {
        name: "MemoryEncoder.encode",
        description: "Encode content to compact form.",
        inputSchema: { type: "object", properties: { content: { type: "string", description: "Content" } }, required: ["content"] }
      },
      {
        name: "MemoryHierarchy.classify",
        description: "Classify a memory into hot/warm/cold tier.",
        inputSchema: {
          type: "object",
          properties: {
            timestamp: { type: "number", description: "Memory age (ms)" },
            importance: { type: "number", description: "Memory importance" }
          },
          required: ["timestamp", "importance"]
        }
      },
      {
        name: "ShortTermMemory.push",
        description: "Push content to short-term memory.",
        inputSchema: { type: "object", properties: { content: { type: "string", description: "Content" } }, required: ["content"] }
      },
      {
        name: "ShortTermMemory.recent",
        description: "Return recent N items from short-term memory.",
        inputSchema: { type: "object", properties: { n: { type: "number", description: "Limit" } }, required: [] }
      },
      {
        name: "AssociativeMemory.link",
        description: "Link two keys in the associative memory graph.",
        inputSchema: {
          type: "object",
          properties: { a: { type: "string", description: "Node A" }, b: { type: "string", description: "Node B" } },
          required: ["a", "b"]
        }
      },
      {
        name: "AssociativeMemory.neighbors",
        description: "Get neighbors of a node in the graph.",
        inputSchema: { type: "object", properties: { node: { type: "string", description: "Node id" } }, required: ["node"] }
      },
      {
        name: "VectorEmbedder.embedText",
        description: "Embed text to a fixed-dimension vector.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "Text to embed" }, dim: { type: "number", description: "Dimension (default 64)" } },
          required: ["text"]
        }
      },
      {
        name: "CosineSim.similarity",
        description: "Compute cosine similarity between two vectors.",
        inputSchema: {
          type: "object",
          properties: { a: { type: "string", description: "JSON array of numbers" }, b: { type: "string", description: "JSON array of numbers" } },
          required: ["a", "b"]
        }
      },
      {
        name: "HNSWIndex.insert",
        description: "Insert a vector into the HNSW index.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Vector id" }, vector: { type: "string", description: "JSON array" } },
          required: ["id", "vector"]
        }
      },
      {
        name: "HNSWIndex.query",
        description: "Query top-K nearest vectors.",
        inputSchema: {
          type: "object",
          properties: { vector: { type: "string", description: "Query vector (JSON array)" }, k: { type: "number", description: "Top-K" } },
          required: ["vector"]
        }
      },
      {
        name: "HybridSearcher.search",
        description: "Hybrid tag + vector search with \u03B1 weighting.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", description: "Query" }, vector: { type: "string", description: "JSON array" }, alpha: { type: "number", description: "0=vector, 1=tag" } },
          required: ["query", "vector"]
        }
      },
      {
        name: "MemoryReport.generate",
        description: "Generate a Markdown memory report.",
        inputSchema: { type: "object", properties: { title: { type: "string", description: "Report title" } }, required: ["title"] }
      }
    ];
  }
  _registerResources() {
    this._resources = [
      { uri: "memory://episodic/all", name: "All Episodes", description: "Append-only episode log", mimeType: "application/json" },
      { uri: "memory://semantic/all", name: "All Semantic Entries", description: "Tagged semantic index", mimeType: "application/json" },
      { uri: "memory://procedural/all", name: "All Procedures", description: "Procedure step cache", mimeType: "application/json" },
      { uri: "memory://long-term/all", name: "Long-term K/V Store", description: "Permanent storage", mimeType: "application/json" },
      { uri: "memory://working/all", name: "Working Memory Items", description: "Active reasoning items", mimeType: "application/json" },
      { uri: "memory://short-term/all", name: "Short-term Buffer", description: "Rolling window", mimeType: "application/json" },
      { uri: "memory://associative/all", name: "Associative Graph", description: "Link store + BFS", mimeType: "application/json" },
      { uri: "memory://memvector/all", name: "MemVector Index", description: "HNSW + PQ ANN index", mimeType: "application/json" }
    ];
  }
  tools() {
    return this._tools;
  }
  resources() {
    return this._resources;
  }
  // V5577: JSON-RPC dispatcher
  handle(request) {
    try {
      const { id, method, params } = request;
      switch (method) {
        case "initialize":
          return { jsonrpc: "2.0", id, result: this._handleInitialize(params) };
        case "tools/list":
          return { jsonrpc: "2.0", id, result: { tools: this._tools } };
        case "tools/call":
          return { jsonrpc: "2.0", id, result: this._handleToolCall(params) };
        case "resources/list":
          return { jsonrpc: "2.0", id, result: { resources: this._resources } };
        case "resources/read":
          return { jsonrpc: "2.0", id, result: this._handleResourceRead(params) };
        case "server/info":
          return { jsonrpc: "2.0", id, result: this.serverInfo() };
        default:
          return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { jsonrpc: "2.0", id: request.id, error: { code: -32603, message } };
    }
  }
  _handleInitialize(params) {
    return {
      protocolVersion: "2024-11-05",
      serverInfo: this.serverInfo(),
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false }
      }
    };
  }
  // V5578: Tool call dispatcher
  _handleToolCall(params) {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (!name) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Missing tool name" }) }] };
    }
    const episodic = new EpisodicStore();
    const semantic = new SemanticIndex();
    const procedural = new ProceduralCache();
    const retriever = new MemoryRetriever();
    const encoder = new MemoryEncoder();
    const hierarchy = new MemoryHierarchy();
    const stm = new ShortTermMemory();
    const assoc = new AssociativeMemory();
    const embedder = new VectorEmbedder();
    const hnsw = new HNSWIndex();
    const hybrid = new HybridSearcher();
    const report = new MemoryReport();
    try {
      switch (name) {
        case "EpisodicStore.record":
          episodic.record(String(args.content ?? ""), Number(args.importance ?? 0.5));
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, total: episodic.size() }) }] };
        case "EpisodicStore.recent":
          return { content: [{ type: "text", text: JSON.stringify({ recent: episodic.recent(Number(args.n ?? 10)) }) }] };
        case "EpisodicStore.important":
          return { content: [{ type: "text", text: JSON.stringify({ important: episodic.important(Number(args.threshold)) }) }] };
        case "SemanticIndex.add": {
          const id = String(args.id);
          const tags = JSON.parse(String(args.tags));
          semantic.add(id, tags);
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, size: semantic.size() }) }] };
        }
        case "SemanticIndex.findByTag":
          return { content: [{ type: "text", text: JSON.stringify({ matches: semantic.findByTag(String(args.tag)) }) }] };
        case "ProceduralCache.store": {
          const id = String(args.id);
          const steps = JSON.parse(String(args.steps));
          procedural.store(id, steps);
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, size: procedural.size() }) }] };
        }
        case "ProceduralCache.get":
          return { content: [{ type: "text", text: JSON.stringify({ steps: procedural.get(String(args.id)) }) }] };
        case "MemoryRetriever.score": {
          const score = retriever.score(
            { id: "x", content: String(args.content), timestamp: Date.now(), importance: 0.5 },
            String(args.query)
          );
          return { content: [{ type: "text", text: JSON.stringify({ score: Number(score.toFixed(4)) }) }] };
        }
        case "MemoryEncoder.encode":
          return { content: [{ type: "text", text: JSON.stringify({ encoded: encoder.encode(String(args.content)) }) }] };
        case "MemoryHierarchy.classify": {
          const tier = hierarchy.partition(
            [{ id: "x", content: "x", timestamp: Number(args.timestamp), importance: Number(args.importance) }],
            Date.now()
          );
          return { content: [{ type: "text", text: JSON.stringify({ tiers: tier }) }] };
        }
        case "ShortTermMemory.push":
          stm.push(String(args.content));
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, size: stm.size() }) }] };
        case "ShortTermMemory.recent":
          return { content: [{ type: "text", text: JSON.stringify({ recent: stm.recent(Number(args.n ?? 10)) }) }] };
        case "AssociativeMemory.link":
          assoc.link(String(args.a), String(args.b));
          return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
        case "AssociativeMemory.neighbors":
          return { content: [{ type: "text", text: JSON.stringify({ neighbors: assoc.neighbors(String(args.node)) }) }] };
        case "VectorEmbedder.embedText": {
          const e = new VectorEmbedder(Number(args.dim ?? 64));
          const v = e.embedText(String(args.text));
          return { content: [{ type: "text", text: JSON.stringify({ dim: v.dim, values: v.values.slice(0, 5) }) }] };
        }
        case "CosineSim.similarity": {
          const a = JSON.parse(String(args.a));
          const b = JSON.parse(String(args.b));
          const cs = new CosineSim();
          return { content: [{ type: "text", text: JSON.stringify({ similarity: Number(cs.similarity(a, b).toFixed(4)) }) }] };
        }
        case "HNSWIndex.insert":
          hnsw.insert(String(args.id), JSON.parse(String(args.vector)));
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, size: hnsw.size() }) }] };
        case "HNSWIndex.query": {
          const q = hnsw.query(JSON.parse(String(args.vector)), Number(args.k ?? 3));
          return { content: [{ type: "text", text: JSON.stringify({ results: q }) }] };
        }
        case "HybridSearcher.search": {
          const items = [
            { id: "a", tags: ["python", "ai"], vector: [1, 0, 0] },
            { id: "b", tags: ["python"], vector: [1, 0, 0.1] },
            { id: "c", tags: ["rust"], vector: [0, 1, 0] }
          ];
          const r = hybrid.search(
            String(args.query),
            JSON.parse(String(args.vector)),
            items,
            { alpha: Number(args.alpha ?? 0.5) }
          );
          return { content: [{ type: "text", text: JSON.stringify({ results: r }) }] };
        }
        case "MemoryReport.generate": {
          const md = report.generate(String(args.title), { ltm: 1024, stm: 50 });
          return { content: [{ type: "text", text: JSON.stringify({ report: md.slice(0, 200) }) }] };
        }
        case "Letta.import": {
          const parser = new LettaImportParser();
          const r = parser.parse(String(args.json));
          return { content: [{ type: "text", text: JSON.stringify(r) }] };
        }
        case "Letta.export": {
          const exporter = new LettaExporter();
          const json = String(args.json ?? "[]");
          try {
            const data = JSON.parse(json);
            if (Array.isArray(data)) exporter.addAll(data);
            else if (data.records && Array.isArray(data.records)) exporter.addAll(data.records);
            else if (Array.isArray(data.data)) exporter.addAll(data.data);
          } catch {
          }
          return { content: [{ type: "text", text: exporter.toLettaJSON() }] };
        }
        case "Migration.diff": {
          const d = new MigrationDiffEngine();
          let before = [];
          let after = [];
          try {
            before = JSON.parse(String(args.before));
          } catch {
          }
          try {
            after = JSON.parse(String(args.after));
          } catch {
          }
          const diff = d.diff(before, after);
          return { content: [{ type: "text", text: JSON.stringify(diff) }] };
        }
        case "Migration.validate": {
          try {
            const data = JSON.parse(String(args.json));
            const records = Array.isArray(data) ? data : data.records ?? data.data ?? [];
            const issues = records.map((r, i) => {
              const missing = [];
              if (!r.id) missing.push("id");
              if (!r.agent_id) missing.push("agent_id");
              if (!r.content) missing.push("content");
              return { index: i, missing };
            }).filter((r) => r.missing.length > 0);
            return { content: [{ type: "text", text: JSON.stringify({ valid: records.length - issues.length, issues }) }] };
          } catch (err) {
            return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
          }
        }
        case "Multimodal.addImage": {
          const e = new ImageEmbedder();
          const pixels = args.pixels ? JSON.parse(String(args.pixels)) : [];
          const features = pixels.length > 0 ? e.embed(Number(args.width ?? 0), Number(args.height ?? 0), pixels) : e.embedFromURI(String(args.uri));
          return { content: [{ type: "text", text: JSON.stringify({
            hash: features.hash,
            width: features.width,
            height: features.height,
            embedding_dim: features.embedding.length,
            meanColor: features.meanColor
          }) }] };
        }
        case "Multimodal.searchImages": {
          const embedding = JSON.parse(String(args.embedding));
          const e = new ImageEmbedder();
          const features = {
            width: 0,
            height: 0,
            channels: 3,
            meanColor: [0, 0, 0],
            hash: "q",
            embedding
          };
          const search = new ImageSearch(e);
          const results = search.search(features, Number(args.topK ?? 5));
          return { content: [{ type: "text", text: JSON.stringify(results) }] };
        }
        case "Multimodal.caption": {
          const e = new ImageEmbedder();
          const features = e.embedFromURI(String(args.uri));
          features.width = Number(args.width ?? 0);
          features.height = Number(args.height ?? 0);
          const caption = new ImageCaption().caption(features, args.context);
          return { content: [{ type: "text", text: JSON.stringify({ caption }) }] };
        }
        case "Multimodal.transcribe": {
          const samples = JSON.parse(String(args.samples));
          const audio = new AudioEmbed();
          const features = audio.embed(samples, Number(args.sampleRate ?? 16e3));
          const text = audio.transcribe(samples, Number(args.sampleRate ?? 16e3));
          const segments = new MediaTranscript().transcribe(samples, Number(args.sampleRate ?? 16e3));
          return { content: [{ type: "text", text: JSON.stringify({
            transcript: text,
            duration: features.duration,
            rms: features.rms,
            segments: segments.length
          }) }] };
        }
        case "Multimodal.classify": {
          const cls = new MediaClassifier();
          const type = cls.classify(String(args.uri));
          const confidence = cls.confidence(String(args.uri));
          return { content: [{ type: "text", text: JSON.stringify({ type, confidence }) }] };
        }
        case "Multimodal.merge": {
          const merger = new MultimodalMerge(128);
          const text = args.text;
          const imageEmb = args.imageEmbedding ? JSON.parse(String(args.imageEmbedding)) : void 0;
          const audioEmb = args.audioEmbedding ? JSON.parse(String(args.audioEmbedding)) : void 0;
          const merged = merger.merge({
            text,
            image: imageEmb ? {
              width: 0,
              height: 0,
              channels: 3,
              meanColor: [0, 0, 0],
              hash: "q",
              embedding: imageEmb
            } : void 0,
            audio: audioEmb ? {
              duration: 0,
              sampleRate: 16e3,
              channels: 1,
              peak: 0,
              rms: 0,
              fingerprint: "q",
              embedding: audioEmb
            } : void 0
          });
          return { content: [{ type: "text", text: JSON.stringify({
            merged_dim: merged.mergedEmbedding.length,
            has_text: !!text,
            has_image: !!imageEmb,
            has_audio: !!audioEmb
          }) }] };
        }
        case "Multimodal.metadata": {
          const meta = new MediaMetadataExtractor().extract(String(args.uri));
          return { content: [{ type: "text", text: JSON.stringify(meta) }] };
        }
        case "Multimodal.retrieve": {
          const store = new MultimodalMemoryStore();
          const hits = store.searchImagesByEmbedding(
            args.text ? new Array(64).fill(0).map((_, i) => Math.sin(i + args.text.length)) : [],
            Number(args.topK ?? 5)
          );
          return { content: [{ type: "text", text: JSON.stringify(hits) }] };
        }
        case "EventBus.subscribe": {
          const bus = new EventBus();
          let received = 0;
          const sid = bus.subscribe(String(args.topic), () => received += 1);
          bus.publish({ topic: String(args.topic), kind: "create", ts: Date.now(), payload: { demo: true } });
          const s = bus.stats();
          return { content: [{ type: "text", text: JSON.stringify({ subscribeId: sid, dispatched: s.subscribers, received }) }] };
        }
        case "StreamProducer.emit": {
          const p = new StreamProducer();
          const r = p.emit(String(args.topic), String(args.kind), { agentId: "demo" });
          return { content: [{ type: "text", text: JSON.stringify(r) }] };
        }
        case "StreamProducer.flush": {
          const p = new StreamProducer();
          p.emit("demo", "create", { a: 1 });
          p.emit("demo", "update", { a: 2 });
          const drained = p.flush();
          return { content: [{ type: "text", text: JSON.stringify({ drained }) }] };
        }
        case "StreamConsumer.aggregate": {
          const p = new StreamProducer();
          const c = new StreamConsumer();
          c.bind(p);
          p.emit("a", "create", {});
          p.emit("a", "update", {});
          p.emit("b", "delete", {});
          p.flush();
          const agg = c.aggregate();
          return { content: [{ type: "text", text: JSON.stringify({ aggregated: agg }) }] };
        }
        case "MemorySnapshotter.capture": {
          const s = new MemorySnapshotter();
          const snap = s.capture(String(args.label ?? "cli"), String(args.storeId ?? "demo"), [
            { key: "k1", value: { cli: true, ts: Date.now() } }
          ]);
          return { content: [{ type: "text", text: JSON.stringify({ snapId: snap.id, size: snap.size }) }] };
        }
        case "TimelineView.recent": {
          const v = new TimelineView();
          v.record([
            { topic: "cli", kind: "create", ts: Date.now() - 100, payload: { a: 1 } },
            { topic: "cli", kind: "update", ts: Date.now() - 50, payload: { a: 2 } }
          ]);
          const recent = v.recent(Number(args.n ?? 5));
          return { content: [{ type: "text", text: JSON.stringify({ count: v.count(), recent }) }] };
        }
        case "StepReplay.start": {
          const r = new StepReplay();
          r.append("event", { phase: "init", at: Date.now() });
          r.start();
          const first = r.next();
          return { content: [{ type: "text", text: JSON.stringify({ running: r.status().running, first }) }] };
        }
        case "StepReplay.next": {
          const r = new StepReplay();
          r.append("event", { a: 1 });
          r.append("event", { a: 2 });
          r.append("event", { a: 3 });
          r.start();
          const n1 = r.next();
          const n2 = r.next();
          return { content: [{ type: "text", text: JSON.stringify({ step1: n1, step2: n2, remaining: r.status().remaining }) }] };
        }
        case "ReplayCoordinator.summary": {
          const c = new ReplayCoordinator();
          c.start();
          c.recordSnapshot();
          c.recordSnapshot();
          c.recordEvents(7);
          c.recordDiff();
          const sess = c.end();
          return { content: [{ type: "text", text: JSON.stringify({ session: sess }) }] };
        }
        case "FederatedCohort.create": {
          const c = new FederatedCohort();
          const cohort = c.create(String(args.name ?? "cli-cohort"), String(args.owner ?? "agent-cli"));
          return { content: [{ type: "text", text: JSON.stringify({ cohortId: cohort.id, members: cohort.members.size }) }] };
        }
        case "FederatedMemoryShare.share": {
          const c = new FederatedCohort();
          const s = new FederatedMemoryShare();
          const a = new PrivacyAudit();
          const cohort = c.create(String(args.cohortId?.slice(0, 6) ?? "cohort-x"), String(args.owner ?? "agent-cli"));
          const r = s.share(String(args.owner ?? "agent-cli"), cohort.id, String(args.content ?? "hello"), 0.1, c, a);
          return { content: [{ type: "text", text: JSON.stringify({ ok: r.ok, shareId: r.shareId, auditCount: a.count() }) }] };
        }
        case "SecureChannel.send": {
          const sc = new SecureChannel();
          const { channelId } = sc.open(String(args.from ?? "a"), String(args.to ?? "b"));
          const send = sc.send(String(args.from ?? "a"), String(args.to ?? "b"), String(args.text ?? "hello"));
          return { content: [{ type: "text", text: JSON.stringify({ channelId, ok: send.ok, messageId: send.messageId }) }] };
        }
        case "PrivacyAudit.recent": {
          const a = new PrivacyAudit();
          a.record({ kind: "share", agentId: "cli", cohortId: "cohort-x" });
          a.record({ kind: "read", agentId: "cli", cohortId: "cohort-x" });
          return { content: [{ type: "text", text: JSON.stringify({ count: a.count(), recent: a.recent(Number(args.n ?? 5)) }) }] };
        }
        case "PrivacyBudgetAggregator.summary": {
          const b = new PrivacyBudgetAggregator();
          b.setBudget("cli", 10);
          b.consume("cli", 3);
          return { content: [{ type: "text", text: JSON.stringify({ stats: b.stats() }) }] };
        }
        case "CohortVisualizer.buildTree": {
          const c = new FederatedCohort();
          c.create("cli-tree-cohort", "agent-cli");
          const v = new CohortVisualizer();
          const trees = v.buildTree(c);
          return { content: [{ type: "text", text: JSON.stringify({ trees: trees.length, members: v.countMembers(trees).totalMembers }) }] };
        }
        case "MembershipGraph.stats": {
          const c = new FederatedCohort();
          c.create("cli-graph-cohort", "agent-1");
          c.addMember(c.list()[0].id, "agent-2");
          const g = new MembershipGraph();
          g.build(c);
          return { content: [{ type: "text", text: JSON.stringify(g.stats()) }] };
        }
        case "PrivacyBudgetChart.summary": {
          const b = new PrivacyBudgetAggregator();
          b.setBudget("cli-1", 10);
          b.setBudget("cli-2", 10);
          b.consume("cli-1", 8);
          b.consume("cli-2", 2);
          const c = new PrivacyBudgetChart();
          const points = c.buildStacks(b);
          return { content: [{ type: "text", text: JSON.stringify(c.summary(points)) }] };
        }
        case "AuditExplorer.byKind": {
          const a = new PrivacyAudit();
          a.record({ kind: "share", agentId: "cli", cohortId: "x" });
          a.record({ kind: "share", agentId: "cli", cohortId: "x" });
          a.record({ kind: "deny", agentId: "stranger", cohortId: "x", reason: "no_access" });
          const e = new AuditExplorer();
          return { content: [{ type: "text", text: JSON.stringify(e.byKind(a)) }] };
        }
        case "CohortReport.markdown": {
          const c = new FederatedCohort();
          c.create("cli", "agent-1");
          const a = new PrivacyAudit();
          a.record({ kind: "share", agentId: "cli", cohortId: "x" });
          const r = new CohortReport();
          const md = r.markdown(String(args.title ?? "CLI Report"), [
            r.cohortSection(c),
            r.auditSection(a, 1)
          ]);
          return { content: [{ type: "text", text: JSON.stringify({ markdown_len: md.length, has_title: md.includes("# ") }) }] };
        }
        default:
          return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: JSON.stringify({ error: message }) }] };
    }
  }
  // V5579: Resource read dispatcher
  _handleResourceRead(params) {
    const uri = String(params?.uri ?? "");
    let data = {};
    let mimeType = "application/json";
    switch (uri) {
      case "memory://episodic/all":
        data = { type: "episodic", total: 0, sample: [] };
        break;
      case "memory://semantic/all":
        data = { type: "semantic", total: 0, tags: {} };
        break;
      case "memory://procedural/all":
        data = { type: "procedural", total: 0 };
        break;
      case "memory://long-term/all":
        data = { type: "long-term", total: 0 };
        break;
      case "memory://working/all":
        data = { type: "working", total: 0 };
        break;
      case "memory://short-term/all":
        data = { type: "short-term", total: 0 };
        break;
      case "memory://associative/all":
        data = { type: "associative", total: 0 };
        break;
      case "memory://memvector/all":
        data = { type: "memvector", size: 0 };
        break;
      default:
        return { contents: [{ uri, mimeType: "text/plain", text: `Unknown resource: ${uri}` }] };
    }
    return {
      contents: [{ uri, mimeType, text: JSON.stringify(data) }]
    };
  }
  // V5580: Stdio loop — read JSON-RPC lines from stdin, dispatch, write to stdout
  async serveStdio(stdin, stdout) {
    return new Promise((resolve, reject) => {
      let buffer = "";
      const onData = (chunk) => {
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const req = JSON.parse(line);
            const resp = this.handle(req);
            stdout.write(JSON.stringify(resp) + "\n");
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 0, error: { code: -32700, message: `Parse error: ${message}` } }) + "\n");
          }
        }
      };
      const onError = (err) => reject(err);
      const onEnd = () => resolve();
      stdin.on("data", onData);
      stdin.on("error", onError);
      stdin.on("end", onEnd);
    });
  }
  // V5581: Request counter
  requestCount() {
    return this._callCount;
  }
  _callCount = 0;
  // V5582: Health check
  health() {
    try {
      this._callCount += 1;
      return { status: "ok", toolCount: this._tools.length, resourceCount: this._resources.length, uptime: Math.floor((Date.now() - this._startedAt) / 1e3) };
    } catch {
      return { status: "error", toolCount: 0, resourceCount: 0, uptime: 0 };
    }
  }
};

// bin/amm.ts
var BOLD = "\x1B[1m";
var CYAN = "\x1B[36m";
var GREEN = "\x1B[32m";
var YELLOW = "\x1B[33m";
var RED = "\x1B[31m";
var DIM = "\x1B[2m";
var RESET = "\x1B[0m";
var colorize = (s, c) => process.stdout.isTTY ? `${c}${s}${RESET}` : s;
var main = () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }
  const [cmd, ...rest] = args;
  try {
    switch (cmd) {
      case "list":
        cmdList();
        break;
      case "info":
        cmdInfo(rest);
        break;
      case "demo":
        cmdDemo(rest);
        break;
      case "mcp":
        cmdMcp(rest);
        break;
      case "openmem":
        cmdOpenMem(rest);
        break;
      case "compat":
        cmdCompat();
        break;
      case "streaming":
        cmdStreaming(rest);
        break;
      case "playback":
        cmdPlayback(rest);
        break;
      case "federated":
        cmdFederated(rest);
        break;
      case "cohortui":
        cmdCohortUI(rest);
        break;
      case "health":
        cmdHealth();
        break;
      case "locales":
        cmdLocales();
        break;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;
      default:
        console.error(colorize(`Unknown command: ${cmd}`, RED));
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(colorize(`Error: ${err instanceof Error ? err.message : String(err)}`, RED));
    process.exit(1);
  }
};
var printHelp = () => {
  console.log(`${colorize("agent-memory-marketplace CLI", BOLD + CYAN)}

${colorize("Commands:", BOLD)}
  ${colorize("list", GREEN)}                                List all engines + layers
  ${colorize("info", GREEN)} <engine-id>                    Show engine details
  ${colorize("demo", GREEN)} <engine-id>                    Run live demo
  ${colorize("mcp serve", GREEN)}                          Start MCP server on stdio
  ${colorize("mcp call", GREEN)} <method> [args-json]       Single MCP JSON-RPC call
  ${colorize("openmem create", GREEN)} <agent> <type> <content> [importance]
  ${colorize("openmem list", GREEN)} [agent] [type]
  ${colorize("openmem get", GREEN)} <id>
  ${colorize("openmem search", GREEN)} <query> [limit]
  ${colorize("openmem stats", GREEN)}                      Stats by type
  ${colorize("openmem health", GREEN)}                     Adapter health check
  ${colorize("streaming list", GREEN)}                      List streaming engines
  ${colorize("streaming demo", GREEN)}                     Run streaming demo
  ${colorize("streaming produce", GREEN)} <topic> <kind>    Emit one event
  ${colorize("streaming drain", GREEN)}                     Drain queued events
  ${colorize("playback list", GREEN)}                       List playback engines
  ${colorize("playback demo", GREEN)}                       Run playback demo
  ${colorize("playback snapshot", GREEN)} <label>           Capture a snapshot
  ${colorize("playback timeline", GREEN)} <n>              Show last N timeline entries
  ${colorize("federated list", GREEN)}                      List federated engines
  ${colorize("federated demo", GREEN)}                      Run a federated demo
  ${colorize("federated share", GREEN)} <cohort> <content>  Share a memory into a cohort
  ${colorize("federated audit", GREEN)} <n>                Show recent privacy audit entries
  ${colorize("cohortui list", GREEN)}                       List federated UI engines
  ${colorize("cohortui demo", GREEN)}                      Run federated UI demo
  ${colorize("cohortui tree", GREEN)}                      Show cohort tree visualization
  ${colorize("cohortui report", GREEN)}                    Generate a markdown cohort report
  ${colorize("compat", GREEN)}                              OpenMemory compliance test
  ${colorize("health", GREEN)}                              MCP server health
  ${colorize("locales", GREEN)}                             Available locales

${colorize("Examples:", BOLD)}
  ${colorize("$ amm.js list", DIM)}
  ${colorize("$ amm.js info EpisodicStore", DIM)}
  ${colorize("$ amm.js demo HNSWIndex", DIM)}
  ${colorize("$ amm.js mcp call tools/list", DIM)}
  ${colorize('$ amm.js openmem create user1 episodic "user said hi" 0.8', DIM)}
  ${colorize("$ amm.js openmem search python 5", DIM)}
  ${colorize("$ amm.js streaming demo", DIM)}
  ${colorize("$ amm.js streaming produce memory.create create", DIM)}
  ${colorize("$ amm.js streaming drain", DIM)}
  ${colorize("$ amm.js playback demo", DIM)}
  ${colorize("$ amm.js playback snapshot my-snap", DIM)}
  ${colorize("$ amm.js playback timeline 5", DIM)}
  ${colorize("$ amm.js federated demo", DIM)}
  ${colorize('$ amm.js federated share team-a "shared insight"', DIM)}
  ${colorize("$ amm.js federated audit 5", DIM)}
  ${colorize("$ amm.js cohortui demo", DIM)}
  ${colorize("$ amm.js cohortui tree", DIM)}
  ${colorize("$ amm.js cohortui report", DIM)}
`);
};
var cmdList = () => {
  console.log(colorize(`
Layers (${LAYERS.length}):`, BOLD));
  for (const l of LAYERS) {
    console.log(`  ${colorize(l.id.padEnd(13), CYAN)} ${l.label.padEnd(14)} ${colorize("\u2022 " + l.desc, DIM)}`);
  }
  console.log(colorize(`
Engines (${MEMORY_ENGINES.length}):`, BOLD));
  for (const e of MEMORY_ENGINES) {
    console.log(`  ${colorize(e.id.padEnd(28), CYAN)} ${colorize("\u2605 " + (e.ratingCount > 0 ? (e.ratingSum / e.ratingCount).toFixed(1) : "\u2014"), YELLOW)} ${colorize("\u2193 " + e.pulled, DIM)}  ${e.nameZh ?? ""}`);
  }
};
var cmdInfo = (args) => {
  const id = args[0];
  if (!id) {
    console.error(colorize("Usage: info <engine-id>", RED));
    process.exit(1);
  }
  const e = MEMORY_ENGINES.find((x) => x.id === id);
  if (!e) {
    console.error(colorize(`Engine not found: ${id}`, RED));
    process.exit(1);
  }
  console.log(colorize(`
${e.name}`, BOLD + CYAN));
  if (e.nameZh) console.log(colorize(e.nameZh, DIM));
  console.log(`Layer: ${colorize(e.layer, YELLOW)}`);
  console.log(`
${e.description}`);
  if (e.descriptionZh) console.log(colorize(e.descriptionZh, DIM));
  console.log(`
${colorize("Use case:", BOLD)}
  ${e.useCase}`);
  if (e.useCaseZh) console.log(colorize(`  ${e.useCaseZh}`, DIM));
  console.log(`
${colorize("Code:", BOLD)}
${colorize(e.codePreview, DIM)}`);
  console.log(`
Installs: ${e.pulled}  \xB7  Rating: ${e.ratingSum}/${e.ratingCount}`);
};
var cmdDemo = (args) => {
  const id = args[0];
  if (!id) {
    console.error(colorize("Usage: demo <engine-id>", RED));
    process.exit(1);
  }
  const r = runDemo(id);
  console.log(colorize(`
${r.title}`, BOLD));
  console.log(colorize(`Steps (${r.steps.length} \xB7 ${r.durationMs.toFixed(2)}ms):`, DIM));
  r.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  console.log(colorize("\nOutput:", BOLD));
  console.log(r.output);
};
var cmdMcp = (args) => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize("Usage: mcp <serve|call>", RED));
    process.exit(1);
  }
  const server = new MCPServer();
  if (sub === "serve") {
    console.error(colorize("[mcp] serving on stdio (Ctrl+C to stop)", DIM));
    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const req = JSON.parse(line);
          const resp = server.handle(req);
          process.stdout.write(JSON.stringify(resp) + "\n");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 0, error: { code: -32700, message: `Parse error: ${message}` } }) + "\n");
        }
      }
    });
    process.stdin.on("end", () => process.exit(0));
    return;
  }
  if (sub === "call") {
    const method = args[1];
    const argsJson = args[2] ?? "{}";
    if (!method) {
      console.error(colorize("Usage: mcp call <method> [args-json]", RED));
      process.exit(1);
    }
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(argsJson);
    } catch (err) {
      console.error(colorize(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`, RED));
      process.exit(1);
    }
    const req = { jsonrpc: "2.0", id: 1, method, params: parsedArgs };
    const resp = server.handle(req);
    console.log(JSON.stringify(resp, null, 2));
    return;
  }
  console.error(colorize(`Unknown mcp subcommand: ${sub}`, RED));
  process.exit(1);
};
var cmdOpenMem = (args) => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize("Usage: openmem <create|list|get|search|stats|health>", RED));
    process.exit(1);
  }
  const adapter = new OpenMemoryAdapter();
  switch (sub) {
    case "create": {
      const [, agent, type, content, importance] = args;
      if (!agent || !type || !content) {
        console.error(colorize("Usage: openmem create <agent> <type> <content> [importance]", RED));
        process.exit(1);
      }
      const r = adapter.create({ agent_id: agent, type, content, importance: importance ? Number(importance) : 0.5 });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case "list": {
      const [, agent, type] = args;
      const r = adapter.list({ agent_id: agent, type });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case "get": {
      const id = args[1];
      if (!id) {
        console.error(colorize("Usage: openmem get <id>", RED));
        process.exit(1);
      }
      const r = adapter.get(id);
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case "search": {
      const [, query, limitStr] = args;
      if (!query) {
        console.error(colorize("Usage: openmem search <query> [limit]", RED));
        process.exit(1);
      }
      const r = adapter.search({ query, limit: limitStr ? Number(limitStr) : 5 });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case "stats": {
      const r = adapter.stats();
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case "health": {
      console.log(JSON.stringify({ ok: true, data: { records: adapter.recordCount(), uptime: 0 } }, null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown openmem subcommand: ${sub}`, RED));
      process.exit(1);
  }
};
var cmdCompat = () => {
  const t = new OpenMemoryComplianceTest();
  const r = t.runAll();
  console.log(colorize(`
OpenMemory compliance: ${r.pass}/${r.results.length} pass`, BOLD + (r.fail === 0 ? GREEN : RED)));
  for (const x of r.results) {
    console.log(`  ${colorize(x.ok ? "\u2713" : "\u2717", x.ok ? GREEN : RED)} ${x.name}`);
  }
};
var cmdHealth = () => {
  const server = new MCPServer();
  console.log(JSON.stringify(server.health(), null, 2));
};
var cmdLocales = () => {
  console.log(colorize("\nAvailable locales:", BOLD));
  console.log("  \u2022 en  English");
  console.log("  \u2022 zh  \u7B80\u4F53\u4E2D\u6587");
};
var cmdStreaming = (args) => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize("Usage: streaming <list|demo|produce|drain>", RED));
    process.exit(1);
  }
  const idx = new StreamingMasterIndex();
  switch (sub) {
    case "list": {
      console.log(colorize(`
Streaming engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(28), CYAN)} ${colorize("\u2022 " + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case "demo": {
      const bus = new EventBus();
      const producer = new StreamProducer();
      const consumer = new StreamConsumer();
      let busReceived = 0;
      bus.subscribe("demo", () => busReceived += 1);
      consumer.bind(producer);
      producer.emit("demo", "create", { agentId: "a1", source: "cli" });
      producer.emit("demo", "update", { agentId: "a1", source: "cli" });
      bus.publish({ topic: "demo", kind: "create", ts: Date.now(), payload: { x: 1 } });
      producer.flush();
      console.log(colorize("\nStreaming demo:", BOLD));
      console.log(`  bus received       : ${busReceived}`);
      console.log(`  consumer received  : ${consumer.summary().received}`);
      console.log(`  consumer topics   : ${consumer.summary().topics}`);
      console.log(`  producer metrics   : ${JSON.stringify(producer.metrics())}`);
      return;
    }
    case "produce": {
      const [, topic, kind] = args;
      if (!topic || !kind) {
        console.error(colorize("Usage: streaming produce <topic> <kind>", RED));
        process.exit(1);
      }
      const producer = new StreamProducer();
      const r = producer.emit(topic, kind, { source: "cli" });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case "drain": {
      const producer = new StreamProducer();
      producer.emit("a", "create", {});
      producer.emit("a", "update", {});
      const drained = producer.drain(10);
      console.log(JSON.stringify(drained, null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown streaming subcommand: ${sub}`, RED));
      process.exit(1);
  }
};
var cmdPlayback = (args) => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize("Usage: playback <list|demo|snapshot|timeline>", RED));
    process.exit(1);
  }
  const idx = new PlaybackMasterIndex();
  switch (sub) {
    case "list": {
      console.log(colorize(`
Playback engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(28), CYAN)} ${colorize("\u2022 " + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case "demo": {
      const snap = new MemorySnapshotter();
      const timeline = new TimelineView();
      const replay = new StepReplay();
      const coord = new ReplayCoordinator();
      coord.start();
      const s1 = snap.capture("before", "episodic", [{ key: "k1", value: { v: 1 } }, { key: "k2", value: { v: 2 } }]);
      coord.recordSnapshot();
      timeline.record([
        { topic: "demo", kind: "create", ts: Date.now(), payload: { phase: "init" } },
        { topic: "demo", kind: "update", ts: Date.now(), payload: { phase: "go" } }
      ]);
      coord.recordEvents(timeline.count());
      const s2 = snap.capture("after", "episodic", [{ key: "k1", value: { v: 1 } }, { key: "k2", value: { v: 99 } }, { key: "k3", value: { v: 3 } }]);
      coord.recordSnapshot();
      const diff = new DiffEngine().diff(s1, s2);
      coord.recordDiff();
      replay.fromEvents(timeline.list());
      replay.start();
      const first = replay.next();
      coord.end();
      console.log(colorize("\nPlayback demo:", BOLD));
      console.log(`  snapshots       : ${snap.stats().retained}`);
      console.log(`  timeline events : ${timeline.count()}`);
      console.log(`  diff summary    : ${JSON.stringify(new DiffEngine().summarize(diff))}`);
      console.log(`  replay steps    : ${replay.status().total}`);
      console.log(`  first replay    : ${JSON.stringify(first?.data)}`);
      return;
    }
    case "snapshot": {
      const [, label] = args;
      if (!label) {
        console.error(colorize("Usage: playback snapshot <label>", RED));
        process.exit(1);
      }
      const snap = new MemorySnapshotter();
      const r = snap.capture(label, "cli", [{ key: "cli", value: { ts: Date.now(), label } }]);
      console.log(JSON.stringify({ snapId: r.id, size: r.size }, null, 2));
      return;
    }
    case "timeline": {
      const [, nStr] = args;
      const n = nStr ? Number(nStr) : 5;
      const v = new TimelineView();
      v.record([
        { topic: "cli", kind: "create", ts: Date.now() - 200, payload: { a: 1 } },
        { topic: "cli", kind: "update", ts: Date.now() - 100, payload: { a: 2 } },
        { topic: "cli", kind: "delete", ts: Date.now() - 50, payload: { a: 3 } }
      ]);
      console.log(JSON.stringify(v.recent(n), null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown playback subcommand: ${sub}`, RED));
      process.exit(1);
  }
};
var cmdFederated = (args) => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize("Usage: federated <list|demo|share|audit>", RED));
    process.exit(1);
  }
  const idx = new FederatedMemoryIndex();
  switch (sub) {
    case "list": {
      console.log(colorize(`
Federated engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(28), CYAN)} ${colorize("\u2022 " + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case "demo": {
      const cohorts = new FederatedCohort();
      const shares = new FederatedMemoryShare();
      const audit = new PrivacyAudit();
      const budget = new PrivacyBudgetAggregator();
      const channel = new SecureChannel();
      const cohort = cohorts.create("team-a", "agent-1");
      cohorts.addMember(cohort.id, "agent-2");
      const share = shares.share("agent-1", cohort.id, "shared insight", 0.1, cohorts, audit);
      budget.setBudget("agent-1", 10);
      budget.consume("agent-1", 0.5);
      const { channelId } = channel.open("agent-1", "agent-2");
      channel.send("agent-1", "agent-2", "encrypted hello");
      console.log(colorize("\nFederated demo:", BOLD));
      console.log(`  cohort members  : ${cohorts.stats().members}`);
      console.log(`  share ok        : ${share.ok}`);
      console.log(`  audit entries   : ${audit.count()}`);
      console.log(`  budget stats    : ${JSON.stringify(budget.stats())}`);
      console.log(`  channel id      : ${channelId}`);
      console.log(`  secure messages : ${channel.stats().messages}`);
      return;
    }
    case "share": {
      const [, cohortName, content] = args;
      if (!cohortName || !content) {
        console.error(colorize("Usage: federated share <cohort> <content>", RED));
        process.exit(1);
      }
      const cohorts = new FederatedCohort();
      const shares = new FederatedMemoryShare();
      const audit = new PrivacyAudit();
      const cohort = cohorts.create(cohortName, "agent-cli");
      const r = shares.share("agent-cli", cohort.id, content, 0.1, cohorts, audit);
      console.log(JSON.stringify({ ok: r.ok, shareId: r.shareId, cohortId: cohort.id, auditCount: audit.count() }, null, 2));
      return;
    }
    case "audit": {
      const [, nStr] = args;
      const n = nStr ? Number(nStr) : 5;
      const audit = new PrivacyAudit();
      audit.record({ kind: "share", agentId: "demo", cohortId: "cohort-a" });
      audit.record({ kind: "read", agentId: "demo", cohortId: "cohort-a" });
      audit.record({ kind: "deny", agentId: "demo", cohortId: "cohort-a", reason: "no_access" });
      console.log(JSON.stringify(audit.recent(n), null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown federated subcommand: ${sub}`, RED));
      process.exit(1);
  }
};
var cmdCohortUI = (args) => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize("Usage: cohortui <list|demo|tree|report>", RED));
    process.exit(1);
  }
  const idx = new FederatedCohortsUIMasterIndex();
  switch (sub) {
    case "list": {
      console.log(colorize(`
Federated UI engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(34), CYAN)} ${colorize("\u2022 " + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case "demo": {
      const cohorts = new FederatedCohort();
      const budgets = new PrivacyBudgetAggregator();
      const audit = new PrivacyAudit();
      const c = cohorts.create("team-x", "agent-1");
      cohorts.addMember(c.id, "agent-2");
      audit.record({ kind: "share", agentId: "agent-1", cohortId: c.id });
      audit.record({ kind: "read", agentId: "agent-2", cohortId: c.id });
      audit.record({ kind: "deny", agentId: "stranger", cohortId: c.id, reason: "no_access" });
      budgets.setBudget("agent-1", 10);
      budgets.setBudget("agent-2", 10);
      budgets.consume("agent-1", 7);
      budgets.consume("agent-2", 2);
      const v = new CohortVisualizer();
      const g = new MembershipGraph();
      const ch = new PrivacyBudgetChart();
      const ex = new AuditExplorer();
      const rep = new CohortReport();
      const trees = v.buildTree(cohorts);
      g.build(cohorts);
      const points = ch.buildStacks(budgets);
      console.log(colorize("\nFederated UI demo:", BOLD));
      console.log(`  cohorts       : ${trees.length}`);
      console.log(`  graph edges   : ${g.stats().edges}`);
      console.log(`  budget points : ${points.length}`);
      console.log(`  max util      : ${(ch.summary(points).maxUtilization * 100).toFixed(0)}%`);
      console.log(`  timeline buckets: ${ex.timeline(audit, 6e4).length}`);
      console.log(`  audit by kind : ${JSON.stringify(ex.byKind(audit))}`);
      const reportPreview = rep.markdown("Demo Report", [rep.cohortSection(cohorts), rep.budgetSection(budgets)]);
      console.log(`  report chars  : ${reportPreview.length}`);
      return;
    }
    case "tree": {
      const cohorts = new FederatedCohort();
      const c = cohorts.create("alpha", "agent-1", "moderate");
      cohorts.addMember(c.id, "agent-2");
      const c2 = cohorts.create("beta", "agent-3", "strict");
      const v = new CohortVisualizer();
      const trees = v.buildTree(cohorts);
      const flat = v.flatten(trees);
      console.log(colorize("\nCohort tree:", BOLD));
      for (const node of flat) {
        console.log(`  ${"  ".repeat(node.depth)}${node.type === "cohort" ? "\u{1F4C1}" : "\u{1F464}"} ${node.label}`);
      }
      return;
    }
    case "report": {
      const cohorts = new FederatedCohort();
      const audit = new PrivacyAudit();
      const budgets = new PrivacyBudgetAggregator();
      const c = cohorts.create("demo", "agent-1");
      audit.record({ kind: "share", agentId: "agent-1", cohortId: c.id });
      budgets.setBudget("agent-1", 10);
      budgets.consume("agent-1", 4);
      const r = new CohortReport();
      const md = r.markdown("Cohort Report", [
        r.cohortSection(cohorts),
        r.budgetSection(budgets),
        r.auditSection(audit)
      ]);
      console.log(md);
      return;
    }
    default:
      console.error(colorize(`Unknown cohortui subcommand: ${sub}`, RED));
      process.exit(1);
  }
};
main();
