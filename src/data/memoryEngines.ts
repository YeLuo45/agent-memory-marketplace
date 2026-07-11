// Engine metadata — describes each engine for the marketplace UI

export interface EngineMeta {
  id: string;
  name: string;
  layer: 'episodic' | 'semantic' | 'procedural' | 'consolidation' | 'short-term' | 'long-term' | 'working' | 'associative' | 'compressor' | 'integration';
  description: string;
  useCase: string;
  codePreview: string;
  pulled: number;
  ratingSum: number;
  ratingCount: number;
}

export const MEMORY_ENGINES: EngineMeta[] = [
  {
    id: 'EpisodicStore',
    name: 'EpisodicStore',
    layer: 'episodic',
    description: 'Append-only timestamped episode ledger with importance scoring.',
    useCase: 'Record every user-agent interaction as an episode with importance. Query recent or important episodes to recall past context.',
    codePreview: `const store = new EpisodicStore();
const e1 = store.record('user said hi', 0.7);
const e2 = store.record('user asked about weather', 0.9);
store.recent(10);   // chronologically
store.important(0.8);  // by importance score`,
    pulled: 45200,
    ratingSum: 285,
    ratingCount: 60,
  },
  {
    id: 'SemanticIndex',
    name: 'SemanticIndex',
    layer: 'semantic',
    description: 'Tag-based semantic index. Add tags, find by tag, retrieve tag list.',
    useCase: 'Attach semantic tags to memories (e.g. topic, intent, project), then query by tag without full-text search.',
    codePreview: `const idx = new SemanticIndex();
idx.add('m1', ['python', 'ai']).add('m2', ['python']);
idx.findByTag('python');  // ['m1', 'm2']`,
    pulled: 32100,
    ratingSum: 198,
    ratingCount: 47,
  },
  {
    id: 'ProceduralCache',
    name: 'ProceduralCache',
    layer: 'procedural',
    description: 'Procedure step cache with lastUsed tracking for LRU-like access patterns.',
    useCase: 'Store multi-step procedures (e.g. "how to reset password") and re-emit them when re-used. Tracks lastUsed to recency-prioritize.',
    codePreview: `const cache = new ProceduralCache();
cache.store('reset-pwd', ['verify email', 'send token', 'redirect']);
cache.get('reset-pwd');  // ['verify email', ...] + updates lastUsed`,
    pulled: 28900,
    ratingSum: 162,
    ratingCount: 38,
  },
  {
    id: 'ConsolidationEngine',
    name: 'ConsolidationEngine',
    layer: 'consolidation',
    description: 'Similarity-based memory merging. Combines near-duplicate memories into consolidated entries.',
    useCase: 'Periodically dedupe and merge similar episodes to prevent unbounded growth. Keeps average importance across merges.',
    codePreview: `const c = new ConsolidationEngine();
const merged = c.consolidate([itemA, itemB]); // Jaccard sim ≥ threshold → merged`,
    pulled: 19400,
    ratingSum: 89,
    ratingCount: 25,
  },
  {
    id: 'ForgettingEngine',
    name: 'ForgettingEngine',
    layer: 'consolidation',
    description: 'Ebbinghaus-style decay. Drops memories below a relevance threshold.',
    useCase: 'Apply exponential decay to importance over time. Auto-forget trivially old or low-importance entries.',
    codePreview: `const f = new ForgettingEngine();
f.relevance(oldItem, 100_000);  // importance * exp(-age/decay)`,
    pulled: 17800,
    ratingSum: 95,
    ratingCount: 22,
  },
  {
    id: 'MemoryRetriever',
    name: 'MemoryRetriever',
    layer: 'semantic',
    description: 'Score-based retrieval combining importance + recency + query match.',
    useCase: 'Score every candidate memory and return top-k most relevant for the current query.',
    codePreview: `const r = new MemoryRetriever();
const top = r.retrieve(items, 'weather', 5);`,
    pulled: 22400,
    ratingSum: 142,
    ratingCount: 32,
  },
  {
    id: 'MemoryEncoder',
    name: 'MemoryEncoder',
    layer: 'procedural',
    description: 'Hash + slice-based content encoder for round-trip storage.',
    useCase: 'Compactly encode content strings for storage with deterministic round-trip and size estimation.',
    codePreview: `const e = new MemoryEncoder();
const encoded = e.encode('hello world');  // 'mem:abc12345:hello w'`,
    pulled: 12000,
    ratingSum: 67,
    ratingCount: 16,
  },
  {
    id: 'MemoryDecoder',
    name: 'MemoryDecoder',
    layer: 'procedural',
    description: 'Reverse encoding + delimiter-based splitting for batch decode.',
    useCase: 'Reverse the encoded memory back to its original content; split consolidated batches back into items.',
    codePreview: `const d = new MemoryDecoder();
d.reverse('mem:abc:hello');  // 'hello'
d.split('a | b | c');         // ['a', 'b', 'c']`,
    pulled: 11900,
    ratingSum: 64,
    ratingCount: 15,
  },
  {
    id: 'MemoryHierarchy',
    name: 'MemoryHierarchy',
    layer: 'consolidation',
    description: 'Tiered classification into hot/warm/cold with time-and-importance rules.',
    useCase: 'Partition memories into hot (recent+important) → warm (recent) → cold (old). Each tier can have different storage backends.',
    codePreview: `const h = new MemoryHierarchy();
h.partition(items);  // { hot, warm, cold }`,
    pulled: 15600,
    ratingSum: 96,
    ratingCount: 24,
  },
  {
    id: 'LongTermMemoryManager',
    name: 'LongTermMemoryManager',
    layer: 'long-term',
    description: 'Permanent key-value store with age tracking and list operations.',
    useCase: 'Store memories that survive session boundaries. Track age for eviction policy.',
    codePreview: `const m = new LongTermMemoryManager();
m.store('preference-theme', 'dark');
m.age('preference-theme');  // ms since last store`,
    pulled: 20100,
    ratingSum: 124,
    ratingCount: 28,
  },
  {
    id: 'ShortTermMemory',
    name: 'ShortTermMemory',
    layer: 'short-term',
    description: 'Bounded FIFO buffer that evicts oldest entries when full.',
    useCase: 'Keep a bounded rolling window of recent conversation turns without unbounded growth.',
    codePreview: `const s = new ShortTermMemory(10);
s.push('hello').push('world');  // [hello, world]`,
    pulled: 18600,
    ratingSum: 110,
    ratingCount: 26,
  },
  {
    id: 'WorkingMemory',
    name: 'WorkingMemory',
    layer: 'working',
    description: 'Attention-focused store with decay mechanism for active reasoning.',
    useCase: 'Keep currently-active items (recent query + supporting facts) with attention scores that decay over time.',
    codePreview: `const w = new WorkingMemory();
w.focus('current-task', 'debug auth flow', 1.0);
w.decay(0.9);  // attention * 0.9`,
    pulled: 17200,
    ratingSum: 105,
    ratingCount: 23,
  },
  {
    id: 'AssociativeMemory',
    name: 'AssociativeMemory',
    layer: 'associative',
    description: 'Graph-style link store with BFS-based reachability for associative recall.',
    useCase: 'Link related memories (e.g. "user mentioned ramen → user likes Japanese food"). Traverse graph for associative recall.',
    codePreview: `const a = new AssociativeMemory();
a.link('ramen', 'japanese-food');
a.neighbors('ramen');  // ['japanese-food']
a.reachable('ramen', 2);  // broader associative recall`,
    pulled: 14000,
    ratingSum: 78,
    ratingCount: 18,
  },
  {
    id: 'ContextWindow',
    name: 'ContextWindow',
    layer: 'working',
    description: 'Bounded token window with FIFO eviction when capacity exceeded.',
    useCase: 'Track the active LLM context window size in tokens and reject/evict when full.',
    codePreview: `const w = new ContextWindow(4096);
w.add('token1'); w.isFull();  // false
// ... fill it up ...
w.remaining();  // 0`,
    pulled: 21800,
    ratingSum: 138,
    ratingCount: 31,
  },
  {
    id: 'AttentionMechanism',
    name: 'AttentionMechanism',
    layer: 'working',
    description: 'Softmax-based attention with top-K retrieval for relevance ranking.',
    useCase: 'Compute softmax attention weights over candidate context and pick top-K most relevant.',
    codePreview: `const a = new AttentionMechanism();
const w = a.attend([1, 0], [[1, 0], [0, 1]]);
a.topK(w, 1);  // [0]`,
    pulled: 16200,
    ratingSum: 92,
    ratingCount: 21,
  },
  {
    id: 'MemoryCompression',
    name: 'MemoryCompression',
    layer: 'compressor',
    description: 'Deduplication + truncation compression with ratio measurement.',
    useCase: 'Compress memory payloads before storage to bound total token cost. Measure compression ratio.',
    codePreview: `const c = new MemoryCompression();
c.compress(['a', 'b', 'a']);  // ['a', 'b']
c.ratio(original, compressed);  // 0.67`,
    pulled: 9900,
    ratingSum: 51,
    ratingCount: 12,
  },
  {
    id: 'MemoryCache',
    name: 'MemoryCache',
    layer: 'integration',
    description: 'LRU-style key cache for hot memory access with eviction on size cap.',
    useCase: 'Cache frequently-accessed memory keys in memory to avoid recomputation or storage hit.',
    codePreview: `const c = new MemoryCache(100);
c.set('user-id', 'u_123');
c.get('user-id');  // 'u_123'
c.invalidate('user-id');  // true`,
    pulled: 11800,
    ratingSum: 60,
    ratingCount: 14,
  },
  {
    id: 'MemoryProfiler',
    name: 'MemoryProfiler',
    layer: 'integration',
    description: 'Operation duration + bytes profiler per agent.',
    useCase: 'Profile per-operation memory cost (duration + bytes) per agent ID for performance analysis.',
    codePreview: `const p = new MemoryProfiler();
p.record('agent-1', 25, 1024);
p.averageDuration('agent-1');  // 25ms`,
    pulled: 10500,
    ratingSum: 55,
    ratingCount: 13,
  },
  {
    id: 'MemoryDashboard',
    name: 'MemoryDashboard',
    layer: 'integration',
    description: 'Headless panel container for memory UI widgets.',
    useCase: 'Build a memory operations dashboard with named panels (LTM size, STM hit rate, retrieval quality).',
    codePreview: `const d = new MemoryDashboard();
d.setPanel('ltm-size', 'LTM Size', 1024);`,
    pulled: 9400,
    ratingSum: 47,
    ratingCount: 11,
  },
  {
    id: 'MemoryConfig',
    name: 'MemoryConfig',
    layer: 'integration',
    description: 'Typed config registry with getNumber/getString/getBoolean typed accessors.',
    useCase: 'Centralize memory subsystem configuration with type-safe accessors and defaults.',
    codePreview: `const c = new MemoryConfig();
c.set('window', 4096).set('compression', 'gzip');
c.getNumber('window');  // 4096`,
    pulled: 9700,
    ratingSum: 49,
    ratingCount: 12,
  },
  {
    id: 'MemoryAudit',
    name: 'MemoryAudit',
    layer: 'integration',
    description: 'Per-user action log with time + memory type for compliance and debugging.',
    useCase: 'Audit every memory write/read with timestamp, user ID, action, memory type for compliance.',
    codePreview: `const a = new MemoryAudit();
a.record('user-1', 'write', 'episodic');
a.forUser('user-1');  // audit trail for that user`,
    pulled: 7800,
    ratingSum: 38,
    ratingCount: 9,
  },
  {
    id: 'MemoryProfile',
    name: 'MemoryProfile',
    layer: 'integration',
    description: 'Per-agent run counter with items + duration averages.',
    useCase: 'Track per-agent memory usage and runtime for cost analysis.',
    codePreview: `const p = new MemoryProfile();
p.record('agent-7', 50, 100);  // session id, items, duration ms
p.averageItems('agent-7');  // 50`,
    pulled: 7200,
    ratingSum: 36,
    ratingCount: 8,
  },
  {
    id: 'MemoryMigration',
    name: 'MemoryMigration',
    layer: 'integration',
    description: 'Version-based migration runner for memory schema evolution.',
    useCase: 'Migrate stored memories when schema evolves. v1→v2 migrations run idempotently and asynchronously.',
    codePreview: `const m = new MemoryMigration();
m.define('v2', async () => { /* transform v1 records */ });
await m.run('v2');
m.isApplied('v2');  // true`,
    pulled: 6500,
    ratingSum: 32,
    ratingCount: 7,
  },
  {
    id: 'MemoryReport',
    name: 'MemoryReport',
    layer: 'integration',
    description: 'Markdown + CSV report generator for memory metrics.',
    useCase: 'Generate human-readable memory subsystem reports for stakeholders: top topics, growth, retention.',
    codePreview: `const r = new MemoryReport();
r.generate('Q1 Memory', { ltm: 1000, stm: 50 });  // markdown
r.toCSV({ a: 1 });  // 'metric,value\\n...'
`,
    pulled: 6900,
    ratingSum: 34,
    ratingCount: 8,
  },
  {
    id: 'MemoryBenchmark',
    name: 'MemoryBenchmark',
    layer: 'integration',
    description: 'Per-method benchmark tracker with best-result selection.',
    useCase: 'Compare memory implementations (episodic vs semantic) and pick best by score.',
    codePreview: `const b = new MemoryBenchmark();
b.record('episodic', 0.85).record('semantic', 0.95);
b.best();  // { name: 'semantic', score: 0.95 }`,
    pulled: 6300,
    ratingSum: 31,
    ratingCount: 7,
  },
  {
    id: 'MemoryCoreIndex',
    name: 'MemoryCoreIndex',
    layer: 'integration',
    description: 'Batch 1/3 index of all 10 core memory engines.',
    useCase: 'Enumerate core engines for registry listings or dynamic discovery.',
    codePreview: `new MemoryCoreIndex().list();
// ['EpisodicStore', 'SemanticIndex', 'ProceduralCache', ...]`,
    pulled: 5400,
    ratingSum: 27,
    ratingCount: 6,
  },
  {
    id: 'MemoryAdvancedIndex',
    name: 'MemoryAdvancedIndex',
    layer: 'integration',
    description: 'Batch 2/3 index of all 10 advanced memory engines.',
    useCase: 'Same as Core index but for the advanced batch.',
    codePreview: `new MemoryAdvancedIndex().count();  // 10`,
    pulled: 4900,
    ratingSum: 25,
    ratingCount: 6,
  },
  {
    id: 'MemoryMasterIndex',
    name: 'MemoryMasterIndex',
    layer: 'integration',
    description: 'Top-level master index of all 29 memory engines across all 3 batches.',
    useCase: 'Single registry for dynamic discovery of any agent-memory engine.',
    codePreview: `new MemoryMasterIndex().count();  // 29
new MemoryMasterIndex().has('EpisodicStore');  // true`,
    pulled: 6100,
    ratingSum: 30,
    ratingCount: 7,
  },
  {
    id: 'VectorEmbedder',
    name: 'VectorEmbedder',
    layer: 'memvector',
    description: 'Deterministic pseudo-random embedding (text → vector + project).',
    useCase: 'Convert text/tag inputs to fixed-dimension vectors for similarity search.',
    codePreview: `const e = new VectorEmbedder(64);
const v = e.embedText('hello world');  // { dim: 64, values: [0.012, -0.034, ...] }
e.project(v.values, 32);  // projection to 32 dims`,
    pulled: 4200,
    ratingSum: 26,
    ratingCount: 6,
  },
  {
    id: 'HNSWIndex',
    name: 'HNSWIndex',
    layer: 'memvector',
    description: 'Simplified HNSW-style graph: K-NN inserts + beam query with cosine similarity.',
    useCase: 'Build a scalable ANN index over memory embeddings for fast top-K retrieval.',
    codePreview: `const idx = new HNSWIndex(16, 3);
idx.insert('a', [1, 0, 0]); idx.insert('b', [1, 0, 0.1]);
idx.query([1, 0, 0], 2);  // returns [{id: 'a', score: 1.0}, {id: 'b', score: 0.99}]`,
    pulled: 7800,
    ratingSum: 47,
    ratingCount: 11,
  },
  {
    id: 'PQCompressor',
    name: 'PQCompressor',
    layer: 'memvector',
    description: 'Product Quantization: split vector into K sub-vectors, store centroid id (1 byte each).',
    useCase: 'Compress memory embeddings to 1/8 size with ~90% recall retention for ANN search.',
    codePreview: `const c = new PQCompressor(4);  // 4 sub-vectors
const v = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const codes = c.compress(v);  // [byte, byte, byte, byte]
c.compressionRatio(8);  // 0.5`,
    pulled: 3200,
    ratingSum: 19,
    ratingCount: 5,
  },
  {
    id: 'HybridSearcher',
    name: 'HybridSearcher',
    layer: 'memvector',
    description: 'Combine tag-match (Jaccard) + vector similarity with tunable α.',
    useCase: 'Get the best of both worlds: combine tag-based metadata search with semantic vector similarity.',
    codePreview: `const h = new HybridSearcher();
h.search('python', [1, 0, 0], items, { alpha: 0.5 });
// alpha=1 → pure tag, alpha=0 → pure vector
h.tuneAlpha(...);  // grid-search best α over ground-truth hits`,
    pulled: 5400,
    ratingSum: 33,
    ratingCount: 7,
  },
  {
    id: 'VectorCache',
    name: 'VectorCache',
    layer: 'memvector',
    description: 'LRU cache for query/embedding key-value lookups with hit-rate tracking.',
    useCase: 'Skip recomputing embeddings for repeated queries. Track cache hit-rate to tune policy.',
    codePreview: `const c = new VectorCache(256);
c.set('python-query', [embed1, embed2, ...]);
c.get('python-query');  // hit
c.hitRate();  // 0.94`,
    pulled: 4100,
    ratingSum: 25,
    ratingCount: 6,
  },
  {
    id: 'VectorMigrator',
    name: 'VectorMigrator',
    layer: 'memvector',
    description: 'Migrate vectors between embedding dimensions (model upgrades, PCA, project).',
    useCase: 'Upgrade from a 64-dim model to 128-dim without recomputing every embedding.',
    codePreview: `const m = new VectorMigrator();
m.migrate([[1, 2, 3, 4]], 4, 8, 'random-projection');
m.migrate([[1, 2]], 2, 5, 'pad-truncate');  // → [[1, 2, 0, 0, 0]]`,
    pulled: 2300,
    ratingSum: 14,
    ratingCount: 4,
  },
];

