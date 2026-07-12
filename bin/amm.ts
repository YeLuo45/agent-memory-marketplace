#!/usr/bin/env node
// V5595: CLI runner for agent-memory-marketplace
// Lets you interact with the marketplace engines + MCP server + OpenMemory adapter
// without needing a browser or external MCP client.
//
// Usage:
//   node bin/amm.js <command> [args]
//
// Commands:
//   list                                List all engines + layers
//   info <engine-id>                    Show engine details (name, description, code)
//   demo <engine-id>                    Run live demo for engine
//   mcp serve                           Start MCP server on stdio (for MCP clients)
//   mcp call <method> [args-json]        Single MCP JSON-RPC call
//   openmem create <agent> <type> <content> [importance]   Create memory
//   openmem list [agent] [type]         List memories
//   openmem get <id>                    Get one memory
//   openmem search <query> [limit]      Search memories
//   openmem stats                       Stats by type
//   openmem health                      Health check
//   streaming list                      List streaming engines
//   streaming demo                      Run streaming demo (bus → watcher → producer → consumer)
//   streaming produce <topic> <kind>    Emit one event
//   streaming drain                     Drain a producer, print events
//   playback list                       List playback engines
//   playback demo                       Run playback demo (snapshot → timeline → diff → replay)
//   playback snapshot <label>           Capture a snapshot
//   playback timeline <n>               Show last N timeline entries
//   federated list                      List federated engines
//   federated demo                      Run a federated demo (cohort → share → secure → audit)
//   federated share <cohort> <content>  Share a message into a cohort
//   federated audit <n>                 Show recent privacy audit entries
//   cohortui list                       List federated UI engines
//   cohortui demo                       Run federated UI demo (tree → graph → chart → audit → report)
//   cohortui tree                       Show cohort tree visualization
//   cohortui report                     Generate a markdown cohort report
//   compat                              Run OpenMemory compliance test
//   health                              MCP server health check
//   locales                             Show available locales

import { runDemo } from '../src/data/liveDemos';
import { MEMORY_ENGINES, LAYERS } from '../src/data/memoryEngines';
import { MCPServer } from '../src/mcp/MCPServer';
import { OpenMemoryAdapter, OpenMemoryComplianceTest } from '../src/mcp/OpenMemoryAdapter';
import { EventBus, MemoryWatcher, StreamProducer, StreamConsumer, StreamingMasterIndex } from '../src/streaming/StreamingCore';
import { MemorySnapshotter, TimelineView, TreeVisualizer, DiffEngine, StepReplay, ReplayCoordinator, PlaybackMasterIndex } from '../src/playback/PlaybackCore';
import { FederatedCohort, FederatedMemoryShare, PrivacyBudgetAggregator, SecureChannel, SecureAggregation, PrivacyAudit, PrivacyBudgetEnforcer, FederatedMemoryIndex } from '../src/federated/FederatedCore';
import { CohortVisualizer, MembershipGraph, PrivacyBudgetChart, AuditExplorer, CohortReport, FederatedCohortsUIMasterIndex } from '../src/federated_ui/FederatedUICore';

const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const colorize = (s: string, c: string): string => process.stdout.isTTY ? `${c}${s}${RESET}` : s;

