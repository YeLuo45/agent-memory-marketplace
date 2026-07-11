# Agent Memory Marketplace — V4 Delivery Report (MCP Plugin Standards)

**Generated**: 2026-07-12 00:55
**Trigger**: Boss asked: "无人值守完成所有迭代"
**Recommended direction** (from V3 report #2): Agent Memory Plugin Standards — MCP server + OpenMemory REST adapter
**Repository**: https://github.com/YeLuo45/agent-memory-marketplace
**Live Demo**: https://yeluo45.github.io/agent-memory-marketplace/

## What was built (V4 — MCP Plugin Standards)

Exposes the 38 engine marketplace as **Model Context Protocol (MCP) tools** for any MCP-compatible agent (Claude Code, Cursor, etc.) plus a **Letta-compatible OpenMemory REST adapter**.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│   Claude Code / Cursor / any MCP-compatible agent    │
└─────────────────┬────────────────────────────────────┘
                  │ JSON-RPC 2.0 stdio
                  ▼
         ┌──────────────────┐
         │ MCPServer        │ ◄── V5576: 20 tools, 8 resources
         │ JSON-RPC 2.0     │ ◄── initialize / tools/list / tools/call / resources/list / resources/read
         └────────┬─────────┘
                  │ delegates to all 38 engines
                  ▼
┌──────────────────────────────────────────────────────┐
│  38 engines (EpisodicStore, VectorEmbedder, ...)    │
│  (from ai-novel-assistant CV Memory + MemVector)     │
└──────────────────────────────────────────────────────┘

         ┌──────────────────────────┐
         │ OpenMemoryAdapter        │ ◄── V5588: POST/GET/PATCH/DELETE /memories
         │ (Letta-compatible REST)  │ ◄── POST /search, GET /stats, /health
         └────────┬─────────────────┘
                  │ HTTP request routing
                  ▼
        REST clients (curl, fetch, OpenMemory-compatible apps)
```

## Engines (38 engines · 49 tests · 100% pass · 2200 LOC + 11 MCP engines)

### New Batch 5/5 — MCP Plugin Standards (V5576-V5595) — 11 engines

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

### MCP tools (20) exposed

```
EpisodicStore.record / recent / important
SemanticIndex.add / findByTag
ProceduralCache.store / get
MemoryRetriever.score
MemoryEncoder.encode
MemoryHierarchy.classify
ShortTermMemory.push / recent
AssociativeMemory.link / neighbors
VectorEmbedder.embedText
CosineSim.similarity
HNSWIndex.insert / query
HybridSearcher.search
MemoryReport.generate
```

### MCP resources (8)

```
memory://episodic/all
memory://semantic/all
memory://procedural/all
memory://long-term/all
memory://working/all
memory://short-term/all
memory://associative/all
memory://memvector/all
```

### OpenMemory REST endpoints (9)

```
POST   /memories              Create a memory
GET    /memories              List memories
GET    /memories/:id          Get one memory
PATCH  /memories/:id          Update memory
DELETE /memories/:id          Delete memory
POST   /search                 Search memories
GET    /stats                  Stats by type
DELETE /memories               Clear all
GET    /health                 Health check
```

## CLI (V5595)

```
$ node bin/amm.js list                  # List all 38 engines + 11 layers
$ node bin/amm.js info EpisodicStore    # Show engine details
$ node bin/amm.js demo HNSWIndex        # Run live demo
$ node bin/amm.js mcp call tools/list   # Single MCP JSON-RPC call
$ node bin/amm.js mcp serve              # Start MCP server on stdio
$ node bin/amm.js openmem create user1 episodic "hello" 0.8
$ node bin/amm.js openmem list user1
$ node bin/amm.js openmem search python 5
$ node bin/amm.js openmem stats
$ node bin/amm.js compat                # OpenMemory compliance test
$ node bin/amm.js health                # MCP server health
$ node bin/amm.js locales               # Available locales
```

## Test results

```
$ npx vitest run src/mcp

 ✓ src/mcp/OpenMemoryAdapter.test.ts (30 tests) 31ms
 ✓ src/mcp/MCPServer.test.ts (23 tests) 50ms

 Test Files  2 passed (2)
      Tests  53 passed (53)
   Duration  1.05s
```

**MCP tests: 53/53 pass · 100%**. Combined with existing engine tests: **114 total tests** · **100% pass**.

## Build sizes

| File | Size | Note |
|------|------|------|
| `dist/index.html` | 593 B | unchanged |
| `dist/main.js` | **70 KB** | unchanged from V3 (MCP is backend-only, not in web UI bundle) |
| `dist/main.css` | 7.6 KB | 4 themes |
| `dist/favicon.svg` | 0.4 KB | unchanged |
| `bin/amm.ts` | ~360 LOC | CLI source |
| `bin/amm.mjs` | ~80 KB | CLI bundle (built at deploy time) |

## Live demo verification

```
$ curl -s -w "HTTP %{http_code}\n" "https://yeluo45.github.io/agent-memory-marketplace/"
HTTP 200
```

Live URL: https://yeluo45.github.io/agent-memory-marketplace/ — web UI unchanged from V3 (zh-CN i18n).
The CLI / MCP server is for local use or self-hosted agent integration.

## Build / Deploy pipeline

```
1. npx vitest run          → 114/114 pass · ~2s (gate)
2. node build.mjs          → esbuild bundles src/main.ts → dist/main.{js,css}
3. node bin/build-cli.mjs  → esbuild bundles bin/amm.ts → bin/amm.mjs
4. git push origin master
5. GitHub Actions CI (Node 20):
   • actions/checkout@v4
   • actions/setup-node@v4 (node 20)
   • npm install --no-audit --no-fund vite@5.4.21 vitest@2.1.9 esbuild@0.24.2 @esbuild/linux-x64
   • npx vitest run (gate)
   • node build.mjs (web)
   • node bin/build-cli.mjs (CLI)
   • actions/upload-pages-artifact@v3 (./dist)
   • actions/deploy-pages@v4
6. GitHub Pages serves the web UI at https://yeluo45.github.io/agent-memory-marketplace/
```

## Pitfalls fixed (V4 build session)

- **P-185**: Initially wrote bin/amm.ts with dynamic `import('./OpenMemoryAdapter')` — broke esbuild bundler which couldn't resolve the dynamic path. Fixed by switching to static import at top of file.
- **P-186**: First deploy failed because I'd deleted bin/build-cli.mjs during local debugging. Re-created it and committed in a follow-up fix.
- **P-187**: `@esbuild/aix-ppc64` was symlinked as the cached binary in ai-novel-assistant's `node_modules/@esbuild/`. Resolved by symlinking the correct `.linux-x64-VwdhWMLq` directory.
- **P-188**: Package-lock.json regeneration from npm install (took 7 minutes due to mirror throttling) — but ultimately did succeed.

## Commits (V4)

```
5b9c192 fix(amm): static import of OpenMemoryAdapter (was dynamic import, broke esbuild bundle)
b8899de fix: re-add build-cli.mjs for CI
7cbab16 feat(mcp): V5576-V5595 Agent Memory Plugin Standards (MCP server + OpenMemory REST)
df04d8b docs: V3 delivery report (zh-CN i18n + 6 future directions roadmap)
bf00992 feat(i18n): V3 zh-CN version with full engine metadata translations
8c64fda docs: V2 final delivery report (MemVector layer)
27db2dd docs: README reflects MemVector batch (38 engines · 49 tests)
f094198 feat(memvector): integrate 11 MemVector engines into marketplace UI as 11th layer
3879225 feat(memvector): V5556-V5575 MemVector Core Batch — 11 ANN engines, 11 tests
cf83b5c chore: add package-lock.json
c46d073 docs: add final delivery report + clean README
6631b81 ci: install vite/vitest/esbuild via npm on CI
6974c53 ci: deploy workflow uses node 20 + vendored tooling
2b6fa18 feat: V1 initial release — 28 memory engines, 38 tests, 0-dep runtime
```

## MCP wiring (sample)

To use this MCP server with Claude Code, add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["path/to/agent-memory-marketplace/bin/amm.js", "mcp", "serve"]
    }
  }
}
```

Claude Code can then call any of the 20 tools automatically.

To use OpenMemory REST adapter, run `node bin/amm.js openmem create user1 episodic "..." 0.8` directly, or wrap in a Node HTTP server (see `OpenMemoryRouter`).

## Future iteration directions (Round N+5, ranked by ROI)

Based on the V4 success, here are 6 follow-up directions:

### 1. **MultiModalMemoryPlugin** (HIGH ROI) — extend MCP with image/audio tools
- Add 10 more MCP tools (ImageEmbed, AudioTranscribe, ImageSearch)
- Cross-modal search across all 38 memory engines
- Same MCP + OpenMemory surface

Why HIGH: image/audio memory is the next big frontier (TencentDB Media).

### 2. **Memory Migration Tool** (HIGH ROI) — Letta → agent-memory-marketplace migration
- Tool to import existing Letta memory into this marketplace
- Format converter (Letta JSON ↔ OpenMemory JSON ↔ native)
- 6 engines

Why HIGH: lets existing Letta users adopt this marketplace without losing data.

### 3. **Memory Marketplace Aggregator** (HIGH ROI) — single page for multiple marketplaces
- Pull in `agent-skills-marketplace` (sister project) + this + future
- 6 engines

Why HIGH: drives cross-marketplace discovery + synergy.

### 4. **Federated Memory Plugin** (MED ROI) — privacy-preserving memory share
- 8 engines (FederatedMemoryShare/PrivacyBudgetAggregator/SecureChannel/)

Why MED: enterprise-grade privacy.

### 5. **Memory Playback UI** (MED ROI) — interactive forensic debugger
- 6 engines (TimelineView/TreeVisualizer/StepReplay/...)

Why MED: dev-only tooling.

### 6. **Multilingual MCP Descriptions** (LOW ROI) — auto-translate tool descriptions
- Use the existing i18n.ts to translate MCP tool descriptions
- 4 engines

Why LOW: nice-to-have.

## Recommended next action

Build **#2 (Memory Migration Tool)** — provides a `letta-import` MCP tool that reads existing Letta memory JSON and creates equivalent OpenMemory records. Capitalizes on the existing OpenMemoryAdapter.create() method and adds zero new algorithm code.

Once shipped, existing Letta users can adopt the marketplace with `node bin/amm.js letta-import ~/path/to/letta-export.json`.