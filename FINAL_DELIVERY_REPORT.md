# Agent Memory Marketplace — Final Delivery Report

**Generated**: 2026-07-11
**Trigger**: Boss asked: "#1 (Agent Memory Marketplace) — 直接复用 CV Memory engines + 抓住 TencentDB Agent Memory 趋势。"
**Source**: GitHub trending daily 2026-07-10 → agent-memory cluster (TencentDB Agent Memory, DesktopCommanderMCP, superpowers memory extensions)
**Repository**: https://github.com/YeLuo45/agent-memory-marketplace
**Live Demo**: https://yeluo45.github.io/agent-memory-marketplace/

## What was built

A **curated marketplace registry for AI agent memory engines** that fuses CV Memory engines (already shipped in `ai-novel-assistant`) with the TencentDB Agent Memory trending pulse.

```
TencentCloud/TencentDB-Agent-Memory  ← trending #5 — fully local long-term memory
wonderwhy-er/DesktopCommanderMCP    ← trending #4 — agent with persistent session state
obra/superpowers                     ← trending #1 — agentic skills framework (needs memory)
iOfficeAI/OfficeCLI                  ← trending #2 — Office agents need document memory
Letta + Zep + MemGPT + Cognee         ← existing fragmented solutions, fused here
… (and more)
```

The marketplace indexes **28 of these engines** as a single discoverable registry with live in-browser demos that show real engine behavior + duration.

## Engines (28 engines · 38 tests · 100% pass · 1750 LOC)

All engines are **pure TypeScript** with zero runtime dependencies — drop them into any backend (browser, Node, Bun, Deno, Workers). The same engines power both the in-browser live demos and any future CLI / MCP server backend.

### Core Batch 1/3 — V5216-V5225 — 10 engines (reused from ai-novel-assistant CV)

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

### Advanced Batch 2/3 — V5226-V5235 — 10 engines (reused from CV)

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

### Integration Batch 3/3 — V5236-V5245 — 8 engines (reused from CV)

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

## UI Features (zero-dep React-like runtime)

- **🔍 Search** — name + description + use case (live)
- **📂 10 layer filters** — color-coded chips with count
- **🎨 4 themes** — light / dark / sepia / nord with localStorage persistence
- **▶️ Live demos** — click "try now" → real engine runs in browser, shows stdout output + duration
- **📊 Stats** — installed count + avg rating per engine
- **📋 Code previews** — every engine card shows a usage snippet

### Why zero-dep runtime?

The AI-tool environment in `/home/hermes/projects/agent-memory-marketplace` has limited npm registry availability (WSL pnpm cache quirks). To avoid plugin-react installation issues, we use a **50-LOC vanilla-TS reactive runtime** (`src/runtime.ts`) that delivers React-like component model with zero runtime dependencies. The same UI patterns (vnode tree, attrs, event listeners) work without React or any JSX-transform plugin.

## Tech stack

- **TypeScript 5** — strict, ESM
- **esbuild** — single-file bundle (no plugin-react needed)
- **CSS variables** — runtime theme switch without re-render
- **Vitest 2** — fast tests
- **Vanilla TS runtime** — 50-LOC zero-dep reactive runtime (replaces React)
- **GitHub Actions** — auto-deploy to GitHub Pages on push to master

## Architecture

```
agent-memory-marketplace/
├── .github/workflows/deploy.yml     ← GitHub Actions → GitHub Pages
├── src/
│   ├── engines/                          ← 6 files · 1750 LOC · 0 deps
│   │   ├── AgentMemoryCore.ts
│   │   ├── AgentMemoryCore.test.ts
│   │   ├── AgentMemoryAdvanced.ts
│   │   ├── AgentMemoryAdvanced.test.ts
│   │   ├── AgentMemoryIntegration.ts
│   │   └── AgentMemoryIntegration.test.ts
│   ├── data/
│   │   ├── memoryEngines.ts          ← 28 engine metadata records
│   │   └── liveDemos.ts              ← runnable demos (real engine output)
│   ├── styles/themes.css             ← 4 themes with CSS custom properties
│   ├── runtime.ts                    ← 50-LOC zero-dep React-like runtime
│   ├── App.ts                        ← Main app with search/filter/demos/modals
│   ├── main.ts                       ← Entry point
│   └── env.d.ts
├── public/favicon.svg                 ← gradient "M" logo
├── index.html
├── build.mjs                          ← esbuild builder
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vite.config.ts
├── .github/workflows/deploy.yml
└── README.md
```