const main = (): void => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }

  const [cmd, ...rest] = args;
  try {
    switch (cmd) {
      case 'list':
        cmdList();
        break;
      case 'info':
        cmdInfo(rest);
        break;
      case 'demo':
        cmdDemo(rest);
        break;
      case 'mcp':
        cmdMcp(rest);
        break;
      case 'openmem':
        cmdOpenMem(rest);
        break;
      case 'compat':
        cmdCompat();
        break;
      case 'streaming':
        cmdStreaming(rest);
        break;
      case 'playback':
        cmdPlayback(rest);
        break;
      case 'federated':
        cmdFederated(rest);
        break;
      case 'cohortui':
        cmdCohortUI(rest);
        break;
      case 'health':
        cmdHealth();
        break;
      case 'locales':
        cmdLocales();
        break;
      case 'help':
      case '--help':
      case '-h':
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

const printHelp = (): void => {
  console.log(`${colorize('agent-memory-marketplace CLI', BOLD + CYAN)}

${colorize('Commands:', BOLD)}
  ${colorize('list', GREEN)}                                List all engines + layers
  ${colorize('info', GREEN)} <engine-id>                    Show engine details
  ${colorize('demo', GREEN)} <engine-id>                    Run live demo
  ${colorize('mcp serve', GREEN)}                          Start MCP server on stdio
  ${colorize('mcp call', GREEN)} <method> [args-json]       Single MCP JSON-RPC call
  ${colorize('openmem create', GREEN)} <agent> <type> <content> [importance]
  ${colorize('openmem list', GREEN)} [agent] [type]
  ${colorize('openmem get', GREEN)} <id>
  ${colorize('openmem search', GREEN)} <query> [limit]
  ${colorize('openmem stats', GREEN)}                      Stats by type
  ${colorize('openmem health', GREEN)}                     Adapter health check
  ${colorize('streaming list', GREEN)}                      List streaming engines
  ${colorize('streaming demo', GREEN)}                     Run streaming demo
  ${colorize('streaming produce', GREEN)} <topic> <kind>    Emit one event
  ${colorize('streaming drain', GREEN)}                     Drain queued events
  ${colorize('playback list', GREEN)}                       List playback engines
  ${colorize('playback demo', GREEN)}                       Run playback demo
  ${colorize('playback snapshot', GREEN)} <label>           Capture a snapshot
  ${colorize('playback timeline', GREEN)} <n>              Show last N timeline entries
  ${colorize('federated list', GREEN)}                      List federated engines
  ${colorize('federated demo', GREEN)}                      Run a federated demo
  ${colorize('federated share', GREEN)} <cohort> <content>  Share a memory into a cohort
  ${colorize('federated audit', GREEN)} <n>                Show recent privacy audit entries
  ${colorize('cohortui list', GREEN)}                       List federated UI engines
  ${colorize('cohortui demo', GREEN)}                      Run federated UI demo
  ${colorize('cohortui tree', GREEN)}                      Show cohort tree visualization
  ${colorize('cohortui report', GREEN)}                    Generate a markdown cohort report
  ${colorize('compat', GREEN)}                              OpenMemory compliance test
  ${colorize('health', GREEN)}                              MCP server health
  ${colorize('locales', GREEN)}                             Available locales

${colorize('Examples:', BOLD)}
  ${colorize('$ amm.js list', DIM)}
  ${colorize('$ amm.js info EpisodicStore', DIM)}
  ${colorize('$ amm.js demo HNSWIndex', DIM)}
  ${colorize('$ amm.js mcp call tools/list', DIM)}
  ${colorize('$ amm.js openmem create user1 episodic "user said hi" 0.8', DIM)}
  ${colorize('$ amm.js openmem search python 5', DIM)}
  ${colorize('$ amm.js streaming demo', DIM)}
  ${colorize('$ amm.js streaming produce memory.create create', DIM)}
  ${colorize('$ amm.js streaming drain', DIM)}
  ${colorize('$ amm.js playback demo', DIM)}
  ${colorize('$ amm.js playback snapshot my-snap', DIM)}
  ${colorize('$ amm.js playback timeline 5', DIM)}
  ${colorize('$ amm.js federated demo', DIM)}
  ${colorize('$ amm.js federated share team-a "shared insight"', DIM)}
  ${colorize('$ amm.js federated audit 5', DIM)}
  ${colorize('$ amm.js cohortui demo', DIM)}
  ${colorize('$ amm.js cohortui tree', DIM)}
  ${colorize('$ amm.js cohortui report', DIM)}
`);
};

const cmdList = (): void => {
  console.log(colorize(`\nLayers (${LAYERS.length}):`, BOLD));
  for (const l of LAYERS) {
    console.log(`  ${colorize(l.id.padEnd(13), CYAN)} ${l.label.padEnd(14)} ${colorize('• ' + l.desc, DIM)}`);
  }
  console.log(colorize(`\nEngines (${MEMORY_ENGINES.length}):`, BOLD));
  for (const e of MEMORY_ENGINES) {
    console.log(`  ${colorize(e.id.padEnd(28), CYAN)} ${colorize('★ ' + (e.ratingCount > 0 ? (e.ratingSum / e.ratingCount).toFixed(1) : '—'), YELLOW)} ${colorize('↓ ' + e.pulled, DIM)}  ${e.nameZh ?? ''}`);
  }
};

const cmdInfo = (args: string[]): void => {
  const id = args[0];
  if (!id) {
    console.error(colorize('Usage: info <engine-id>', RED));
    process.exit(1);
  }
  const e = MEMORY_ENGINES.find(x => x.id === id);
  if (!e) {
    console.error(colorize(`Engine not found: ${id}`, RED));
    process.exit(1);
  }
  console.log(colorize(`\n${e.name}`, BOLD + CYAN));
  if (e.nameZh) console.log(colorize(e.nameZh, DIM));
  console.log(`Layer: ${colorize(e.layer, YELLOW)}`);
  console.log(`\n${e.description}`);
  if (e.descriptionZh) console.log(colorize(e.descriptionZh, DIM));
  console.log(`\n${colorize('Use case:', BOLD)}\n  ${e.useCase}`);
  if (e.useCaseZh) console.log(colorize(`  ${e.useCaseZh}`, DIM));
  console.log(`\n${colorize('Code:', BOLD)}\n${colorize(e.codePreview, DIM)}`);
  console.log(`\nInstalls: ${e.pulled}  ·  Rating: ${e.ratingSum}/${e.ratingCount}`);
};

const cmdDemo = (args: string[]): void => {
  const id = args[0];
  if (!id) {
    console.error(colorize('Usage: demo <engine-id>', RED));
    process.exit(1);
  }
  const r = runDemo(id);
  console.log(colorize(`\n${r.title}`, BOLD));
  console.log(colorize(`Steps (${r.steps.length} · ${r.durationMs.toFixed(2)}ms):`, DIM));
  r.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  console.log(colorize('\nOutput:', BOLD));
  console.log(r.output);
};

const cmdMcp = (args: string[]): void => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize('Usage: mcp <serve|call>', RED));
    process.exit(1);
  }
  const server = new MCPServer();

  if (sub === 'serve') {
    // Stdio mode — read lines from stdin, dispatch, write to stdout
    console.error(colorize('[mcp] serving on stdio (Ctrl+C to stop)', DIM));
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const req = JSON.parse(line);
          const resp = server.handle(req);
          process.stdout.write(JSON.stringify(resp) + '\n');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 0, error: { code: -32700, message: `Parse error: ${message}` } }) + '\n');
        }
      }
    });
    process.stdin.on('end', () => process.exit(0));
    return;
  }

  if (sub === 'call') {
    const method = args[1];
    const argsJson = args[2] ?? '{}';
    if (!method) {
      console.error(colorize('Usage: mcp call <method> [args-json]', RED));
      process.exit(1);
    }
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(argsJson);
    } catch (err) {
      console.error(colorize(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`, RED));
      process.exit(1);
    }
    const req = { jsonrpc: '2.0' as const, id: 1, method, params: parsedArgs };
    const resp = server.handle(req);
    console.log(JSON.stringify(resp, null, 2));
    return;
  }

  console.error(colorize(`Unknown mcp subcommand: ${sub}`, RED));
  process.exit(1);
};

const cmdOpenMem = (args: string[]): void => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize('Usage: openmem <create|list|get|search|stats|health>', RED));
    process.exit(1);
  }
  const adapter = new OpenMemoryAdapter();

  switch (sub) {
    case 'create': {
      const [, agent, type, content, importance] = args;
      if (!agent || !type || !content) {
        console.error(colorize('Usage: openmem create <agent> <type> <content> [importance]', RED));
        process.exit(1);
      }
      const r = adapter.create({ agent_id: agent, type: type as 'episodic', content, importance: importance ? Number(importance) : 0.5 });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case 'list': {
      const [, agent, type] = args;
      const r = adapter.list({ agent_id: agent, type: type as 'episodic' });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case 'get': {
      const id = args[1];
      if (!id) {
        console.error(colorize('Usage: openmem get <id>', RED));
        process.exit(1);
      }
      const r = adapter.get(id);
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case 'search': {
      const [, query, limitStr] = args;
      if (!query) {
        console.error(colorize('Usage: openmem search <query> [limit]', RED));
        process.exit(1);
      }
      const r = adapter.search({ query, limit: limitStr ? Number(limitStr) : 5 });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case 'stats': {
      const r = adapter.stats();
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case 'health': {
      console.log(JSON.stringify({ ok: true, data: { records: adapter.recordCount(), uptime: 0 } }, null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown openmem subcommand: ${sub}`, RED));
      process.exit(1);
  }
};

