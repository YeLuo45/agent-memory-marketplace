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
//   compat                              Run OpenMemory compliance test
//   health                              MCP server health check
//   locales                             Show available locales

import { runDemo } from '../src/data/liveDemos';
import { MEMORY_ENGINES, LAYERS } from '../src/data/memoryEngines';
import { MCPServer } from '../src/mcp/MCPServer';
import { OpenMemoryAdapter, OpenMemoryComplianceTest } from '../src/mcp/OpenMemoryAdapter';
import { EventBus, MemoryWatcher, StreamProducer, StreamConsumer, StreamingMasterIndex } from '../src/streaming/StreamingCore';

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

main();