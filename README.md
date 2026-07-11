# Agent Memory Marketplace 🧠

> A curated registry for **AI agent memory engines** — discover, integrate, and benchmark the long-term memory layer for Claude Code, Codex, and MCP agents.
>
> Inspired by **TencentDB Agent Memory** · **Letta** · **Zep** · **MemGPT** · **Cognee**

[**🌐 Live Demo**](https://yeluo45.github.io/agent-memory-marketplace/) · [**📦 Engines (28 · 38 tests · 100% pass)**](#engines) · [**🎨 4 themes**](#themes)

![GitHub Pages](https://img.shields.io/badge/live-yeluo45.github.io%2Fagent--memory--marketplace-7c3aed) ![Tests](https://img.shields.io/badge/tests-38%2F38%20pass-16a34a) ![Engines](https://img.shields.io/badge/engines-28-d97706)

---

## Why

GitHub trending (2026-07-10) revealed the **agent memory** track:
- `TencentCloud/TencentDB-Agent-Memory` — fully local long-term memory via Postgres
- `wonderwhy-er/DesktopCommanderMCP` — agent with persistent session state
- `obra/superpowers` — agentic skills framework that needs memory
- `iOfficeAI/OfficeCLI` — Office agents that need document memory

Existing solutions (Letta, Zep, MemGPT, Cognee) are powerful but fragmented. This marketplace fuses **28 distinct memory engines** into one discoverable registry with runnable live demos.

## Engines (28 · 38 tests · 100% pass · 1750 LOC)

All engines are **pure TypeScript** with zero runtime dependencies — drop them into any backend. The same engines power both the in-browser live demos and any future CLI / MCP server.

### Batch 1/3 — Core (V5216-V5225) — 10 engines

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

### Batch 2/3 — Advanced (V5226-V5235) — 10 engines

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

### Batch 3/3 — Integration (V5236-V5245) — 8 engines

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
# Run unit tests (38/38 in ~1s)
npx vitest run

# Build production bundle (zero-dep runtime)
npm run build  # → dist/

# Preview production
npx vite preview --port 4174
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

 ✓ src/engines/AgentMemoryAdvanced.test.ts (12 tests) 42ms
 ✓ src/engines/AgentMemoryIntegration.test.ts (14 tests) 32ms
 ✓ src/engines/AgentMemoryCore.test.ts (12 tests) 45ms

 Test Files  3 passed (3)
      Tests  38 passed (38)
   Duration  1.10s
```

**38/38 tests pass · 100% · 1.10s** (`--coverage` not available; embuild doesn't ship a coverage provider in this env).

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