const cmdCompat = (): void => {
  const t = new OpenMemoryComplianceTest();
  const r = t.runAll();
  console.log(colorize(`\nOpenMemory compliance: ${r.pass}/${r.results.length} pass`, BOLD + (r.fail === 0 ? GREEN : RED)));
  for (const x of r.results) {
    console.log(`  ${colorize(x.ok ? '✓' : '✗', x.ok ? GREEN : RED)} ${x.name}`);
  }
};

const cmdHealth = (): void => {
  const server = new MCPServer();
  console.log(JSON.stringify(server.health(), null, 2));
};

const cmdLocales = (): void => {
  console.log(colorize('\nAvailable locales:', BOLD));
  console.log('  • en  English');
  console.log('  • zh  简体中文');
};

const cmdStreaming = (args: string[]): void => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize('Usage: streaming <list|demo|produce|drain>', RED));
    process.exit(1);
  }
  const idx = new StreamingMasterIndex();
  switch (sub) {
    case 'list': {
      console.log(colorize(`\nStreaming engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(28), CYAN)} ${colorize('• ' + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case 'demo': {
      const bus = new EventBus();
      const producer = new StreamProducer();
      const consumer = new StreamConsumer();
      let busReceived = 0;
      bus.subscribe('demo', () => (busReceived += 1));
      consumer.bind(producer);
      producer.emit('demo', 'create', { agentId: 'a1', source: 'cli' });
      producer.emit('demo', 'update', { agentId: 'a1', source: 'cli' });
      bus.publish({ topic: 'demo', kind: 'create', ts: Date.now(), payload: { x: 1 } });
      producer.flush();
      console.log(colorize('\nStreaming demo:', BOLD));
      console.log(`  bus received       : ${busReceived}`);
      console.log(`  consumer received  : ${consumer.summary().received}`);
      console.log(`  consumer topics   : ${consumer.summary().topics}`);
      console.log(`  producer metrics   : ${JSON.stringify(producer.metrics())}`);
      return;
    }
    case 'produce': {
      const [, topic, kind] = args;
      if (!topic || !kind) {
        console.error(colorize('Usage: streaming produce <topic> <kind>', RED));
        process.exit(1);
      }
      const producer = new StreamProducer();
      const r = producer.emit(topic, kind as 'create' | 'update' | 'delete' | 'access' | 'metric', { source: 'cli' });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    case 'drain': {
      const producer = new StreamProducer();
      producer.emit('a', 'create', {});
      producer.emit('a', 'update', {});
      const drained = producer.drain(10);
      console.log(JSON.stringify(drained, null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown streaming subcommand: ${sub}`, RED));
      process.exit(1);
  }
};

