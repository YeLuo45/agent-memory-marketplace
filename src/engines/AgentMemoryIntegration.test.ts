// V5236-V5245: CV Agent Memory Integration Batch 3/3 tests
import { describe, it, expect } from 'vitest';
import {
  MemoryDashboard,
  MemoryConfig,
  MemoryAudit,
  MemoryProfile,
  MemoryMigration,
  MemoryReport,
  MemoryBenchmark,
  MemoryIntegrationIndex,
  MemoryMasterIndex,
  CV_BATCH_3_ENGINES,
  CV_ALL_ENGINES
} from './AgentMemoryIntegration';

describe('MemoryDashboard + MemoryConfig + MemoryAudit', () => {
  it('MemoryDashboard setPanel + getPanel + names + count', () => {
    const d = new MemoryDashboard();
    d.setPanel('ltm', 'LTM Size', 1000).setPanel('stm', 'STM Capacity', 10);
    expect(d.getPanel('ltm')).toEqual({ title: 'LTM Size', value: 1000 });
    expect(d.getPanel('missing')).toBeNull();
    expect(d.panelNames().sort()).toEqual(['ltm', 'stm']);
    expect(d.panelCount()).toBe(2);
  });

  it('MemoryConfig typed accessors', () => {
    const c = new MemoryConfig();
    c.set('capacity', 1000).set('strategy', 'consolidate').set('enabled', true);
    expect(c.getNumber('capacity')).toBe(1000);
    expect(c.getString('strategy')).toBe('consolidate');
    expect(c.getBoolean('enabled')).toBe(true);
    expect(c.getNumber('missing', 100)).toBe(100);
    expect(c.getString('missing', 'fb')).toBe('fb');
    expect(c.getBoolean('missing', false)).toBe(false);
    expect(c.size()).toBe(3);
  });

  it('MemoryAudit record + records + forAgent + count + clear', () => {
    const a = new MemoryAudit();
    a.record('agent1', 'store', 'episodic').record('agent2', 'retrieve', 'semantic');
    expect(a.count()).toBe(2);
    expect(a.forAgent('agent1')).toHaveLength(1);
    a.clear();
    expect(a.count()).toBe(0);
  });
});

describe('MemoryProfile + MemoryMigration + MemoryReport + MemoryBenchmark', () => {
  it('MemoryProfile record + runs + averages', () => {
    const p = new MemoryProfile();
    p.record('agent1', 100, 50).record('agent1', 200, 100);
    expect(p.runs('agent1')).toHaveLength(2);
    expect(p.averageItems('agent1')).toBe(150);
    expect(p.averageDuration('agent1')).toBe(75);
    expect(p.averageItems('missing')).toBe(0);
  });

  it('MemoryMigration define + run + isApplied + counts', async () => {
    const m = new MemoryMigration();
    let n = 0;
    m.define('v1', () => { n += 1; });
    m.define('v2', async () => { n += 1; });
    expect(await m.run('v1')).toBe(true);
    expect(await m.run('missing')).toBe(false);
    expect(m.isApplied('v1')).toBe(true);
    expect(m.migrationCount()).toBe(2);
    expect(m.appliedCount()).toBe(1);
  });

  it('MemoryReport generate + toCSV', () => {
    const r = new MemoryReport();
    expect(r.generate('Q1 Memory', { ltm: 1000, stm: 50 })).toContain('# Q1 Memory');
    expect(r.toCSV({ a: 1 })).toContain('metric,value');
  });

  it('MemoryBenchmark record + get + best + results', () => {
    const b = new MemoryBenchmark();
    b.record('episodic', 0.9).record('semantic', 0.85).record('procedural', 0.95);
    expect(b.get('episodic')).toBe(0.9);
    expect(b.get('missing')).toBe(0);
    expect(b.best()?.name).toBe('procedural');
    expect(b.results()).toEqual({ episodic: 0.9, semantic: 0.85, procedural: 0.95 });
    expect(new MemoryBenchmark().best()).toBeNull();
  });
});

describe('MemoryIntegrationIndex', () => {
  it('list has 9', () => {
    expect(new MemoryIntegrationIndex().list()).toHaveLength(9);
  });

  it('count + engines + has', () => {
    const idx = new MemoryIntegrationIndex();
    expect(idx.count()).toBe(9);
    expect(idx.engines()).toEqual(idx.list());
    expect(idx.has('MemoryDashboard')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
  });

  it('CV_BATCH_3_ENGINES const has 9', () => {
    expect(CV_BATCH_3_ENGINES).toHaveLength(9);
  });
});

describe('MemoryMasterIndex', () => {
  it('list contains all 29 engines', () => {
    expect(new MemoryMasterIndex().list()).toHaveLength(29);
  });

  it('count 29', () => {
    expect(new MemoryMasterIndex().count()).toBe(29);
  });

  it('has returns true for all 3 batches', () => {
    const idx = new MemoryMasterIndex();
    expect(idx.has('EpisodicStore')).toBe(true);
    expect(idx.has('LongTermMemoryManager')).toBe(true);
    expect(idx.has('MemoryDashboard')).toBe(true);
  });

  it('CV_ALL_ENGINES const has 29', () => {
    expect(CV_ALL_ENGINES).toHaveLength(29);
  });
});