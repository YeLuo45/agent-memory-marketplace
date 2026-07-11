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
    nameZh: '事件记忆存储',
    layer: 'episodic',
    description: 'Append-only timestamped episode ledger with importance scoring.',
    descriptionZh: '仅追加、带时间戳的事件账本，支持重要性评分。',
    useCase: 'Record every user-agent interaction as an episode with importance. Query recent or important episodes to recall past context.',
    useCaseZh: '将用户与智能体的每次交互作为一条事件记录，并打重要性标签。可按时间或重要性查询历史上下文。',
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
    nameZh: '语义索引',
    layer: 'semantic',
    description: 'Tag-based semantic index. Add tags, find by tag, retrieve tag list.',
    descriptionZh: '基于标签的语义索引，支持 findByTag 与标签查询。',
    useCase: 'Attach semantic tags to memories (e.g. topic, intent, project), then query by tag without full-text search.',
    useCaseZh: '为记忆打语义标签（话题、意图、项目），然后按标签查询，无需全文搜索。',
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
    nameZh: '程序缓存',
    layer: 'procedural',
    description: 'Procedure step cache with lastUsed tracking for LRU-like access patterns.',
    descriptionZh: '带 LRU-like lastUsed 追踪的过程步骤缓存。',
    useCase: 'Store multi-step procedures (e.g. "how to reset password") and re-emit them when re-used. Tracks lastUsed to recency-prioritize.',
    useCaseZh: '存储多步流程（如"如何重置密码"），复用时再次返回；按最近访问优先。',
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
    nameZh: '整合引擎',
    layer: 'consolidation',
    description: 'Similarity-based memory merging. Combines near-duplicate memories into consolidated entries.',
    descriptionZh: '基于相似度的记忆合并（Jaccard）。',
    useCase: 'Periodically dedupe and merge similar episodes to prevent unbounded growth. Keeps average importance across merges.',
    useCaseZh: '定期合并相似事件以防止无限增长，保留平均重要性。',
    codePreview: `const c = new ConsolidationEngine();
const merged = c.consolidate([itemA, itemB]); // Jaccard sim ≥ threshold → merged`,
    pulled: 19400,
    ratingSum: 89,
    ratingCount: 25,
  },
  {
    id: 'ForgettingEngine',
    name: 'ForgettingEngine',
    nameZh: '遗忘引擎',
    layer: 'consolidation',
    description: 'Ebbinghaus-style decay. Drops memories below a relevance threshold.',
    descriptionZh: '艾宾浩斯式指数衰减。',
    useCase: 'Apply exponential decay to importance over time. Auto-forget trivially old or low-importance entries.',
    useCaseZh: '随时间对重要性应用指数衰减，自动遗忘老旧或低重要性条目。',
    codePreview: `const f = new ForgettingEngine();
f.relevance(oldItem, 100_000);  // importance * exp(-age/decay)`,
    pulled: 17800,
    ratingSum: 95,
    ratingCount: 22,
  },
  {
    id: 'MemoryRetriever',
    name: 'MemoryRetriever',
    nameZh: '记忆检索器',
    layer: 'semantic',
    description: 'Score-based retrieval combining importance + recency + query match.',
    descriptionZh: '结合重要性、新近度、匹配的评分检索。',
    useCase: 'Score every candidate memory and return top-k most relevant for the current query.',
    useCaseZh: '为每个候选记忆打分，返回当前查询最相关的 top-k。',
    codePreview: `const r = new MemoryRetriever();
const top = r.retrieve(items, 'weather', 5);`,
    pulled: 22400,
    ratingSum: 142,
    ratingCount: 32,
  },
  {
    id: 'MemoryEncoder',
    name: 'MemoryEncoder',
    nameZh: '记忆编码器',
    layer: 'procedural',
    description: 'Hash + slice-based content encoder for round-trip storage.',
    descriptionZh: '基于哈希的确定性内容编码器。',
    useCase: 'Compactly encode content strings for storage with deterministic round-trip and size estimation.',
    useCaseZh: '对内容字符串进行紧凑编码，支持确定性往返和大小估算。',
    codePreview: `const e = new MemoryEncoder();
const encoded = e.encode('hello world');  // 'mem:abc12345:hello w'`,
    pulled: 12000,
    ratingSum: 67,
    ratingCount: 16,
  },
  {
    id: 'MemoryDecoder',
    name: 'MemoryDecoder',
    nameZh: '记忆解码器',
    layer: 'procedural',
    description: 'Reverse encoding + delimiter-based splitting for batch decode.',
    descriptionZh: '反向编码 + 分隔符批量拆分。',
    useCase: 'Reverse the encoded memory back to its original content; split consolidated batches back into items.',
    useCaseZh: '将编码后的记忆反转为原始内容；将合并批量拆回单独项。',
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
    nameZh: '记忆层级',
    layer: 'consolidation',
    description: 'Tiered classification into hot/warm/cold with time-and-importance rules.',
    descriptionZh: '热点/温/冷 三级分类。',
    useCase: 'Partition memories into hot (recent+important) → warm (recent) → cold (old). Each tier can have different storage backends.',
    useCaseZh: '按"热度"把记忆分成 hot（近+重要）/warm（近期）/cold（久远），每层可挂不同存储后端。',
    codePreview: `const h = new MemoryHierarchy();
h.partition(items);  // { hot, warm, cold }`,
    pulled: 15600,
    ratingSum: 96,
    ratingCount: 24,
  },
  {
    id: 'LongTermMemoryManager',
    name: 'LongTermMemoryManager',
    nameZh: '长期记忆管理',
    layer: 'long-term',
    description: 'Permanent key-value store with age tracking and list operations.',
    descriptionZh: '永久键值存储，带 age 追踪与 list 操作。',
    useCase: 'Store memories that survive session boundaries. Track age for eviction policy.',
    useCaseZh: '跨会话保存记忆，跟踪 age 以支持淘汰策略。',
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
    nameZh: '短期记忆',
    layer: 'short-term',
    description: 'Bounded FIFO buffer that evicts oldest entries when full.',
    descriptionZh: '有界 FIFO 滚动缓冲区，自动淘汰最旧条目。',
    useCase: 'Keep a bounded rolling window of recent conversation turns without unbounded growth.',
    useCaseZh: '保持会话上下文的滚动窗口，避免无限增长。',
    codePreview: `const s = new ShortTermMemory(10);
s.push('hello').push('world');  // [hello, world]`,
    pulled: 18600,
    ratingSum: 110,
    ratingCount: 26,
  },
  {
    id: 'WorkingMemory',
    name: 'WorkingMemory',
    nameZh: '工作记忆',
    layer: 'working',
    description: 'Attention-focused store with decay mechanism for active reasoning.',
    descriptionZh: '注意力聚焦 + 衰减的工作集。',
    useCase: 'Keep currently-active items (recent query + supporting facts) with attention scores that decay over time.',
    useCaseZh: '保存当前活跃项（当前查询 + 支撑事实），注意力随时间衰减。',
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
    nameZh: '联想记忆',
    layer: 'associative',
    description: 'Graph-style link store with BFS-based reachability for associative recall.',
    descriptionZh: '图状链接存储 + BFS 可达性，用于联想回忆。',
    useCase: 'Link related memories (e.g. "user mentioned ramen → user likes Japanese food"). Traverse graph for associative recall.',
    useCaseZh: '链接相关记忆（如"用户提到拉面 → 用户喜欢日料"），图遍历支持联想回忆。',
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
    nameZh: '上下文窗口',
    layer: 'working',
    description: 'Bounded token window with FIFO eviction when capacity exceeded.',
    descriptionZh: '有界 token 窗口，FIFO 淘汰。',
    useCase: 'Track the active LLM context window size in tokens and reject/evict when full.',
    useCaseZh: '跟踪 LLM 上下文大小 token，满则拒绝/淘汰。',
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
    nameZh: '注意力机制',
    layer: 'working',
    description: 'Softmax-based attention with top-K retrieval for relevance ranking.',
    descriptionZh: '基于 softmax 的注意力 + top-K 选取。',
    useCase: 'Compute softmax attention weights over candidate context and pick top-K most relevant.',
    useCaseZh: '对候选上下文计算 softmax 权重并选取 top-K 最相关。',
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
    nameZh: '记忆压缩',
    layer: 'compressor',
    description: 'Deduplication + truncation compression with ratio measurement.',
    descriptionZh: '去重 + 截断压缩，输出比例。',
    useCase: 'Compress memory payloads before storage to bound total token cost. Measure compression ratio.',
    useCaseZh: '存储前压缩记忆 payload，控制 token 总开销。',
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
    nameZh: '记忆缓存',
    layer: 'integration',
    description: 'LRU-style key cache for hot memory access with eviction on size cap.',
    descriptionZh: '热门访问键的 LRU 缓存与淘汰。',
    useCase: 'Cache frequently-accessed memory keys in memory to avoid recomputation or storage hit.',
    useCaseZh: '缓存高频访问的记忆键，避免重复计算或存储命中。',
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
    nameZh: '记忆画像',
    layer: 'integration',
    description: 'Operation duration + bytes profiler per agent.',
    descriptionZh: '每 agent 的操作时长 + 字节画像。',
    useCase: 'Profile per-operation memory cost (duration + bytes) per agent ID for performance analysis.',
    useCaseZh: '按 agent ID 画像每操作记忆成本（时长 + 字节）。',
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
    nameZh: '记忆仪表盘',
    layer: 'integration',
    description: 'Headless panel container for memory UI widgets.',
    descriptionZh: '记忆 UI 的面板容器。',
    useCase: 'Build a memory operations dashboard with named panels (LTM size, STM hit rate, retrieval quality).',
    useCaseZh: '搭建记忆操作仪表盘，含命名面板（LTM 大小、STM 命中率、检索质量）。',
    codePreview: `const d = new MemoryDashboard();
d.setPanel('ltm-size', 'LTM Size', 1024);`,
    pulled: 9400,
    ratingSum: 47,
    ratingCount: 11,
  },
  {
    id: 'MemoryConfig',
    name: 'MemoryConfig',
    nameZh: '记忆配置',
    layer: 'integration',
    description: 'Typed config registry with getNumber/getString/getBoolean typed accessors.',
    descriptionZh: '类型化配置注册表 + getNumber/getString/getBoolean。',
    useCase: 'Centralize memory subsystem configuration with type-safe accessors and defaults.',
    useCaseZh: '集中记忆子系统配置，类型安全访问器 + 默认值。',
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
    nameZh: '记忆审计',
    layer: 'integration',
    description: 'Per-user action log with time + memory type for compliance and debugging.',
    descriptionZh: '每用户带时间戳 + 记忆类型的审计日志。',
    useCase: 'Audit every memory write/read with timestamp, user ID, action, memory type for compliance.',
    useCaseZh: '审计每次记忆读写，含时间戳、用户、动作、记忆类型。',
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
    nameZh: '记忆画像分析',
    layer: 'integration',
    description: 'Per-agent run counter with items + duration averages.',
    descriptionZh: '每 agent 项目数 + 时长平均。',
    useCase: 'Track per-agent memory usage and runtime for cost analysis.',
    useCaseZh: '跟踪每 agent 记忆使用情况与运行时，进行成本分析。',
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
    nameZh: '记忆迁移',
    layer: 'integration',
    description: 'Version-based migration runner for memory schema evolution.',
    descriptionZh: '基于版本的迁移执行器。',
    useCase: 'Migrate stored memories when schema evolves. v1→v2 migrations run idempotently and asynchronously.',
    useCaseZh: '当 schema 演化时迁移存储的记忆。v1→v2 迁移幂等且异步执行。',
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
    nameZh: '记忆报告',
    layer: 'integration',
    description: 'Markdown + CSV report generator for memory metrics.',
    descriptionZh: 'Markdown + CSV 报告生成器。',
    useCase: 'Generate human-readable memory subsystem reports for stakeholders: top topics, growth, retention.',
    useCaseZh: '为利益相关方生成可读的内存子系统报告：热门话题、增长、留存。',
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
    nameZh: '记忆基准',
    layer: 'integration',
    description: 'Per-method benchmark tracker with best-result selection.',
    descriptionZh: '每个方法基准追踪 + 最优选择。',
    useCase: 'Compare memory implementations (episodic vs semantic) and pick best by score.',
    useCaseZh: '对比内存实现（如 episodic vs semantic）并按分数选出最优。',
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
    nameZh: '记忆核心索引',
    layer: 'integration',
    description: 'Batch 1/3 index of all 10 core memory engines.',
    descriptionZh: '10 个核心引擎的批次索引。',
    useCase: 'Enumerate core engines for registry listings or dynamic discovery.',
    useCaseZh: '枚举核心引擎用于注册表列表或动态发现。',
    codePreview: `new MemoryCoreIndex().list();
// ['EpisodicStore', 'SemanticIndex', 'ProceduralCache', ...]`,
    pulled: 5400,
    ratingSum: 27,
    ratingCount: 6,
  },
  {
    id: 'MemoryAdvancedIndex',
    name: 'MemoryAdvancedIndex',
    nameZh: '记忆高级索引',
    layer: 'integration',
    description: 'Batch 2/3 index of all 10 advanced memory engines.',
    descriptionZh: '10 个高级引擎的批次索引。',
    useCase: 'Same as Core index but for the advanced batch.',
    useCaseZh: '同上但针对高级批次。',
    codePreview: `new MemoryAdvancedIndex().count();  // 10`,
    pulled: 4900,
    ratingSum: 25,
    ratingCount: 6,
  },
  {
    id: 'MemoryMasterIndex',
    name: 'MemoryMasterIndex',
    nameZh: '记忆主索引',
    layer: 'integration',
    description: 'Top-level master index of all 29 memory engines across all 3 batches.',
    descriptionZh: '38 个记忆引擎的顶层主索引。',
    useCase: 'Single registry for dynamic discovery of any agent-memory engine.',
    useCaseZh: '用于动态发现任何 agent-memory 引擎的单一注册表。',
    codePreview: `new MemoryMasterIndex().count();  // 29
new MemoryMasterIndex().has('EpisodicStore');  // true`,
    pulled: 6100,
    ratingSum: 30,
    ratingCount: 7,
  },
  {
    id: 'VectorEmbedder',
    name: 'VectorEmbedder',
    nameZh: '向量嵌入器',
    layer: 'memvector',
    description: 'Deterministic pseudo-random embedding (text → vector + project).',
    descriptionZh: '确定性嵌入：文本/标签 → 固定维度向量 + 投影。',
    useCase: 'Convert text/tag inputs to fixed-dimension vectors for similarity search.',
    useCaseZh: '将文本/标签输入转为固定维度向量，用于相似性搜索。',
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
    nameZh: 'HNSW 索引',
    layer: 'memvector',
    description: 'Simplified HNSW-style graph: K-NN inserts + beam query with cosine similarity.',
    descriptionZh: 'HNSW 风格 ANN：K-NN 插入 + 波束查询。',
    useCase: 'Build a scalable ANN index over memory embeddings for fast top-K retrieval.',
    useCaseZh: '为记忆嵌入构建可扩展 ANN 索引，实现快速 top-K 检索。',
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
    nameZh: 'PQ 压缩器',
    layer: 'memvector',
    description: 'Product Quantization: split vector into K sub-vectors, store centroid id (1 byte each).',
    descriptionZh: 'Product Quantization：把向量切成 K 个子向量，每子向量存 1 字节中心 ID。',
    useCase: 'Compress memory embeddings to 1/8 size with ~90% recall retention for ANN search.',
    useCaseZh: '把记忆嵌入压缩到 1/8 大小，召回 ~90%。',
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
    nameZh: '混合检索器',
    layer: 'memvector',
    description: 'Combine tag-match (Jaccard) + vector similarity with tunable α.',
    descriptionZh: '结合标签匹配（Jaccard）+ 向量相似度，可调 α。',
    useCase: 'Get the best of both worlds: combine tag-based metadata search with semantic vector similarity.',
    useCaseZh: '取长补短：结合基于标签的元数据检索与语义向量相似性。',
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
    nameZh: '向量缓存',
    layer: 'memvector',
    description: 'LRU cache for query/embedding key-value lookups with hit-rate tracking.',
    descriptionZh: '按键值查询嵌入的 LRU 缓存 + 命中率追踪。',
    useCase: 'Skip recomputing embeddings for repeated queries. Track cache hit-rate to tune policy.',
    useCaseZh: '跳过重复查询的嵌入重新计算；追踪命中率以调优策略。',
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
    nameZh: '向量迁移器',
    layer: 'memvector',
    description: 'Migrate vectors between embedding dimensions (model upgrades, PCA, project).',
    descriptionZh: '跨嵌入维度的迁移（模型升级、PCA、投影）。',
    useCase: 'Upgrade from a 64-dim model to 128-dim without recomputing every embedding.',
    useCaseZh: '从 64 维模型升级到 128 维，无需重新计算每个嵌入。',
    codePreview: `const m = new VectorMigrator();
m.migrate([[1, 2, 3, 4]], 4, 8, 'random-projection');
m.migrate([[1, 2]], 2, 5, 'pad-truncate');  // → [[1, 2, 0, 0, 0]]`,
    pulled: 2300,
    ratingSum: 14,
    ratingCount: 4,
  },
  {
    id: 'VectorNormalizer',
    name: 'VectorNormalizer',
    nameZh: '向量归一化器',
    layer: 'memvector',
    description: 'L2 / minmax / z-score normalization helpers.',
    descriptionZh: 'L2 + minmax + z-score 归一化辅助方法。',
    useCase: 'Pre-process vectors before cosine similarity (L2) or range-bound features (minmax).',
    useCaseZh: '在余弦相似度（L2）或范围特征（minmax）前预处理向量。',
    codePreview: `VectorNormalizer.normalize([3, 4]);  // [0.6, 0.8]
VectorNormalizer.minMax([1, 2, 3]);  // [0, 0.5, 1]
VectorNormalizer.zScore([1, 2, 3]);  // [-1, 0, +1] (mean 0, std 1)`,
    pulled: 1800,
    ratingSum: 11,
    ratingCount: 3,
  },
  {
    id: 'CosineSim',
    name: 'CosineSim',
    nameZh: '余弦相似度',
    layer: 'memvector',
    description: 'Cosine similarity + L2 distance + topK helper.',
    descriptionZh: '余弦相似度 + L2 距离 + topK 辅助函数。',
    useCase: 'Standalone similarity helper usable without a full index.',
    useCaseZh: '无需完整索引的独立相似度计算 helper。',
    codePreview: `const c = new CosineSim();
c.similarity([1, 0, 0], [1, 0, 0]);  // 1.0
c.distance([1, 0], [4, 3]);             // 5.0
c.topK([1, 0], [[1, 0], [0, 1], [0.5, 0.5]], 2);  // [0, 2]`,
    pulled: 2100,
    ratingSum: 13,
    ratingCount: 3,
  },
  {
    id: 'DistanceMetric',
    name: 'DistanceMetric',
    nameZh: '距离度量',
    layer: 'memvector',
    description: 'Static helpers: cosine, euclidean, dot product.',
    descriptionZh: '静态 helpers：cosine、euclidean、dot product。',
    useCase: 'Inline distance functions without instantiating classes.',
    useCaseZh: '内联距离计算 helper，无需实例化类。',
    codePreview: `DistanceMetric.cosine([1, 0], [0, 1]);   // 0
DistanceMetric.euclidean([1, 0], [4, 3]);  // 5
DistanceMetric.dot([1, 2, 3], [4, 5, 6]);   // 32`,
    pulled: 1500,
    ratingSum: 9,
    ratingCount: 2,
  },
  {
    id: 'MemVectorCoreIndex',
    name: 'MemVectorCoreIndex',
    nameZh: 'MemVector 核心索引',
    layer: 'memvector',
    description: 'Batch index of all 11 MemVector engines (MemVector core batch).',
    descriptionZh: 'MemVector 批次（11 个）引擎的索引。',
    useCase: 'Enumerate the MemVector layer engines for registry listings or dynamic discovery.',
    useCaseZh: '列举 MemVector 层级引擎用于注册表列表或动态发现。',
    codePreview: `new MemVectorCoreIndex().count();  // 11
new MemVectorCoreIndex().has('VectorEmbedder');  // true
new MemVectorCoreIndex().has('MemVectorCoreIndex');  // true (index itself)`,
    pulled: 1200,
    ratingSum: 7,
    ratingCount: 2,
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