const cmdPlayback = (args: string[]): void => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize('Usage: playback <list|demo|snapshot|timeline>', RED));
    process.exit(1);
  }
  const idx = new PlaybackMasterIndex();
  switch (sub) {
    case 'list': {
      console.log(colorize(`\nPlayback engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(28), CYAN)} ${colorize('• ' + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case 'demo': {
      const snap = new MemorySnapshotter();
      const timeline = new TimelineView();
      const replay = new StepReplay();
      const coord = new ReplayCoordinator();
      coord.start();
      const s1 = snap.capture('before', 'episodic', [{ key: 'k1', value: { v: 1 } }, { key: 'k2', value: { v: 2 } }]);
      coord.recordSnapshot();
      timeline.record([
        { topic: 'demo', kind: 'create', ts: Date.now(), payload: { phase: 'init' } },
        { topic: 'demo', kind: 'update', ts: Date.now(), payload: { phase: 'go' } },
      ]);
      coord.recordEvents(timeline.count());
      const s2 = snap.capture('after', 'episodic', [{ key: 'k1', value: { v: 1 } }, { key: 'k2', value: { v: 99 } }, { key: 'k3', value: { v: 3 } }]);
      coord.recordSnapshot();
      const diff = new DiffEngine().diff(s1, s2);
      coord.recordDiff();
      replay.fromEvents(timeline.list());
      replay.start();
      const first = replay.next();
      coord.end();
      console.log(colorize('\nPlayback demo:', BOLD));
      console.log(`  snapshots       : ${snap.stats().retained}`);
      console.log(`  timeline events : ${timeline.count()}`);
      console.log(`  diff summary    : ${JSON.stringify(new DiffEngine().summarize(diff))}`);
      console.log(`  replay steps    : ${replay.status().total}`);
      console.log(`  first replay    : ${JSON.stringify(first?.data)}`);
      return;
    }
    case 'snapshot': {
      const [, label] = args;
      if (!label) {
        console.error(colorize('Usage: playback snapshot <label>', RED));
        process.exit(1);
      }
      const snap = new MemorySnapshotter();
      const r = snap.capture(label, 'cli', [{ key: 'cli', value: { ts: Date.now(), label } }]);
      console.log(JSON.stringify({ snapId: r.id, size: r.size }, null, 2));
      return;
    }
    case 'timeline': {
      const [, nStr] = args;
      const n = nStr ? Number(nStr) : 5;
      const v = new TimelineView();
      v.record([
        { topic: 'cli', kind: 'create', ts: Date.now() - 200, payload: { a: 1 } },
        { topic: 'cli', kind: 'update', ts: Date.now() - 100, payload: { a: 2 } },
        { topic: 'cli', kind: 'delete', ts: Date.now() - 50, payload: { a: 3 } },
      ]);
      console.log(JSON.stringify(v.recent(n), null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown playback subcommand: ${sub}`, RED));
      process.exit(1);
  }
};