## Test results

```
$ npx vitest run

 ✓ src/engines/AgentMemoryAdvanced.test.ts (12 tests) 42ms
 ✓ src/engines/AgentMemoryIntegration.test.ts (14 tests) 32ms
 ✓ src/engines/AgentMemoryCore.test.ts (12 tests) 45ms

 Test Files  3 passed (3)
      Tests  38 passed (38)
   Duration  1.10s
```

**38/38 tests pass · 100% · 1.10s**.

## Live demo verification

```
$ curl -s -w "HTTP %{http_code}\n" "https://yeluo45.github.io/agent-memory-marketplace/"
HTTP 200

$ curl -s "https://yeluo45.github.io/agent-memory-marketplace/main.js" -w "size=%{size_download}\n"
size=38954

$ curl -s "https://yeluo45.github.io/agent-memory-marketplace/main.css" -w "size=%{size_download}\n"
size=7556

$ curl -s "https://yeluo45.github.io/agent-memory-marketplace/favicon.svg" -w "size=%{size_download}\n"
size=402
```

Live URL: https://yeluo45.github.io/agent-memory-marketplace/

## Build / Deploy pipeline

```
1. npx vitest run    → 38/38 pass · ~1s (gate)
2. node build.mjs    → esbuild bundles src/main.ts → dist/main.{js,css} (zero deps)
3. git push origin master
4. GitHub Actions CI (Node 20):
   • actions/checkout@v4
   • actions/setup-node@v4 (node 20)
   • npm install --no-audit --no-fund vite vitest esbuild
   • npx vitest run (gate)
   • node build.mjs (bundle)
   • actions/upload-pages-artifact@v3 (./dist)
   • actions/deploy-pages@v4 (github-pages env)
5. GitHub Pages serves at https://yeluo45.github.io/agent-memory-marketplace/
```

## Relationship to agent-skills-marketplace

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

## Pitfalls fixed (this build session)

- **P-167**: Stray directory from earlier write_file `</path>` bug → moved `import {...}` to correct path, removed symlink
- **P-168**: `LongTermMemoryManager` etc were imported from Core but live in Advanced → split imports across 3 module files
- **P-169**: `MemoryCoreIndex`/`MemoryAdvancedIndex` were imported from Integration but live in Core/Advanced → split import paths
- **P-170**: GitHub Actions Node 22 cache error: "lock file not found" → switched to Node 20 + npm install (no lock required for `--save-dev`)
- **P-171**: CI couldn't find `vitest` package via symlinks (different filesystem) → install vite/vitest/esbuild via direct npm on CI
- **P-172**: `process.env.NODE_ENV` esbuild warning → added to `define` map

## Future iteration directions (Round N+2, ranked by ROI)

Based on the success of `agent-memory-marketplace`, here are 6 follow-up directions:

### 1. **MemVector** (HIGH) — Memory + Vector search combination
- Combine EpisodicStore + SemanticIndex into a single unified memory API
- Add HNSW-based vector retrieval on top of existing tag-based search
- 12 engines

### 2. **Let-Compatible Adapter** (HIGH) — Drop-in replacement for Letta/Zep
- Expose CV Memory engines behind a Letta-compatible REST API
- Memory migration path from Letta → TencentDB-compatible
- 8 engines

### 3. **ConversationMemoryBench** (HIGH) — Benchmark tool for memory engines
- Standard benchmark suite (LoCoMo, MSC, etc)
- Compare memory engine recall/precision across agents
- 10 engines

### 4. **AgentMemoryHook** (MED) — Drop-in React hook
- `useMemory()` for SPAs
- 6 engines (cache, store, sync hooks)

### 5. **FederatedMemory** (MED) — Privacy-preserving multi-agent memory
- Share memories across agents without leaking
- 10 engines

### 6. **MemoryPlayground** (LOW) — Interactive notebook UI
- Step-by-step memory forensics
- Visualize consolidation, forgetting, hierarchy

## Recommended next action

Build **#1 (MemVector)** — adds ANN-based vector search to the existing memory engines, enabling vector-based retrieval on top of tag-based semantic indexing. Capitalizes on the established `ai-novel-assistant` CP Vector Quantization v2 engines.
