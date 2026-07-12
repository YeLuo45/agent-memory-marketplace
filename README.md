# Agent Memory Marketplace 🧠

> A curated registry for **AI agent memory engines** — discover, integrate, and benchmark the long-term memory layer for Claude Code, Codex, and MCP agents.
>
> Inspired by **TencentDB Agent Memory** · **Letta** · **Zep** · **MemGPT** · **Cognee**
> Extended with **MemVector** (ANN + hybrid vector search) layer
> Localized in **EN · 中文 · 日本語 · 한국어** (V10)

[**🌐 Live Demo**](https://yeluo45.github.io/agent-memory-marketplace/) · [**📦 Engines (38 · 49 tests · 100% pass)**](#engines) · [**🎨 4 themes**](#themes)

![GitHub Pages](https://img.shields.io/badge/live-yeluo45.github.io%2Fagent--memory--marketplace-7c3aed) ![Tests](https://img.shields.io/badge/tests-49%2F49%20pass-16a34a) ![Engines](https://img.shields.io/badge/engines-38-d97706)

---

## Why

GitHub trending (2026-07-10) revealed the **agent memory** track:
- `TencentCloud/TencentDB-Agent-Memory` — fully local long-term memory via Postgres
- `wonderwhy-er/DesktopCommanderMCP` — agent with persistent session state
- `obra/superpowers` — agentic skills framework that needs memory
- `iOfficeAI/OfficeCLI` — Office agents that need document memory

Existing solutions (Letta, Zep, MemGPT, Cognee) are powerful but fragmented. This marketplace fuses **28 distinct memory engines** into one discoverable registry with runnable live demos.

## Engines (38 engines · 49 tests · 100% pass · 2200 LOC + 11 MCP engines)

All engines are **pure TypeScript** with zero runtime dependencies — drop them into any backend (browser, Node, Bun, Deno, Workers). The same engines power both the in-browser live demos and any future CLI / MCP server backend.

### Batch 1/3 — Core (V5216-V5225) — 10 engines (reused from ai-novel-assistant CV)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `EpisodicStore` | episodic | Append-only timestamped ledger with importance scoring |
| `SemanticIndex` | semantic | Tag-based semantic index + findByTag |
| `ProceduralCache` | procedural | Procedure step cache with LRU-like lastUsed tracking |
| `ConsolidationEngine` | consolidation | Similarity-based memory merging (Jaccard) |
| `ForgettingEngine` | consolidation | Ebbinghaus-style exponential decay |
| `MemoryRetriever` | semantic | Score-based retrieval (importance + recency + match) |
| `MemoryEncoder` | procedural | Hash + slice-based content encoder |
| `MemoryDecoder` | procedural | Reverse encoding + delimiter-based batch decode |
| `MemoryHierarchy` | consolidation | Hot/warm/cold tiered classification |
| `MemoryCoreIndex` | integration | Batch 1/3 index |

### Batch 2/3 — Advanced (V5226-V5235) — 10 engines (reused from CV)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `LongTermMemoryManager` | long-term | Permanent K/V store with age tracking |
| `ShortTermMemory` | short-term | Bounded FIFO rolling buffer |
| `WorkingMemory` | working | Attention-focused items with decay |
| `AssociativeMemory` | associative | Graph-based link store + BFS reachability |
| `ContextWindow` | working | Bounded token window with FIFO eviction |
| `AttentionMechanism` | working | Softmax-based attention + topK |
| `MemoryCompression` | compressor | Dedup + truncate with ratio measurement |
| `MemoryCache` | integration | LRU-style key cache with eviction |
| `MemoryProfiler` | integration | Per-operation duration + bytes profiler |
| `MemoryAdvancedIndex` | integration | Batch 2/3 index |

### Batch 3/3 — Integration (V5236-V5245) — 8 engines (reused from CV)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `MemoryDashboard` | integration | Headless panel container |
| `MemoryConfig` | integration | Typed config with getString/getNumber/getBoolean |
| `MemoryAudit` | integration | Per-user audit log |
| `MemoryProfile` | integration | Per-agent items + duration average |
| `MemoryMigration` | integration | Async version-based migrations |
| `MemoryReport` | integration | Markdown + CSV report generator |
| `MemoryBenchmark` | integration | Per-method benchmark tracker |
| `MemoryMasterIndex` | integration | Top-level 28-engine master index |

### Batch 4/4 — MemVector (V5556-V5575) — 11 engines (NEW · 2026-07-11)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `VectorEmbedder` | memvector | Deterministic embedding: text/tags → fixed-dim vector + project |
| `CosineSim` | memvector | Cosine similarity + L2 distance + topK |
| `DistanceMetric` | memvector | Static helpers: cosine / euclidean / dot |
| `HNSWIndex` | memvector | HNSW-style ANN: K-NN inserts + beam query |
| `PQCompressor` | memvector | Product Quantization: 1/8 size compression |
| `HybridSearcher` | memvector | Hybrid tag (Jaccard) + vector similarity with α tuning |
| `VectorCache` | memvector | LRU cache for embeddings with hit-rate tracking |
| `TokenBag` | memvector | TF-IDF vectorizer (alt to hash embedder) |
| `VectorMigrator` | memvector | Migrate vectors between dims (model upgrade, pad/truncate) |
| `VectorNormalizer` | memvector | L2 + minmax + z-score normalization |
| `MemVectorCoreIndex` | memvector | Batch 4/4 index |

### Batch 5/5 — MCP Plugin Standards (V5576-V5595) — 11 engines (NEW · 2026-07-11)

Exposes the 38 memory engines as **Model Context Protocol (MCP) tools** for any MCP-compatible agent (Claude Code, Cursor, etc.) plus an **OpenMemory REST adapter** (Letta-compatible).

| Engine | Layer | Purpose |
|--------|-------|---------|
| `MCPServer` | mcp | JSON-RPC 2.0 stdio server with 20 tools + 8 resources |
| `MCPMasterIndex` | mcp | Index of all MCP-related engines |
| `MCPRequestRouter` | mcp | Routes + logs requests through server |
| `MCPErrorLogger` | mcp | Captures and reports failed requests |
| `MCPHealthCheck` | mcp | Periodic ping for uptime + tool/resource counts |
| `MCPLoadBalancer` | mcp | Round-robin distribution across server instances |
| `OpenMemoryAdapter` | mcp | Letta-compatible REST adapter (POST /memories, GET /memories/:id, POST /search, etc.) |
| `OpenMemoryRouter` | mcp | HTTP-style façade for OpenMemoryAdapter |
| `OpenMemoryComplianceTest` | mcp | Tests 5 spec endpoints against adapter |
| `AdapterHealth` | mcp | Polls adapter health (alive/uptime/records) |
| `AdapterStats` | mcp | Tracks call counts + type breakdowns |

### Batch 8/8 — Memory Streaming (V5626-V5640) — 5 engines (NEW · 2026-07-12)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `EventBus` | streaming | Generic pub/sub for memory events with topic + global listeners |
| `MemoryWatcher` | streaming | Watches a memory store and emits change events on mutations |
| `StreamProducer` | streaming | Bounded event queue with backpressure + drop-on-overflow + consumer fan-out |
| `StreamConsumer` | streaming | Subscribes to a producer and aggregates events by topic + kind |
| `StreamingMasterIndex` | streaming | Batch 8/8 index |

### 4 new MCP tools (Streaming.* — 32 → 36 total)

```
EventBus.subscribe      — Subscribe to a topic
StreamProducer.emit     — Emit a memory event
StreamProducer.flush    — Drain queued events to consumers
StreamConsumer.aggregate — Aggregate consumed events by topic
```

### Batch 9/9 — Memory Playback UI (V5641-V5655) — 7 engines (NEW · 2026-07-12)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `MemorySnapshotter` | playback | Captures a value-based snapshot of a memory store with deep clone |
| `TimelineView` | playback | Flat chronological list of all events with topic/kind/since filters |
| `TreeVisualizer` | playback | Hierarchical view of memory store contents with weight summing |
| `DiffEngine` | playback | Diffs two snapshots by content (added/removed/modified/unchanged) |
| `StepReplay` | playback | Time-travel replay with cursor + jumpTo + interval control |
| `ReplayCoordinator` | playback | Orchestrates snapshotter + timeline + diff + stepReplay sessions |
| `PlaybackMasterIndex` | playback | Batch 9/9 index |

### 5 new MCP tools (Playback.* — 36 → 41 total)

```
MemorySnapshotter.capture  — Capture a snapshot of a memory store
TimelineView.recent       — Get most recent N timeline entries
StepReplay.start          — Start a step replay cursor
StepReplay.next           — Advance to next step
ReplayCoordinator.summary — Get current replay session summary
```

### Batch 10/10 — Federated Memory Plugin (V5656-V5680) — 8 engines (NEW · 2026-07-12)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `FederatedCohort` | federated | Declares a share group (cohort) of agents with privacy level |
| `FederatedMemoryShare` | federated | Shares a memory entry into a cohort with differential-privacy budget |
| `PrivacyBudgetAggregator` | federated | Tracks per-agent privacy budget consumed (epsilon) |
| `SecureChannel` | federated | End-to-end encrypted channel between two agents (HMAC-based) |
| `SecureAggregation` | federated | Sum/avg/count an aggregate without revealing inputs |
| `PrivacyAudit` | federated | Append-only audit log of all sharing operations |
| `PrivacyBudgetEnforcer` | federated | Enforces budget limits + audits every consume/refund |
| `FederatedMemoryIndex` | federated | Batch 10/10 index |

### 5 new MCP tools (Federated.* — 41 → 46 total)

```
FederatedCohort.create          — Create a federated cohort (share group)
FederatedMemoryShare.share      — Share a memory entry into a cohort (privacy-budgeted)
SecureChannel.send              — Send an end-to-end encrypted message between two agents
PrivacyAudit.recent             — Get the most recent privacy audit entries
PrivacyBudgetAggregator.summary — Get the privacy budget summary
```

### Batch 11/11 — Federated Cohorts UI (V5681+) — 6 engines (NEW · 2026-07-12)

| Engine | Layer | Purpose |
|--------|-------|---------|
| `CohortVisualizer` | federated_ui | Hierarchical tree view of cohort + member tree with privacy filtering |
| `MembershipGraph` | federated_ui | Agent ↔ cohort bipartite graph with BFS reachability |
| `PrivacyBudgetChart` | federated_ui | Budget consumption stacks + utilization + SVG bars + warn thresholds |
| `AuditExplorer` | federated_ui | Queryable audit log with timeline buckets + byKind + byAgent filters |
| `CohortReport` | federated_ui | Markdown + CSV report generator for cohorts/budgets/audit |
| `FederatedCohortsUIMasterIndex` | federated_ui | Batch 11/11 index |

### 5 new MCP tools (CohortUI.* — 46 → 51 total)

```
CohortVisualizer.buildTree   — Build a hierarchical cohort tree
MembershipGraph.stats        — Graph statistics (agents/cohorts/edges)
PrivacyBudgetChart.summary   — Privacy budget utilization summary
AuditExplorer.byKind         — Count audit entries grouped by kind
CohortReport.markdown        — Generate markdown cohort report
```

## UI Features

- **🔍 Search** — by name, description, or use case (live filter)
- **📂 10 layer filters** — episodic, semantic, procedural, consolidation, short-term, long-term, working, associative, compressor, integration (color-coded)
- **🎨 4 themes** — light / dark / sepia / nord with localStorage persistence
- **▶️ Live demos** — click "try now" → real engine runs in browser, shows stdout output + duration
- **📊 Stats** — installed count + avg rating per engine
- **📋 Code previews** — every engine card shows a usage snippet

## Themes

| Theme | Use case |
|-------|----------|
| ☀ `light` | Default. Clean, professional. |
| 🌙 `dark` | Low-light work sessions. |
| 📜 `sepia` | Reading-heavy workflows, eye comfort. |
| ❄ `nord` | Calm polar palette, low-saturation focus. |

## Quick start

```bash
# Run unit tests (61+ tests in ~1s)
npx vitest run

# Build production bundle (zero-dep runtime)
npm run build  # → dist/

# Preview production
npx vite preview --port 4173

# CLI tool — interact with engines, MCP server, OpenMemory adapter
node bin/amm.js list
node bin/amm.js info HNSWIndex
node bin/amm.js demo EpisodicStore
node bin/amm.js mcp call tools/list
node bin/amm.js openmem create user1 episodic "hello world" 0.8
node bin/amm.js openmem search python 5
node bin/amm.js streaming list
node bin/amm.js streaming demo
node bin/amm.js streaming produce memory.create create
node bin/amm.js streaming drain
node bin/amm.js playback list
node bin/amm.js playback demo
node bin/amm.js playback snapshot my-snap
node bin/amm.js playback timeline 5
node bin/amm.js federated list
node bin/amm.js federated demo
node bin/amm.js federated share team-a "shared insight"
node bin/amm.js federated audit 5
node bin/amm.js cohortui list
node bin/amm.js cohortui demo
node bin/amm.js cohortui tree
node bin/amm.js cohortui report
node bin/amm.js compat

# Build production bundle (zero-dep runtime, 4 locales)
npm run build  # → dist/

# Preview production — switch locale via header EN / 中文 / 日本語 / 한국어
npx vite preview --port 4173

# MCP server mode (stdio) — wire up to Claude Code MCP config
node bin/amm.js mcp serve
```

## Memory Streaming (V5626+)

Real-time event-driven memory updates — wire up live change notifications on top of the existing memory stores:

```bash
# Demo: bus + watcher + producer + consumer working together
$ node bin/amm.mjs streaming demo
Streaming demo:
  bus received       : 1
  consumer received  : 2
  consumer topics   : 1
  producer metrics   : {"emitted":2,"queued":0,"dropped":0,"consumers":1}
```

| Engine | Use case |
|--------|----------|
| `EventBus` | Cross-store notification fan-out — any component subscribes to a topic and gets called when a memory change fires |
| `MemoryWatcher` | Polling adapter for stores with `.size()` / `.entries()` — detects delta and emits high-priority events on bulk changes |
| `StreamProducer` | Bounded queue (1024 cap, drops oldest) with consumer fan-out — handles burst writes without OOM |
| `StreamConsumer` | Binds a producer + aggregates events by topic/kind for observability dashboards |
| `StreamingMasterIndex` | Batch 8/8 master index — `count()===5`, `list()` returns all 5 |

Wired into MCP via 4 new `Streaming.*` tools (32 → 36 total). Same MCP server, same JSON-RPC stdio — `node bin/amm.js mcp call tools/call '{"name":"StreamProducer.emit","arguments":{"topic":"memory.create","kind":"create"}}'`.

## Memory Playback (V5641+)

Time-travel forensic debugger on top of streaming events. Snapshot a memory store, view changes as a timeline, diff two snapshots, replay events step-by-step:

```bash
$ node bin/amm.mjs playback demo
Playback demo:
  snapshots       : 2
  timeline events : 2
  diff summary    : {"additions":1,"deletions":0,"modifications":1,"unchanged":1,"total":3}
  replay steps    : 2
  first replay    : {"seq":1,"ts":...,"topic":"demo","kind":"create","payload":{"phase":"init"}}
```

| Engine | Use case |
|--------|----------|
| `MemorySnapshotter` | Point-in-time value snapshots with deep clone — useful before/after memory migrations |
| `TimelineView` | Flat list of all events with topic/kind/since filters — quick filtering UI for high-volume logs |
| `TreeVisualizer` | Hierarchical view with weight summing — visualize memory store contents as a tree |
| `DiffEngine` | Content-based diff: added / removed / modified / unchanged — works on snapshots OR event arrays |
| `StepReplay` | Cursor-based step replay with `next()` / `jumpTo(seq)` / `pause()` / `start()` |
| `ReplayCoordinator` | Multi-session coordinator with `start()` / `recordSnapshot()` / `recordEvents(n)` / `recordDiff()` / `end()` |
| `PlaybackMasterIndex` | Batch 9/9 master index — `count()===7`, `list()` returns all 7 |

Wired into MCP via 5 new `Playback.*` tools (36 → 41 total). Example: `node bin/amm.js mcp call tools/call '{"name":"StepReplay.next","arguments":{}}'`.

## Federated Memory (V5656+)

Privacy-preserving cross-agent memory share. Declare cohorts, share memories with differential-privacy budgets, send encrypted messages, audit every operation:

```bash
$ node bin/amm.mjs federated demo
Federated demo:
  cohort members  : 2
  share ok        : true
  audit entries   : 1
  budget stats    : {"agents":1,"totalConsumed":0.5,"totalBudget":10}
  channel id      : agent-1::agent-2
  secure messages : 1
```

| Engine | Use case |
|--------|----------|
| `FederatedCohort` | Declare share groups with privacy level (strict / moderate / open) + member management |
| `FederatedMemoryShare` | Share a memory entry into a cohort; non-members get denied via PrivacyAudit |
| `PrivacyBudgetAggregator` | Per-agent epsilon tracking with consume / refund / topConsumers |
| `SecureChannel` | End-to-end HMAC channel between two agents (idempotent open + per-endpoint receive) |
| `SecureAggregation` | Sum / avg / count aggregates without revealing individual values |
| `PrivacyAudit` | Append-only log with filters (kind / agent / cohort / since) |
| `PrivacyBudgetEnforcer` | Wraps aggregator + audit for policy enforcement |
| `FederatedMemoryIndex` | Batch 10/10 master index — `count()===8`, `list()` returns all 8 |

Wired into MCP via 5 new `Federated.*` tools (41 → 46 total). Example: `node bin/amm.js mcp call tools/call '{"name":"FederatedMemoryShare.share","arguments":{"owner":"agent-1","cohortId":"team-a","content":"shared insight"}}'`.


## Architecture

```
agent-memory-marketplace/
├── .github/workflows/deploy.yml     ← GitHub Actions → GitHub Pages
├── src/
│   ├── engines/                       ← V5216-V5245 + V5556-V5575 (38 engines + tests)
│   ├── multimodal/                    ← V5611-V5625 (15 multimodal engines + tests)
│   ├── mcp/                           ← V5576-V5595 (MCPServer + OpenMemoryAdapter)
│   ├── migration/                     ← V5596-V5610 (15 migration engines + tests)
│   ├── streaming/                     ← V5626-V5640 (5 streaming engines + tests)
│   ├── playback/                      ← V5641-V5655 (7 playback engines + tests)
│   ├── federated/                     ← V5656-V5680 (8 federated engines + tests)
│   ├── data/                          ← memoryEngines + liveDemos + i18n
│   ├── styles/themes.css               ← 4 themes with CSS custom properties
│   ├── runtime.ts                      ← 50-LOC zero-dep React-like runtime
│   ├── App.ts                          ← Main app with search/filter/demos/modals
│   ├── main.ts                         ← Entry point
│   └── env.d.ts
├── bin/
│   ├── amm.ts                         ← CLI source (mcp/openmem/streaming/compat)
│   └── build-cli.mjs                  ← esbuild CLI bundler → bin/amm.mjs
├── public/favicon.svg
├── index.html
├── build.mjs                           ← esbuild web bundler (no vite plugin-react)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vite.config.ts
├── .github/workflows/deploy.yml
└── README.md
```

### Why zero-dep runtime?

The AI-tool environment in `/home/hermes/projects/agent-memory-marketplace` has limited npm registry availability (WSL pnpm cache quirks). To avoid plugin-react installation issues, we use a **50-LOC vanilla-TS reactive runtime** (`runtime.ts`) that delivers React-like component model with zero runtime dependencies. The same UI patterns (vnode tree, attrs, event listeners) work without React or any JSX-transform plugin.

## Test results

```
$ npx vitest run

 ✓ src/engines/AgentMemoryAdvanced.test.ts (12 tests)
 ✓ src/engines/AgentMemoryIntegration.test.ts (14 tests)
 ✓ src/engines/AgentMemoryCore.test.ts (12 tests)
 ✓ src/engines/MemVectorCore.test.ts (11 tests)
 ✓ src/data/i18n.test.ts (12 tests)
 ✓ src/mcp/OpenMemoryAdapter.test.ts (30 tests)
 ✓ src/multimodal/MultimodalCore.test.ts (37 tests)
 ✓ src/migration/MigrationEngine.test.ts (56 tests)
 ✓ src/streaming/StreamingCore.test.ts (35 tests)
 ✓ src/playback/PlaybackCore.test.ts (39 tests)
 ✓ src/federated/FederatedCore.test.ts (45 tests)
 ✓ src/data/i18n.test.ts (34 tests)        ← V10: 4-locale extended
✓ src/federated_ui/FederatedUICore.test.ts (35 tests)  ← V11
 ✓ src/mcp/MCPServer.test.ts (23 tests)

 Test Files  13 passed (13)
      Tests  383 passed (383)
   Duration  ~2s
```

**383/383 tests pass · 100% · ~2s**.

## Relationship to `agent-skills-marketplace`

This project is a **sister** to [`agent-skills-marketplace`](https://yeluo45.github.io/agent-skills-marketplace/) (built 2026-07-11). Together they form a 2-tier agent ecosystem:

```
Skills (what an agent KNOWS)        Memory (what an agent REMEMBERS)
─────────────────────────────────  ─────────────────────────────────
agent-skills-marketplace           agent-memory-marketplace  ← you are here
  11 engines · 11 tests              103 engines · 383 tests
  "Web Search", "Code Review",       "EpisodicStore", "ForgettingEngine",
   "TencentDB Memory"                 "MemoryHierarchy", "EventBus",
                                     "MemorySnapshotter", "SecureChannel",
                                     "CohortVisualizer", ...
                                     MCP: 51 tools
                                     Locale: 4 (en · zh · ja · ko)
```

They share the same React-free theme system, layout patterns, GitHub Actions → Pages pipeline. Skills get installed and produce memory events; memory keeps them consistent across sessions.

## License

MIT
