// V5596-V5610: Memory Migration Tool tests

import { describe, it, expect } from 'vitest';
import {
  LettaImportParser,
  LettaExporter,
  MemoryMigrator,
  FormatConverter,
  SchemaMapper,
  BatchImporter,
  ImportValidator,
  ImportReport,
  MigrationDiffEngine,
  MigrationRollback,
  LettaAdapter,
  MIGRATION_TOOLS,
  MigrationMasterIndex,
  MigrationTracker,
  MigrationAuditLog,
  MIGRATION_BATCH_6_ENGINES,
} from './MigrationEngine';
import { OpenMemoryAdapter } from '../mcp/OpenMemoryAdapter';

describe('LettaImportParser', () => {
  it('parses flat array of records', () => {
    const p = new LettaImportParser();
    const json = JSON.stringify([
      { id: 'r1', agent_id: 'u1', type: 'episodic', text: 'hello' },
      { id: 'r2', agent_id: 'u1', type: 'semantic', text: 'world' },
    ]);
    const r = p.parse(json);
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBe(2);
    expect(r.data?.[0].content).toBe('hello');
    expect(r.data?.[1].content).toBe('world');
  });

  it('parses Letta wrapped format with records key', () => {
    const p = new LettaImportParser();
    const json = JSON.stringify({
      version: '1.0',
      records: [{ id: 'r1', agent_id: 'u1', text: 'hi' }],
    });
    const r = p.parse(json);
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBe(1);
  });

  it('handles alternative field names (agentId, message, createdAt)', () => {
    const p = new LettaImportParser();
    const json = JSON.stringify([
      { agentId: 'u1', message: 'hi', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const r = p.parse(json);
    expect(r.data?.[0].agent_id).toBe('u1');
    expect(r.data?.[0].content).toBe('hi');
    expect(r.data?.[0].created_at).toBeGreaterThan(0);
  });

  it('falls back to ephemeral data wrapper (data/items/messages/memories)', () => {
    const p = new LettaImportParser();
    const variants = [
      JSON.stringify({ agents: [{ id: '1', agent_id: 'u', text: 'a' }] }),
      JSON.stringify({ messages: [{ id: '1', agent_id: 'u', text: 'a' }] }),
      JSON.stringify({ memories: [{ id: '1', agent_id: 'u', text: 'a' }] }),
      JSON.stringify({ items: [{ id: '1', agent_id: 'u', text: 'a' }] }),
      JSON.stringify({ data: [{ id: '1', agent_id: 'u', text: 'a' }] }),
    ];
    for (const v of variants) {
      expect(p.parse(v).data?.length).toBe(1);
    }
  });

  it('maps unknown type to episodic', () => {
    const p = new LettaImportParser();
    const json = JSON.stringify([{ id: 'r1', agent_id: 'u', type: 'unknown', text: 'x' }]);
    const r = p.parse(json);
    expect(r.data?.[0].type).toBe('episodic');
  });

  it('maps invalid JSON to error', () => {
    const p = new LettaImportParser();
    const r = p.parse('{bad');
    expect(r.ok).toBe(false);
  });

  it('handles empty array', () => {
    const p = new LettaImportParser();
    const r = p.parse('[]');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBe(0);
  });
});

describe('LettaExporter', () => {
  it('serializes records to Letta JSON', () => {
    const e = new LettaExporter();
    e.add({ id: 'r1', agent_id: 'u1', type: 'episodic', content: 'hi', created_at: Date.now(), importance: 0.8 });
    const json = e.toLettaJSON();
    expect(json).toContain('"version": "1.0"');
    expect(json).toContain('"records"');
    expect(json).toContain('"agent_id": "u1"');
    expect(json).toContain('"text": "hi"');
  });

  it('serializes to Zep format', () => {
    const e = new LettaExporter();
    e.add({ id: 'r1', agent_id: 'u1', type: 'episodic', content: 'hi', created_at: Date.now() });
    const json = e.toZepJSON();
    expect(json).toContain('"session_id": "u1"');
    expect(json).toContain('"role": "user"');
  });

  it('serializes to Cognee format', () => {
    const e = new LettaExporter();
    e.add({ id: 'r1', agent_id: 'u1', type: 'episodic', content: 'hi', created_at: Date.now() });
    const json = e.toCogneeJSON();
    expect(json).toContain('"text": "hi"');
    expect(json).toContain('"data"');
  });

  it('serializes to markdown', () => {
    const e = new LettaExporter();
    e.add({ id: 'r1', agent_id: 'u1', type: 'episodic', content: 'hi', created_at: Date.now(), importance: 0.8 });
    const md = e.toMarkdown();
    expect(md).toContain('# Memory Export');
    expect(md).toContain('## r1');
    expect(md).toContain('hi');
  });

  it('addAll + count + clear', () => {
    const e = new LettaExporter();
    e.addAll([
      { id: 'a', agent_id: 'u', type: 'episodic', content: 'x', created_at: Date.now() },
      { id: 'b', agent_id: 'u', type: 'episodic', content: 'y', created_at: Date.now() },
    ]);
    expect(e.count()).toBe(2);
    e.clear();
    expect(e.count()).toBe(0);
  });
});

describe('MemoryMigrator', () => {
  it('migrates from Letta JSON into adapter', async () => {
    const adapter = new OpenMemoryAdapter();
    const m = new MemoryMigrator(adapter);
    const json = JSON.stringify([{ id: 'r1', agent_id: 'u1', type: 'episodic', text: 'hi' }]);
    const r = await m.migrateFromJSON(json, 'letta');
    expect(r.ok).toBe(true);
    expect(r.imported).toBe(1);
    expect(adapter.recordCount()).toBe(1);
  });

  it('migrates from native JSON', async () => {
    const adapter = new OpenMemoryAdapter();
    const m = new MemoryMigrator(adapter);
    const json = JSON.stringify([
      { id: 'a', agent_id: 'u', type: 'episodic', content: 'x', created_at: Date.now() },
    ]);
    const r = await m.migrateFromJSON(json, 'native');
    expect(r.imported).toBe(1);
  });

  it('migrates from zep format', async () => {
    const adapter = new OpenMemoryAdapter();
    const m = new MemoryMigrator(adapter);
    const json = JSON.stringify({
      messages: [
        { session_id: 'u', role: 'user', content: 'hi', created_at: new Date().toISOString() },
      ],
    });
    const r = await m.migrateFromJSON(json, 'zep');
    expect(r.imported).toBe(1);
  });

  it('filterByAgent restricts to agent', async () => {
    const adapter = new OpenMemoryAdapter();
    const m = new MemoryMigrator(adapter);
    m.filterByAgent('u1');
    const json = JSON.stringify([
      { id: 'a', agent_id: 'u1', type: 'episodic', text: 'x' },
      { id: 'b', agent_id: 'u2', type: 'episodic', text: 'y' },
    ]);
    const r = await m.migrateFromJSON(json, 'letta');
    expect(r.imported).toBe(1);
  });

  it('handles invalid JSON gracefully', async () => {
    const m = new MemoryMigrator();
    const r = await m.migrateFromJSON('{bad', 'letta');
    expect(r.ok).toBe(false);
    expect(r.failed).toBe(1);
  });

  it('sourceLabel returns current source', () => {
    const m = new MemoryMigrator();
    m.setSource('letta-export-2024.json');
    expect(m.sourceLabel()).toBe('letta-export-2024.json');
  });

  it('target returns the underlying adapter', () => {
    const adapter = new OpenMemoryAdapter();
    const m = new MemoryMigrator(adapter);
    expect(m.target()).toBe(adapter);
  });
});

describe('FormatConverter', () => {
  it('toJSON parses valid JSON', () => {
    const c = new FormatConverter();
    const r = c.toJSON('{"a":1}');
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ a: 1 });
  });

  it('toJSON returns error for invalid JSON', () => {
    const c = new FormatConverter();
    expect(c.toJSON('{bad').ok).toBe(false);
  });

  it('toYAML serializes simple object', () => {
    const c = new FormatConverter();
    expect(c.toYAML({ name: 'foo', count: 3 })).toContain('name: foo');
  });

  it('toYAML serializes nested object', () => {
    const c = new FormatConverter();
    expect(c.toYAML({ a: { b: 1 } })).toContain('a:');
    expect(c.toYAML({ a: { b: 1 } })).toContain('b: 1');
  });

  it('toYAML serializes arrays with - prefix', () => {
    const c = new FormatConverter();
    const yaml = c.toYAML({ list: [1, 2, 3] });
    expect(yaml).toContain('list:');
    expect(yaml).toContain('- 1');
  });

  it('toTOML serializes flat object', () => {
    const c = new FormatConverter();
    expect(c.toTOML({ a: 1, b: 'x' })).toContain('a = 1');
    expect(c.toTOML({ a: 1, b: 'x' })).toContain('b = "x"');
  });

  it('recordsToCSV + csvToRecords roundtrip', () => {
    const c = new FormatConverter();
    const records = [
      { id: 'r1', agent_id: 'u1', type: 'episodic', content: 'hello, world', created_at: 1700000000000, importance: 0.8 },
      { id: 'r2', agent_id: 'u1', type: 'semantic', content: 'simple', created_at: 1700000001000 },
    ];
    const csv = c.recordsToCSV(records);
    expect(csv.split('\n')[0]).toContain('id,agent_id,type');
    const back = c.csvToRecords(csv);
    expect(back.ok).toBe(true);
    expect(back.data?.length).toBe(2);
    expect(back.data?.[0].content).toBe('hello, world');
  });

  it('csvToRecords handles empty input', () => {
    const c = new FormatConverter();
    const r = c.csvToRecords('');
    expect(r.ok).toBe(true);
    expect(r.data).toEqual([]);
  });
});

describe('SchemaMapper', () => {
  it('define + map applies mappings', () => {
    const m = new SchemaMapper();
    m.define('letta', { agent_id: 'agent_id', text: 'content', type: 'type' });
    const out = m.map('letta', { agent_id: 'u', text: 'hi', type: 'episodic' });
    expect(out).toEqual({ agent_id: 'u', content: 'hi', type: 'episodic' });
  });

  it('has + fields', () => {
    const m = new SchemaMapper();
    expect(m.has('letta')).toBe(false);
    m.define('letta', { a: 'b' });
    expect(m.has('letta')).toBe(true);
    expect(m.fields('letta')).toEqual(['a']);
  });

  it('unknown source returns input as-is', () => {
    const m = new SchemaMapper();
    expect(m.map('unknown', { x: 1 })).toEqual({ x: 1 });
  });
});

describe('BatchImporter', () => {
  it('importBatch + batches + totalImported', () => {
    const adapter = new OpenMemoryAdapter();
    const b = new BatchImporter();
    const records = [
      { id: 'a', agent_id: 'u', type: 'episodic', content: 'x', created_at: Date.now() },
      { id: 'b', agent_id: 'u', type: 'episodic', content: 'y', created_at: Date.now() },
    ];
    const r = b.importBatch(adapter, records);
    expect(r.imported).toBe(2);
    expect(r.failed).toBe(0);
    expect(b.totalImported()).toBe(2);
    expect(b.batches().length).toBe(1);
  });

  it('handles empty batch', () => {
    const adapter = new OpenMemoryAdapter();
    const b = new BatchImporter();
    const r = b.importBatch(adapter, []);
    expect(r.imported).toBe(0);
  });
});

describe('ImportValidator', () => {
  it('validates correct records', () => {
    const v = new ImportValidator();
    const r = v.validate([
      { id: 'r1', agent_id: 'u', type: 'episodic', content: 'x', created_at: Date.now() },
    ]);
    expect(r.ok).toBe(true);
    expect(r.valid).toBe(1);
  });

  it('reports missing fields', () => {
    const v = new ImportValidator();
    const r = v.validate([
      { id: '', agent_id: '', type: '', content: '', created_at: Date.now() },
    ]);
    expect(r.ok).toBe(false);
    expect(r.invalid).toBe(1);
    expect(v.errors().length).toBeGreaterThan(0);
  });

  it('catches invalid created_at', () => {
    const v = new ImportValidator();
    const r = v.validate([
      { id: 'r1', agent_id: 'u', type: 'episodic', content: 'x', created_at: -1 },
    ]);
    expect(r.invalid).toBe(1);
  });
});

describe('ImportReport', () => {
  it('generates markdown with success status', () => {
    const r = new ImportReport();
    const md = r.generate(10, 0, 100, [], 'letta');
    expect(md).toContain('# Import Report');
    expect(md).toContain('Imported: 10');
    expect(md).toContain('✅ SUCCESS');
  });

  it('generates markdown with partial status + errors', () => {
    const r = new ImportReport();
    const md = r.generate(5, 2, 100, [{ index: 0, reason: 'parse failed' }], 'zep');
    expect(md).toContain('⚠️ PARTIAL');
    expect(md).toContain('Index 0');
    expect(md).toContain('parse failed');
  });

  it('truncates long error list', () => {
    const r = new ImportReport();
    const errors = Array.from({ length: 100 }, (_, i) => ({ index: i, reason: `e${i}` }));
    const md = r.generate(0, 100, 100, errors, 'letta');
    expect(md).toContain('and 50 more');
  });
});

describe('MigrationDiffEngine', () => {
  it('detects added/removed/changed/unchanged', () => {
    const d = new MigrationDiffEngine();
    const before = [
      { id: 'a', agent_id: 'u', type: 'episodic', content: 'old', created_at: 1 },
      { id: 'b', agent_id: 'u', type: 'episodic', content: 'same', created_at: 2 },
    ];
    const after = [
      { id: 'a', agent_id: 'u', type: 'episodic', content: 'new', created_at: 1 },
      { id: 'b', agent_id: 'u', type: 'episodic', content: 'same', created_at: 2 },
      { id: 'c', agent_id: 'u', type: 'episodic', content: 'added', created_at: 3 },
    ];
    const diff = d.diff(before, after);
    expect(diff.added.length).toBe(1);
    expect(diff.changed.length).toBe(1);
    expect(diff.unchanged).toBe(1);
  });

  it('summarize produces string', () => {
    const d = new MigrationDiffEngine();
    const summary = d.summarize({ added: [], removed: [], changed: [], unchanged: 0 });
    expect(summary).toContain('Migration diff');
  });
});

describe('MigrationRollback', () => {
  it('records + undo deletes migrated records', () => {
    const adapter = new OpenMemoryAdapter();
    const a = adapter.create({ agent_id: 'u', type: 'episodic', content: 'x' });
    if (a.data) {
      const r = new MigrationRollback();
      r.record([a.data], [], 'test');
      expect(r.size()).toBe(1);
      const undo = r.undo(adapter);
      expect(undo.ok).toBe(true);
      expect(adapter.recordCount()).toBe(0);
    }
  });

  it('restores before-snapshot on undo', () => {
    const adapter = new OpenMemoryAdapter();
    const beforeRec = adapter.create({ agent_id: 'u', type: 'episodic', content: 'orig' });
    if (beforeRec.data) {
      const migrated = adapter.create({ agent_id: 'u', type: 'episodic', content: 'new' });
      const r = new MigrationRollback();
      r.record([migrated.data!], [beforeRec.data], 'test');
      // Simulate migration by deleting the before record
      adapter.delete(beforeRec.data.id);
      expect(adapter.recordCount()).toBe(1);
      // Now undo restores the before record
      r.undo(adapter);
      expect(adapter.recordCount()).toBe(2);
    }
  });

  it('returns error on empty history', () => {
    const adapter = new OpenMemoryAdapter();
    const r = new MigrationRollback();
    const undo = r.undo(adapter);
    expect(undo.ok).toBe(false);
  });

  it('returns error for invalid index', () => {
    const adapter = new OpenMemoryAdapter();
    const r = new MigrationRollback();
    const undo = r.undo(adapter, 99);
    expect(undo.ok).toBe(false);
  });

  it('history returns all entries', () => {
    const r = new MigrationRollback();
    r.record([], [], 'a');
    r.record([], [], 'b');
    expect(r.history().length).toBe(2);
  });
});

describe('LettaAdapter', () => {
  it('postMessage + getMessages', () => {
    const adapter = new OpenMemoryAdapter();
    const la = new LettaAdapter(adapter);
    la.postMessage('u1', 'hello');
    la.postMessage('u1', 'world');
    const r = la.getMessages('u1');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBe(2);
  });

  it('replaceMemory removes old and adds new', () => {
    const adapter = new OpenMemoryAdapter();
    const la = new LettaAdapter(adapter);
    la.postMessage('u1', 'old');
    const r = la.replaceMemory('u1', 'old', 'new');
    expect(r.ok).toBe(true);
    expect(r.data?.removed).toBe(1);
    expect(r.data?.added).toBe(1);
    const msgs = la.getMessages('u1');
    expect(msgs.data?.length).toBe(1);
  });

  it('health returns ok', () => {
    const la = new LettaAdapter();
    expect(la.health().ok).toBe(true);
  });

  it('inner() exposes underlying adapter', () => {
    const adapter = new OpenMemoryAdapter();
    const la = new LettaAdapter(adapter);
    expect(la.inner()).toBe(adapter);
  });

  it('getMessages filters by agent_id', () => {
    const adapter = new OpenMemoryAdapter();
    const la = new LettaAdapter(adapter);
    la.postMessage('u1', 'a');
    la.postMessage('u2', 'b');
    const r = la.getMessages('u1');
    expect(r.data?.length).toBe(1);
  });
});

describe('MIGRATION_TOOLS + MigrationMasterIndex + Tracker + AuditLog', () => {
  it('MIGRATION_TOOLS lists 4 tools', () => {
    expect(MIGRATION_TOOLS.length).toBe(4);
    const names = MIGRATION_TOOLS.map(t => t.name);
    expect(names).toContain('Letta.import');
    expect(names).toContain('Letta.export');
    expect(names).toContain('Migration.diff');
    expect(names).toContain('Migration.validate');
  });

  it('MigrationMasterIndex list + count + has + const length', () => {
    const idx = new MigrationMasterIndex();
    expect(idx.list().length).toBe(15);
    expect(idx.count()).toBe(15);
    expect(idx.has('LettaImportParser')).toBe(true);
    expect(idx.has('Missing')).toBe(false);
    expect(MIGRATION_BATCH_6_ENGINES).toHaveLength(15);
  });

  it('MigrationTracker start + update + complete + list + get + clear', () => {
    const t = new MigrationTracker();
    const id = t.start('letta', 10);
    expect(t.list().length).toBe(1);
    t.update(id, { imported: 5 });
    expect(t.get(id)?.imported).toBe(5);
    t.complete(id, 9, 1);
    expect(t.get(id)?.status).toBe('completed');
    t.clear();
    expect(t.list().length).toBe(0);
  });

  it('MigrationTracker.update with no ID is no-op', () => {
    const t = new MigrationTracker();
    t.update('missing-id', { imported: 5 });
    expect(t.list().length).toBe(0);
  });

  it('MigrationTracker.fail sets status to failed', () => {
    const t = new MigrationTracker();
    const id = t.start('zep', 5);
    t.fail(id);
    expect(t.get(id)?.status).toBe('failed');
  });

  it('MigrationAuditLog.record + entries + forMigration + count + clear', () => {
    const a = new MigrationAuditLog();
    a.record('m1', 'start', { total: 10 });
    a.record('m1', 'import', { n: 5 });
    a.record('m2', 'start');
    expect(a.count()).toBe(3);
    expect(a.forMigration('m1').length).toBe(2);
    expect(a.entries().length).toBe(3);
    a.clear();
    expect(a.count()).toBe(0);
  });
});