// V5588-V5594: OpenMemory REST adapter tests

import { describe, it, expect } from 'vitest';
import {
  OpenMemoryAdapter,
  OpenMemoryRouter,
  OpenMemoryComplianceTest,
  OpenMemoryMasterIndex,
  AdapterHealth,
  AdapterStats,
  AdapterAudit,
} from './OpenMemoryAdapter';

describe('OpenMemoryAdapter — REST operations', () => {
  it('create returns a record with id, agent_id, type, content, created_at', () => {
    const a = new OpenMemoryAdapter();
    const r = a.create({ agent_id: 'u1', type: 'episodic', content: 'hello', importance: 0.7 });
    expect(r.ok).toBe(true);
    expect(r.data?.id).toBeTruthy();
    expect(r.data?.agent_id).toBe('u1');
    expect(r.data?.type).toBe('episodic');
    expect(r.data?.content).toBe('hello');
    expect(r.data?.importance).toBe(0.7);
    expect(typeof r.data?.created_at).toBe('number');
  });

  it('get retrieves by id', () => {
    const a = new OpenMemoryAdapter();
    const c = a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    if (c.data) {
      const g = a.get(c.data.id);
      expect(g.ok).toBe(true);
      expect(g.data?.id).toBe(c.data.id);
    }
  });

  it('get returns error for missing id', () => {
    const a = new OpenMemoryAdapter();
    const r = a.get('nonexistent');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('list returns all records by default, filtered by agent_id/type/limit', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u1', type: 'episodic', content: 'a' });
    a.create({ agent_id: 'u1', type: 'semantic', content: 'b' });
    a.create({ agent_id: 'u2', type: 'episodic', content: 'c' });
    expect(a.list().data?.length).toBe(3);
    expect(a.list({ agent_id: 'u1' }).data?.length).toBe(2);
    expect(a.list({ type: 'episodic' }).data?.length).toBe(2);
    expect(a.list({ limit: 1 }).data?.length).toBe(1);
    expect(a.list({ agent_id: 'u1', type: 'semantic' }).data?.length).toBe(1);
  });

  it('update modifies fields', () => {
    const a = new OpenMemoryAdapter();
    const c = a.create({ agent_id: 'u', type: 'episodic', content: 'old' });
    if (c.data) {
      const u = a.update(c.data.id, { content: 'new', importance: 0.9 });
      expect(u.data?.content).toBe('new');
      expect(u.data?.importance).toBe(0.9);
    }
  });

  it('delete removes record + returns ok', () => {
    const a = new OpenMemoryAdapter();
    const c = a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    if (c.data) {
      const d = a.delete(c.data.id);
      expect(d.ok).toBe(true);
      expect(a.recordCount()).toBe(0);
    }
  });

  it('search returns hits sorted by score desc', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'user asked about python' });
    a.create({ agent_id: 'u', type: 'episodic', content: 'random weather talk' });
    a.create({ agent_id: 'u', type: 'episodic', content: 'python is great' });
    const r = a.search({ query: 'python', limit: 5 });
    expect(r.data?.length).toBe(3);
    expect(r.data?.[0].content).toContain('python');
  });

  it('search with type filter', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'p' });
    a.create({ agent_id: 'u', type: 'semantic', content: 'p' });
    const r = a.search({ query: 'p', type: 'semantic' });
    expect(r.data?.length).toBe(1);
    expect(r.data?.[0].type).toBe('semantic');
  });

  it('byAgent returns only matching records', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u1', type: 'episodic', content: 'a' });
    a.create({ agent_id: 'u2', type: 'episodic', content: 'b' });
    const r = a.byAgent('u1');
    expect(r.data?.length).toBe(1);
    expect(r.data?.[0].agent_id).toBe('u1');
  });

  it('audit returns per-agent log', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    const r = a.audit('u');
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.data)).toBe(true);
  });

  it('stats returns type counts', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'a' });
    a.create({ agent_id: 'u', type: 'episodic', content: 'b' });
    a.create({ agent_id: 'u', type: 'semantic', content: 'c' });
    const s = a.stats();
    expect(s.ok).toBe(true);
    expect((s.data as Record<string, number>)['episodic']).toBe(2);
  });

  it('clear removes all records', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'a' });
    a.create({ agent_id: 'u', type: 'semantic', content: 'b' });
    const r = a.clear();
    expect(r.data?.cleared).toBe(2);
    expect(a.recordCount()).toBe(0);
  });

  it('handleHttp dispatches POST /memories', () => {
    const a = new OpenMemoryAdapter();
    const json = a.handleHttp('POST', '/memories', { agent_id: 'u', type: 'episodic', content: 'hi' });
    const r = JSON.parse(json);
    expect(r.ok).toBe(true);
    expect(r.data?.id).toBeTruthy();
    expect(r.meta?.elapsed_ms).toBeGreaterThanOrEqual(0);
  });

  it('handleHttp dispatches GET /memories/:id', () => {
    const a = new OpenMemoryAdapter();
    const c = a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    if (c.data) {
      const json = a.handleHttp('GET', `/memories/${c.data.id}`);
      const r = JSON.parse(json);
      expect(r.data?.id).toBe(c.data.id);
    }
  });

  it('handleHttp dispatches DELETE /memories/:id', () => {
    const a = new OpenMemoryAdapter();
    const c = a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    if (c.data) {
      const json = a.handleHttp('DELETE', `/memories/${c.data.id}`);
      const r = JSON.parse(json);
      expect(r.ok).toBe(true);
    }
  });

  it('handleHttp dispatches PATCH /memories/:id', () => {
    const a = new OpenMemoryAdapter();
    const c = a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    if (c.data) {
      const json = a.handleHttp('PATCH', `/memories/${c.data.id}`, { content: 'updated' });
      const r = JSON.parse(json);
      expect(r.data?.content).toBe('updated');
    }
  });

  it('handleHttp dispatches POST /search', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'python' });
    const json = a.handleHttp('POST', '/search', { query: 'python' });
    const r = JSON.parse(json);
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });

  it('handleHttp dispatches GET /stats', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    const json = a.handleHttp('GET', '/stats');
    const r = JSON.parse(json);
    expect(r.data?.episodic).toBe(1);
  });

  it('handleHttp dispatches DELETE /memories (clear)', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    const json = a.handleHttp('DELETE', '/memories');
    const r = JSON.parse(json);
    expect(r.data?.cleared).toBe(1);
  });

  it('handleHttp dispatches GET /health', () => {
    const a = new OpenMemoryAdapter();
    const json = a.handleHttp('GET', '/health');
    const r = JSON.parse(json);
    expect(r.ok).toBe(true);
  });

  it('handleHttp returns error for unsupported endpoint', () => {
    const a = new OpenMemoryAdapter();
    const json = a.handleHttp('POST', '/unknown');
    const r = JSON.parse(json);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Unsupported');
  });

  it('create mirrors into backing engines by type', () => {
    const a = new OpenMemoryAdapter();
    a.create({ agent_id: 'u', type: 'episodic', content: 'x', importance: 0.9 });
    a.create({ agent_id: 'u', type: 'semantic', content: 'y', metadata: { tags: ['t1', 't2'] } });
    a.create({ agent_id: 'u', type: 'long-term', content: 'z' });
    a.create({ agent_id: 'u', type: 'short-term', content: 'q' });
    a.create({ agent_id: 'u', type: 'associative', content: 'r', metadata: { related: 'other' } });
    expect(a.recordCount()).toBe(5);
  });
});

