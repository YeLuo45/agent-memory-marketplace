// V5576-V5587: MCP server tests

import { describe, it, expect } from 'vitest';
import {
  MCPServer,
  MCPMasterIndex,
  MCPRequestRouter,
  MCPErrorLogger,
  MCPHealthCheck,
  MCPLoadBalancer,
  MCP_BATCH_5_ENGINES,
} from './MCPServer';

describe('MCPServer — JSON-RPC lifecycle', () => {
  it('initializes with server info + capability set', () => {
    const server = new MCPServer();
    const info = server.serverInfo();
    expect(info.name).toBe('agent-memory-marketplace');
    expect(info.version).toBe('3.0.0');
    expect(typeof info.uptimeSec).toBe('number');

    const init = server.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    });
    expect(init.jsonrpc).toBe('2.0');
    expect(init.id).toBe(1);
    expect(init.error).toBeUndefined();
    const result = init.result as { protocolVersion: string; capabilities: { tools: object; resources: object } };
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result.capabilities.tools).toBeTruthy();
    expect(result.capabilities.resources).toBeTruthy();
  });

  it('lists 41 tools across 9 layers', () => {
    const server = new MCPServer();
    const list = server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = (list.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.length).toBe(41);
    const names = tools.map(t => t.name);
    expect(names).toContain('EpisodicStore.record');
    expect(names).toContain('VectorEmbedder.embedText');
    expect(names).toContain('HNSWIndex.insert');
    expect(names).toContain('HybridSearcher.search');
    expect(names).toContain('Letta.import');
    expect(names).toContain('Letta.export');
    expect(names).toContain('Migration.diff');
    expect(names).toContain('Migration.validate');
    expect(names).toContain('Multimodal.addImage');
    expect(names).toContain('Multimodal.transcribe');
    expect(names).toContain('Multimodal.retrieve');
  });

  it('calls EpisodicStore.record with content + importance', () => {
    const server = new MCPServer();
    const call = server.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'EpisodicStore.record', arguments: { content: 'hello', importance: 0.8 } },
    });
    const content = (call.result as { content: Array<{ type: string; text: string }> }).content[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.ok).toBe(true);
    expect(parsed.total).toBe(1);
  });

  it('returns error for unknown tool name', () => {
    const server = new MCPServer();
    const call = server.handle({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'NoSuchTool', arguments: {} },
    });
    const content = (call.result as { content: Array<{ type: string; text: string }> }).content[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.error).toBeTruthy();
  });

  it('returns error for unknown method', () => {
    const server = new MCPServer();
    const resp = server.handle({ jsonrpc: '2.0', id: 5, method: 'foo' });
    expect(resp.error?.code).toBe(-32601);
  });

  it('lists 8 resources', () => {
    const server = new MCPServer();
    const resp = server.handle({ jsonrpc: '2.0', id: 6, method: 'resources/list' });
    const resources = (resp.result as { resources: Array<{ uri: string }> }).resources;
    expect(resources.length).toBe(8);
    const uris = resources.map(r => r.uri);
    expect(uris).toContain('memory://episodic/all');
    expect(uris).toContain('memory://memvector/all');
  });

  it('reads memory://episodic/all resource', () => {
    const server = new MCPServer();
    const resp = server.handle({
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: { uri: 'memory://episodic/all' },
    });
    const contents = (resp.result as { contents: Array<{ mimeType: string; text: string }> }).contents;
    expect(contents.length).toBe(1);
    expect(contents[0].mimeType).toBe('application/json');
    expect(JSON.parse(contents[0].text).type).toBe('episodic');
  });

  it('reads unknown resource with error text', () => {
    const server = new MCPServer();
    const resp = server.handle({
      jsonrpc: '2.0',
      id: 8,
      method: 'resources/read',
      params: { uri: 'memory://unknown/x' },
    });
    const contents = (resp.result as { contents: Array<{ text: string }> }).contents;
    expect(contents[0].text).toContain('Unknown resource');
  });

  it('dispatches server/info', () => {
    const server = new MCPServer();
    const resp = server.handle({ jsonrpc: '2.0', id: 9, method: 'server/info' });
    const info = resp.result as { name: string; version: string };
    expect(info.name).toBe('agent-memory-marketplace');
  });

  it('handles all 41 tool calls without error', () => {
    const server = new MCPServer();
    const tools = server.tools();
    for (const t of tools) {
      const args: Record<string, unknown> = {};
      for (const [k, s] of Object.entries(t.inputSchema.properties)) {
        args[k] = s.type === 'number' ? 0.5 : s.type === 'array' ? '[]' : 'sample';
      }
      const call = server.handle({
        jsonrpc: '2.0',
        id: tools.indexOf(t),
        method: 'tools/call',
        params: { name: t.name, arguments: args },
      });
      expect(call.error, `tool ${t.name} returned error`).toBeUndefined();
    }
  });
});

