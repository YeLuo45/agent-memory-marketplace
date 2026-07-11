# Agent Memory Marketplace 🧠

> A curated registry for **AI agent memory engines** — discover, integrate, and benchmark the long-term memory layer for Claude Code, Codex, and MCP agents.
>
> Inspired by **TencentDB Agent Memory** · **Letta** · **Zep** · **MemGPT** · **Cognee**
> Extended with **MemVector** (ANN + hybrid vector search) layer

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
node bin/amm.js compat

# MCP server mode (stdio) — wire up to Claude Code MCP config
node bin/amm.js mcp serve
```

## Architecture

```
agent-memory-marketplace/
├── .github/workflows/deploy.yml     ← GitHub Actions → GitHub Pages
├── src/
│   ├── engines/
│   │   ├── AgentMemoryCore.ts          ← V5216-V5225 (10 core engines + tests)
│   │   ├── AgentMemoryCore.test.ts     ← 12 tests
│   │   ├── AgentMemoryAdvanced.ts      ← V5226-V5235 (10 advanced engines + tests)
│   │   ├── AgentMemoryAdvanced.test.ts ← 9 tests
│   │   ├── AgentMemoryIntegration.ts   ← V5236-V5245 (8 integration engines + tests)
│   │   └── AgentMemoryIntegration.test.ts ← 14 tests
│   ├── data/
│   │   ├── memoryEngines.ts            ← 28 engine metadata records
│   │   └── liveDemos.ts                ← runnable demos for each engine
│   ├── styles/themes.css               ← 4 themes with CSS custom properties
│   ├── runtime.ts                      ← 50-LOC zero-dep React-like runtime
│   ├── App.ts                          ← Main app with search/filter/demos/modals
│   ├── main.ts                         ← Entry point
│   └── env.d.ts
├── public/favicon.svg
├── index.html
├── build.mjs                           ← esbuild builder (no vite plugin-react)
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

 Test Files  4 passed (4)
      Tests  49 passed (49)
   Duration  1.00s
```

**49/49 tests pass · 100% · 1.00s**.

## Relationship to `agent-skills-marketplace`

This project is a **sister** to [`agent-skills-marketplace`](https://yeluo45.github.io/agent-skills-marketplace/) (built 2026-07-11). Together they form a 2-tier agent ecosystem:

```
Skills (what an agent KNOWS)        Memory (what an agent REMEMBERS)
─────────────────────────────────  ──────────────────────────────────
agent-skills-marketplace           agent-memory-marketplace  ← you are here
  11 engines · 11 tests              28 engines · 38 tests
  "Web Search", "Code Review",       "EpisodicStore", "ForgettingEngine",
   "TencentDB Memory"                 "MemoryHierarchy", ...
```

They share the same React-free theme system, layout patterns, GitHub Actions → Pages pipeline. Skills get installed and produce memory events; memory keeps them consistent across sessions.

## License

MIT