describe('OpenMemoryRouter', () => {
  it('route delegates to adapter', () => {
    const router = new OpenMemoryRouter();
    const json = router.route('POST', '/memories', { agent_id: 'u', type: 'episodic', content: 'x' });
    const r = JSON.parse(json);
    expect(r.ok).toBe(true);
  });

  it('endpoints lists 9 supported endpoints', () => {
    const router = new OpenMemoryRouter();
    const eps = router.endpoints();
    expect(eps.length).toBe(9);
    expect(eps.map(e => e.method)).toContain('POST');
    expect(eps.map(e => e.method)).toContain('GET');
    expect(eps.map(e => e.method)).toContain('PATCH');
    expect(eps.map(e => e.method)).toContain('DELETE');
  });

  it('adapter() exposes the underlying adapter', () => {
    const router = new OpenMemoryRouter();
    expect(router.adapter()).toBeInstanceOf(OpenMemoryAdapter);
  });
});

describe('OpenMemoryComplianceTest', () => {
  it('runAll returns pass/fail breakdown', () => {
    const t = new OpenMemoryComplianceTest();
    const r = t.runAll();
    expect(r.pass).toBeGreaterThanOrEqual(5);
    expect(r.fail).toBe(0);
    expect(r.results.every(x => typeof x.ok === 'boolean')).toBe(true);
  });
});

describe('OpenMemoryMasterIndex', () => {
  it('list + count + has', () => {
    const idx = new OpenMemoryMasterIndex();
    expect(idx.list().length).toBe(11);
    expect(idx.count()).toBe(11);
    expect(idx.has('OpenMemoryAdapter')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
  });
});

describe('AdapterHealth + AdapterStats + AdapterAudit', () => {
  it('AdapterHealth.check returns alive + uptime + recordCount', () => {
    const h = new AdapterHealth();
    const r = h.check();
    expect(r.alive).toBe(true);
    expect(r.uptime).toBeGreaterThanOrEqual(0);
    expect(r.recordCount).toBe(0);
  });

  it('AdapterStats.recordCall + calls + breakdown', () => {
    const s = new AdapterStats();
    s.recordCall();
    s.recordCall();
    expect(s.calls()).toBe(2);
    expect(s.breakdown().records).toBe(0);
  });

  it('AdapterAudit.record + forAgent + total', () => {
    const a = new AdapterAudit();
    a.record('u', 'create', 'episodic');
    a.record('u', 'delete', 'episodic');
    expect(a.total()).toBe(2);
    expect((a.forAgent('u') as unknown[]).length).toBe(2);
  });
});