const cmdFederated = (args: string[]): void => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize('Usage: federated <list|demo|share|audit>', RED));
    process.exit(1);
  }
  const idx = new FederatedMemoryIndex();
  switch (sub) {
    case 'list': {
      console.log(colorize(`\nFederated engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(28), CYAN)} ${colorize('• ' + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case 'demo': {
      const cohorts = new FederatedCohort();
      const shares = new FederatedMemoryShare();
      const audit = new PrivacyAudit();
      const budget = new PrivacyBudgetAggregator();
      const channel = new SecureChannel();
      const cohort = cohorts.create('team-a', 'agent-1');
      cohorts.addMember(cohort.id, 'agent-2');
      const share = shares.share('agent-1', cohort.id, 'shared insight', 0.1, cohorts, audit);
      budget.setBudget('agent-1', 10);
      budget.consume('agent-1', 0.5);
      const { channelId } = channel.open('agent-1', 'agent-2');
      channel.send('agent-1', 'agent-2', 'encrypted hello');
      console.log(colorize('\nFederated demo:', BOLD));
      console.log(`  cohort members  : ${cohorts.stats().members}`);
      console.log(`  share ok        : ${share.ok}`);
      console.log(`  audit entries   : ${audit.count()}`);
      console.log(`  budget stats    : ${JSON.stringify(budget.stats())}`);
      console.log(`  channel id      : ${channelId}`);
      console.log(`  secure messages : ${channel.stats().messages}`);
      return;
    }
    case 'share': {
      const [, cohortName, content] = args;
      if (!cohortName || !content) {
        console.error(colorize('Usage: federated share <cohort> <content>', RED));
        process.exit(1);
      }
      const cohorts = new FederatedCohort();
      const shares = new FederatedMemoryShare();
      const audit = new PrivacyAudit();
      const cohort = cohorts.create(cohortName, 'agent-cli');
      const r = shares.share('agent-cli', cohort.id, content, 0.1, cohorts, audit);
      console.log(JSON.stringify({ ok: r.ok, shareId: r.shareId, cohortId: cohort.id, auditCount: audit.count() }, null, 2));
      return;
    }
    case 'audit': {
      const [, nStr] = args;
      const n = nStr ? Number(nStr) : 5;
      const audit = new PrivacyAudit();
      audit.record({ kind: 'share', agentId: 'demo', cohortId: 'cohort-a' });
      audit.record({ kind: 'read', agentId: 'demo', cohortId: 'cohort-a' });
      audit.record({ kind: 'deny', agentId: 'demo', cohortId: 'cohort-a', reason: 'no_access' });
      console.log(JSON.stringify(audit.recent(n), null, 2));
      return;
    }
    default:
      console.error(colorize(`Unknown federated subcommand: ${sub}`, RED));
      process.exit(1);
  }
};

const cmdCohortUI = (args: string[]): void => {
  const sub = args[0];
  if (!sub) {
    console.error(colorize('Usage: cohortui <list|demo|tree|report>', RED));
    process.exit(1);
  }
  const idx = new FederatedCohortsUIMasterIndex();
  switch (sub) {
    case 'list': {
      console.log(colorize(`\nFederated UI engines (${idx.count()}):`, BOLD));
      for (const item of idx.list()) {
        console.log(`  ${colorize(item.name.padEnd(34), CYAN)} ${colorize('• ' + item.layer, DIM)}  ${item.version}`);
      }
      return;
    }
    case 'demo': {
      const cohorts = new FederatedCohort();
      const budgets = new PrivacyBudgetAggregator();
      const audit = new PrivacyAudit();
      const c = cohorts.create('team-x', 'agent-1');
      cohorts.addMember(c.id, 'agent-2');
      audit.record({ kind: 'share', agentId: 'agent-1', cohortId: c.id });
      audit.record({ kind: 'read', agentId: 'agent-2', cohortId: c.id });
      audit.record({ kind: 'deny', agentId: 'stranger', cohortId: c.id, reason: 'no_access' });
      budgets.setBudget('agent-1', 10);
      budgets.setBudget('agent-2', 10);
      budgets.consume('agent-1', 7);
      budgets.consume('agent-2', 2);
      const v = new CohortVisualizer();
      const g = new MembershipGraph();
      const ch = new PrivacyBudgetChart();
      const ex = new AuditExplorer();
      const rep = new CohortReport();
      const trees = v.buildTree(cohorts);
      g.build(cohorts);
      const points = ch.buildStacks(budgets);
      console.log(colorize('\nFederated UI demo:', BOLD));
      console.log(`  cohorts       : ${trees.length}`);
      console.log(`  graph edges   : ${g.stats().edges}`);
      console.log(`  budget points : ${points.length}`);
      console.log(`  max util      : ${(ch.summary(points).maxUtilization * 100).toFixed(0)}%`);
      console.log(`  timeline buckets: ${ex.timeline(audit, 60000).length}`);
      console.log(`  audit by kind : ${JSON.stringify(ex.byKind(audit))}`);
      const reportPreview = rep.markdown('Demo Report', [rep.cohortSection(cohorts), rep.budgetSection(budgets)]);
      console.log(`  report chars  : ${reportPreview.length}`);
      return;
    }
    case 'tree': {
      const cohorts = new FederatedCohort();
      const c = cohorts.create('alpha', 'agent-1', 'moderate');
      cohorts.addMember(c.id, 'agent-2');
      const c2 = cohorts.create('beta', 'agent-3', 'strict');
      const v = new CohortVisualizer();
      const trees = v.buildTree(cohorts);
      const flat = v.flatten(trees);
      console.log(colorize('\nCohort tree:', BOLD));
      for (const node of flat) {
        console.log(`  ${'  '.repeat(node.depth)}${node.type === 'cohort' ? '📁' : '👤'} ${node.label}`);
      }
      return;
    }
    case 'report': {
      const cohorts = new FederatedCohort();
      const audit = new PrivacyAudit();
      const budgets = new PrivacyBudgetAggregator();
      const c = cohorts.create('demo', 'agent-1');
      audit.record({ kind: 'share', agentId: 'agent-1', cohortId: c.id });
      budgets.setBudget('agent-1', 10);
      budgets.consume('agent-1', 4);
      const r = new CohortReport();
      const md = r.markdown('Cohort Report', [
        r.cohortSection(cohorts),
        r.budgetSection(budgets),
        r.auditSection(audit),
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