export const LAYERS = [
  { id: 'episodic', label: 'Episodic', color: '#7c3aed', desc: 'Time-stamped event records' },
  { id: 'semantic', label: 'Semantic', color: '#2563eb', desc: 'Tag-based indexing & retrieval' },
  { id: 'procedural', label: 'Procedural', color: '#16a34a', desc: 'Procedure caching' },
  { id: 'consolidation', label: 'Consolidation', color: '#ea580c', desc: 'Dedup, decay, tiering' },
  { id: 'short-term', label: 'Short-term', color: '#0891b2', desc: 'Bounded rolling windows' },
  { id: 'long-term', label: 'Long-term', color: '#0d9488', desc: 'Permanent key-value storage' },
  { id: 'working', label: 'Working', color: '#db2777', desc: 'Attention-decay active reasoning' },
  { id: 'associative', label: 'Associative', color: '#a04f1a', desc: 'Graph-based link recall' },
  { id: 'compressor', label: 'Compressor', color: '#7c2d12', desc: 'Compression & ratio' },
  { id: 'integration', label: 'Integration', color: '#5e81ac', desc: 'Dashboard, audit, profiling' },
  { id: 'memvector', label: 'MemVector', color: '#d946ef', desc: 'ANN + hybrid vector search' },
] as const;