describe('MCPServer — additional features', () => {
  it('toolCount + resourceCount + health', () => {
    const server = new MCPServer();
    expect(server.toolCount()).toBe(41);
    expect(server.resourceCount()).toBe(8);
    const h = server.health();
    expect(h.status).toBe('ok');
    expect(h.toolCount).toBe(41);
    expect(typeof h.uptime).toBe('number');
  });

  it('requestCount tracks health calls', () => {
    const server = new MCPServer();
    expect(server.requestCount()).toBe(0);
    server.health();
    expect(server.requestCount()).toBe(1);
  });

  it('MCPMasterIndex list + count + has + const length', () => {
    const idx = new MCPMasterIndex();
    expect(idx.list().length).toBe(11);
    expect(idx.count()).toBe(11);
    expect(idx.has('MCPServer')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
    expect(MCP_BATCH_5_ENGINES).toHaveLength(11);
  });

  it('MCPRequestRouter routes and logs', () => {
    const router = new MCPRequestRouter();
    const resp = router.route({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(resp.error).toBeUndefined();
    const log = router.log();
    expect(log.length).toBe(1);
    expect(log[0].method).toBe('tools/list');
    expect(log[0].ok).toBe(true);
  });

  it('MCPRequestRouter.recent returns last N', () => {
    const router = new MCPRequestRouter();
    router.route({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    router.route({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
    router.route({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
    expect(router.recent(2).length).toBe(2);
    expect(router.errorCount()).toBe(0);
  });

  it('MCPRequestRouter.errorCount for failed calls', () => {
    const router = new MCPRequestRouter();
    router.route({ jsonrpc: '2.0', id: 1, method: 'foo' });
    expect(router.errorCount()).toBe(1);
  });

  it('MCPRequestRouter.server() exposes the underlying server', () => {
    const router = new MCPRequestRouter();
    expect(router.server().toolCount()).toBe(41);
  });

  it('MCPErrorLogger records + retrieves + clears', () => {
    const logger = new MCPErrorLogger();
    const req = { jsonrpc: '2.0' as const, id: 1, method: 'foo' };
    const resp = { jsonrpc: '2.0' as const, id: 1, error: { code: -32601, message: 'method not found' } };
    logger.record(req, resp);
    expect(logger.count()).toBe(1);
    expect(logger.lastError()?.response.error?.code).toBe(-32601);
    logger.clear();
    expect(logger.count()).toBe(0);
  });

  it('MCPErrorLogger ignores successful responses', () => {
    const logger = new MCPErrorLogger();
    logger.record(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { jsonrpc: '2.0', id: 1, result: { tools: [] } },
    );
    expect(logger.count()).toBe(0);
  });

  it('MCPHealthCheck.start + ping', () => {
    const hc = new MCPHealthCheck();
    const server = new MCPServer();
    hc.start();
    const r = hc.ping(server);
    expect(r.alive).toBe(true);
    expect(r.tools).toBe(41);
    expect(hc.checks()).toBe(1);
  });

  it('MCPLoadBalancer round-robin across N servers', () => {
    const lb = new MCPLoadBalancer([new MCPServer('a'), new MCPServer('b')]);
    expect(lb.serverCount()).toBe(2);
    const r1 = lb.route({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(r1.error).toBeUndefined();
    const r2 = lb.route({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(r2.error).toBeUndefined();
  });

  it('MCPLoadBalancer requires ≥ 1 server', () => {
    expect(() => new MCPLoadBalancer([])).toThrow();
  });

  it('MCPServer.serveStdio processes JSON-RPC lines', async () => {
    const server = new MCPServer();
    const inputs = [
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/list' }),
      '',
    ];
    const readable = { on: (ev: string, cb: (chunk?: unknown) => void) => {
      if (ev === 'data') {
        inputs.forEach((line, i) => setTimeout(() => cb(line + '\n'), i));
      }
      if (ev === 'end') setTimeout(() => cb(), inputs.length * 5 + 5);
    } };
    const outputs: string[] = [];
    const writable = { write: (s: string) => outputs.push(s) };
    await server.serveStdio(readable as unknown as NodeJS.ReadableStream, writable as unknown as NodeJS.WritableStream);
    expect(outputs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(outputs[0]).id).toBe(1);
  });
});