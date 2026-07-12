// V5596-V5610: Memory Migration Tool — convert between Letta and agent-memory-marketplace formats.
//
// Implements a 15-engine toolkit for migrating memory between systems:
// - LettaImportParser: parse Letta JSON export (with multi-format support)
// - LettaExporter: serialize marketplace records to Letta format
// - MemoryMigrator: cross-format migration (Letta / Cognee / Zep / native)
// - FormatConverter: convert between JSON/YAML/TOML/markdown
// - SchemaMapper: field-by-field mapping between schemas
// - BatchImporter: bulk import with progress tracking
// - ImportValidator: validate imported records against schema
// - ImportReport: generate markdown report of import
// - MigrationDiff: diff two memory stores
// - MigrationRollback: rollback a migration
// - LettaAdapter: wrap OpenMemoryAdapter as Letta-compatible
// - LettaMCPExporter: expose migration as MCP tool
// - MigrationMasterIndex: index of migration batch
// - MigrationTracker: track active migrations
// - MigrationAuditLog: audit log for compliance

import { OpenMemoryAdapter, type MemoryRecord, type OpenMemoryResponse } from '../mcp/OpenMemoryAdapter';

// V5596: LettaImportParser — parses Letta JSON exports
export interface LettaRecord {
  id?: string;
  agent_id?: string;
  agentId?: string;
  type?: string;
  text?: string;
  content?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  importance?: number;
  created_at?: string;
  createdAt?: string;
  timestamp?: number;
}

export interface ParsedLettaExport {
  agents?: LettaRecord[];
  records?: LettaRecord[];
  messages?: LettaRecord[];
  memories?: LettaRecord[];
  items?: LettaRecord[];
  data?: LettaRecord[];
}

export class LettaImportParser {
  parse(json: string): OpenMemoryResponse<MemoryRecord[]> {
    try {
      const data = JSON.parse(json) as ParsedLettaExport | LettaRecord[];
      const records = this._extractRecords(data);
      const mapped = records.map((r, i) => this._mapToRecord(r, i));
      return { ok: true, data: mapped, meta: { total: mapped.length } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private _extractRecords(data: ParsedLettaExport | LettaRecord[]): LettaRecord[] {
    if (Array.isArray(data)) return data;
    if (data.records && Array.isArray(data.records)) return data.records;
    if (data.agents && Array.isArray(data.agents)) return data.agents;
    if (data.messages && Array.isArray(data.messages)) return data.messages;
    if (data.memories && Array.isArray(data.memories)) return data.memories;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }

  private _mapToRecord(r: LettaRecord, idx: number): MemoryRecord {
    const id = r.id ?? `letta_${Date.now()}_${idx}`;
    const agent = r.agent_id ?? r.agentId ?? 'unknown';
    const rawType = (r.type ?? 'episodic').toLowerCase();
    const type: MemoryRecord['type'] = ['episodic', 'semantic', 'procedural', 'long-term', 'short-term', 'working', 'associative'].includes(rawType)
      ? rawType as MemoryRecord['type']
      : 'episodic';
    const content = r.text ?? r.content ?? r.message ?? '';
    const createdAt = r.created_at
      ? Date.parse(r.created_at)
      : r.createdAt
        ? Date.parse(r.createdAt)
        : r.timestamp ?? Date.now();
    return {
      id,
      agent_id: agent,
      type,
      content,
      metadata: r.metadata,
      created_at: createdAt,
      importance: r.importance,
    };
  }
}

// V5597: LettaExporter — serialize marketplace records to Letta format
export class LettaExporter {
  private _records: MemoryRecord[] = [];

  add(record: MemoryRecord): void {
    this._records.push(record);
  }

  addAll(records: MemoryRecord[]): void {
    this._records.push(...records);
  }

  count(): number {
    return this._records.length;
  }

  // Letta format uses snake_case + agent_id + text + created_at fields
  toLettaJSON(): string {
    const letta = this._records.map(r => ({
      id: r.id,
      agent_id: r.agent_id,
      type: r.type,
      text: r.content,
      metadata: r.metadata,
      created_at: new Date(r.created_at).toISOString(),
      importance: r.importance,
    }));
    return JSON.stringify({ records: letta, version: '1.0' }, null, 2);
  }

  // Zep format
  toZepJSON(): string {
    const zep = this._records.map(r => ({
      session_id: r.agent_id,
      role: 'user',
      content: r.content,
      metadata: { type: r.type, importance: r.importance, ...r.metadata },
      created_at: new Date(r.created_at).toISOString(),
    }));
    return JSON.stringify({ messages: zep, version: '1.0' }, null, 2);
  }

  // Cognee format
  toCogneeJSON(): string {
    const cognee = this._records.map(r => ({
      type: r.type,
      text: r.content,
      metadata: { agent_id: r.agent_id, ...r.metadata },
      created_at: new Date(r.created_at).toISOString(),
    }));
    return JSON.stringify({ data: cognee, version: '1.0' }, null, 2);
  }

  // Markdown report
  toMarkdown(): string {
    const lines: string[] = ['# Memory Export', '', `Total: ${this._records.length}`, ''];
    for (const r of this._records) {
      lines.push(`## ${r.id}`, '', `- Type: ${r.type}`, `- Agent: ${r.agent_id}`, `- Created: ${new Date(r.created_at).toISOString()}`, `- Importance: ${r.importance ?? '—'}`, '');
      lines.push(r.content);
      lines.push('');
    }
    return lines.join('\n');
  }

  clear(): void {
    this._records = [];
  }
}

// V5598: MemoryMigrator — orchestrator
export interface MigrationResult {
  ok: boolean;
  imported: number;
  failed: number;
  durationMs: number;
  errors: Array<{ index: number; reason: string }>;
}

export class MemoryMigrator {
  private _source: string = '';
  private _target: OpenMemoryAdapter;
  private _agentFilter: string | null = null;

  constructor(adapter?: OpenMemoryAdapter) {
    this._target = adapter ?? new OpenMemoryAdapter();
  }

  setSource(label: string): void {
    this._source = label;
  }

  filterByAgent(agent: string): void {
    this._agentFilter = agent;
  }

  async migrateFromJSON(json: string, source: 'letta' | 'zep' | 'cognee' | 'native'): Promise<MigrationResult> {
    const start = Date.now();
    let records: MemoryRecord[] = [];

    if (source === 'letta') {
      const parser = new LettaImportParser();
      const r = parser.parse(json);
      if (!r.ok || !r.data) {
        return { ok: false, imported: 0, failed: 0, durationMs: Date.now() - start, errors: [{ index: 0, reason: r.error ?? 'parse failed' }] };
      }
      records = r.data;
    } else if (source === 'native') {
      try {
        const data = JSON.parse(json);
        if (Array.isArray(data)) records = data;
        else if (data.records) records = data.records;
        else if (Array.isArray(data.data)) records = data.data;
      } catch (err) {
        return { ok: false, imported: 0, failed: 0, durationMs: Date.now() - start, errors: [{ index: 0, reason: String(err) }] };
      }
    } else {
      // For zep/cognee, simple conversion via parser
      const parser = new LettaImportParser();
      const r = parser.parse(json);
      records = r.data ?? [];
    }

    if (this._agentFilter) {
      records = records.filter(r => r.agent_id === this._agentFilter);
    }

    const errors: Array<{ index: number; reason: string }> = [];
    let imported = 0;
    let failed = 0;
    for (let i = 0; i < records.length; i++) {
      const r = this._target.create({
        agent_id: records[i].agent_id,
        type: records[i].type,
        content: records[i].content,
        metadata: records[i].metadata,
        importance: records[i].importance,
      });
      if (r.ok) imported += 1;
      else { failed += 1; errors.push({ index: i, reason: r.error ?? 'unknown' }); }
    }
    return { ok: failed === 0, imported, failed, durationMs: Date.now() - start, errors };
  }

  target(): OpenMemoryAdapter {
    return this._target;
  }

  sourceLabel(): string {
    return this._source;
  }
}

// V5599: FormatConverter — JSON <-> YAML/TOML/Markdown
export class FormatConverter {
  toJSON(input: string): OpenMemoryResponse<unknown> {
    try {
      return { ok: true, data: JSON.parse(input) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Convert JSON to simple YAML
  toYAML(obj: unknown, indent = 0): string {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
      return obj.map(v => ' '.repeat(indent + 2) + '- ' + this.toYAML(v, indent + 2)).join('\n');
    }
    if (typeof obj === 'object') {
      const lines: string[] = [];
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        lines.push(' '.repeat(indent) + `${k}: ${this.toYAML(v, indent + 2)}`);
      }
      return lines.join('\n');
    }
    return String(obj);
  }

  toTOML(obj: unknown): string {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
    const lines: string[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') lines.push(`${k} = ${JSON.stringify(v)}`);
      else if (typeof v === 'number' || typeof v === 'boolean') lines.push(`${k} = ${v}`);
      else if (Array.isArray(v)) lines.push(`${k} = ${JSON.stringify(v)}`);
      else if (typeof v === 'object') lines.push(`[${k}]\n${this.toTOML(v)}`);
    }
    return lines.join('\n');
  }

  recordsToCSV(records: MemoryRecord[]): string {
    const header = 'id,agent_id,type,content,importance,created_at';
    const rows = records.map(r =>
      [r.id, r.agent_id, r.type, JSON.stringify(r.content), r.importance ?? '', new Date(r.created_at).toISOString()].join(',')
    );
    return [header, ...rows].join('\n');
  }

  csvToRecords(csv: string): OpenMemoryResponse<MemoryRecord[]> {
    try {
      const lines = csv.split('\n').filter(l => l.length > 0);
      if (lines.length === 0) return { ok: true, data: [] };
      const header = lines[0].split(',');
      const records: MemoryRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = this._splitCSVLine(lines[i]);
        const r: Record<string, string> = {};
        for (let j = 0; j < header.length; j++) {
          r[header[j]] = cells[j] ?? '';
        }
        records.push({
          id: r['id'] ?? `csv_${i}`,
          agent_id: r['agent_id'] ?? 'csv',
          type: (['episodic', 'semantic', 'procedural', 'long-term', 'short-term', 'working', 'associative'].includes(r['type']) ? r['type'] : 'episodic') as MemoryRecord['type'],
          content: this._unquote(r['content'] ?? ''),
          importance: r['importance'] ? Number(r['importance']) : undefined,
          created_at: r['created_at'] ? Date.parse(r['created_at']) : Date.now(),
        });
      }
      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private _splitCSVLine(line: string): string[] {
    const cells: string[] = [];
    let buf = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { buf += '"'; i += 1; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(buf); buf = '';
      } else buf += ch;
    }
    cells.push(buf);
    return cells;
  }

  private _unquote(s: string): string {
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    return s;
  }
}

// V5600: SchemaMapper
export class SchemaMapper {
  private _mappings: Map<string, Map<string, string>> = new Map();

  define(source: string, mapping: Record<string, string>): void {
    let m = this._mappings.get(source);
    if (!m) {
      m = new Map();
      this._mappings.set(source, m);
    }
    for (const [from, to] of Object.entries(mapping)) {
      m.set(from, to);
    }
  }

  map(source: string, obj: Record<string, unknown>): Record<string, unknown> {
    const m = this._mappings.get(source);
    if (!m) return obj;
    const out: Record<string, unknown> = {};
    for (const [from, to] of m.entries()) {
      if (from in obj) out[to] = obj[from];
    }
    // Pass through unmapped fields
    for (const [k, v] of Object.entries(obj)) {
      if (!m.has(k) && !(m.get(k) in out)) out[k] = v;
    }
    return out;
  }

  has(source: string): boolean {
    return this._mappings.has(source);
  }

  fields(source: string): string[] {
    return [...(this._mappings.get(source)?.keys() ?? [])];
  }
}

// V5601: BatchImporter — bulk import with progress
export class BatchImporter {
  private _batches: Array<{ ts: number; source: string; imported: number; failed: number }> = [];

  importBatch(adapter: OpenMemoryAdapter, records: MemoryRecord[], batchSize = 100): { imported: number; failed: number; progress: number } {
    let imported = 0;
    let failed = 0;
    let processed = 0;
    for (const r of records) {
      const res = adapter.create({
        agent_id: r.agent_id,
        type: r.type,
        content: r.content,
        metadata: r.metadata,
        importance: r.importance,
      });
      if (res.ok) imported += 1;
      else failed += 1;
      processed += 1;
    }
    this._batches.push({ ts: Date.now(), source: 'batch', imported, failed });
    return { imported, failed, progress: 1.0 };
  }

  batches(): Array<{ ts: number; source: string; imported: number; failed: number }> {
    return [...this._batches];
  }

  totalImported(): number {
    return this._batches.reduce((s, b) => s + b.imported, 0);
  }
}

// V5602: ImportValidator
export class ImportValidator {
  private _errors: Array<{ index: number; reason: string }> = [];

  validate(records: MemoryRecord[]): { ok: boolean; valid: number; invalid: number } {
    this._errors = [];
    let valid = 0;
    let invalid = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const reasons: string[] = [];
      if (!r.id) reasons.push('missing id');
      if (!r.agent_id) reasons.push('missing agent_id');
      if (!r.type) reasons.push('missing type');
      if (!r.content) reasons.push('missing content');
      if (r.created_at && (r.created_at < 0 || r.created_at > Date.now() + 86400000)) reasons.push('invalid created_at');
      if (reasons.length === 0) valid += 1;
      else { invalid += 1; this._errors.push({ index: i, reason: reasons.join('; ') }); }
    }
    return { ok: invalid === 0, valid, invalid };
  }

  errors(): Array<{ index: number; reason: string }> {
    return [...this._errors];
  }
}

// V5603: ImportReport — markdown report of import
export class ImportReport {
  generate(imported: number, failed: number, durationMs: number, errors: Array<{ index: number; reason: string }>, source: string): string {
    const lines: string[] = [
      '# Import Report',
      '',
      `- Source: ${source}`,
      `- Imported: ${imported}`,
      `- Failed: ${failed}`,
      `- Duration: ${durationMs}ms`,
      `- Status: ${failed === 0 ? '✅ SUCCESS' : '⚠️ PARTIAL'}`,
      '',
    ];
    if (errors.length > 0) {
      lines.push('## Errors', '');
      for (const e of errors.slice(0, 50)) {
        lines.push(`- **Index ${e.index}**: ${e.reason}`);
      }
      if (errors.length > 50) lines.push(`- ... and ${errors.length - 50} more`);
    }
    return lines.join('\n');
  }
}

// V5604: MigrationDiff — diff two memory stores
export interface MigrationDiff {
  added: MemoryRecord[];
  removed: MemoryRecord[];
  changed: Array<{ before: MemoryRecord; after: MemoryRecord }>;
  unchanged: number;
}

export class MigrationDiffEngine {
  diff(before: MemoryRecord[], after: MemoryRecord[]): MigrationDiff {
    const beforeById = new Map(before.map(r => [r.id, r]));
    const afterById = new Map(after.map(r => [r.id, r]));
    const added: MemoryRecord[] = [];
    const removed: MemoryRecord[] = [];
    const changed: Array<{ before: MemoryRecord; after: MemoryRecord }> = [];
    let unchanged = 0;

    for (const [id, afterRec] of afterById.entries()) {
      const beforeRec = beforeById.get(id);
      if (!beforeRec) {
        added.push(afterRec);
      } else if (JSON.stringify(beforeRec) !== JSON.stringify(afterRec)) {
        changed.push({ before: beforeRec, after: afterRec });
      } else {
        unchanged += 1;
      }
    }
    for (const [id, beforeRec] of beforeById.entries()) {
      if (!afterById.has(id)) {
        removed.push(beforeRec);
      }
    }
    return { added, removed, changed, unchanged };
  }

  summarize(diff: MigrationDiff): string {
    return `Migration diff: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed, ${diff.unchanged} unchanged`;
  }
}

// V5605: MigrationRollback — undo a migration
export interface RollbackRecord {
  ts: number;
  migrated: MemoryRecord[];
  beforeSnapshot: MemoryRecord[];
  source: string;
}

export class MigrationRollback {
  private _history: RollbackRecord[] = [];

  record(migrated: MemoryRecord[], beforeSnapshot: MemoryRecord[], source: string): void {
    this._history.push({ ts: Date.now(), migrated, beforeSnapshot, source });
  }

  undo(adapter: OpenMemoryAdapter, index?: number): OpenMemoryResponse<{ removed: number }> {
    if (this._history.length === 0) {
      return { ok: false, error: 'No rollback history' };
    }
    const idx = index ?? this._history.length - 1;
    const record = this._history[idx];
    if (!record) {
      return { ok: false, error: `No rollback at index ${idx}` };
    }
    // Delete migrated records
    let removed = 0;
    for (const r of record.migrated) {
      const res = adapter.delete(r.id);
      if (res.ok) removed += 1;
    }
    // Restore before-snapshot (only ones that don't exist anymore)
    for (const r of record.beforeSnapshot) {
      const existing = adapter.get(r.id);
      if (!existing.ok) {
        adapter.create({
          agent_id: r.agent_id,
          type: r.type,
          content: r.content,
          metadata: r.metadata,
          importance: r.importance,
        });
      }
    }
    return { ok: true, data: { removed } };
  }

  history(): RollbackRecord[] {
    return [...this._history];
  }

  size(): number {
    return this._history.length;
  }
}

// V5606: LettaAdapter — wraps OpenMemoryAdapter as Letta-compatible
export class LettaAdapter {
  private _adapter: OpenMemoryAdapter;
  private _version = '1.0';

  constructor(adapter?: OpenMemoryAdapter) {
    this._adapter = adapter ?? new OpenMemoryAdapter();
  }

  // Letta POST /v1/agents/messages
  postMessage(agentId: string, message: string): OpenMemoryResponse<MemoryRecord> {
    return this._adapter.create({
      agent_id: agentId,
      type: 'episodic',
      content: message,
    });
  }

  // Letta GET /v1/agents/:id/messages
  getMessages(agentId: string, limit = 50): OpenMemoryResponse<MemoryRecord[]> {
    const r = this._adapter.list({ agent_id: agentId, limit });
    if (!r.ok || !r.data) return r;
    // Letta expects role + content + timestamp fields
    return { ok: true, data: r.data.map(m => ({ ...m, content: m.content })) };
  }

  // Letta POST /v1/agents/memory/replace
  replaceMemory(agentId: string, oldContent: string, newContent: string): OpenMemoryResponse<{ removed: number; added: number }> {
    const all = this._adapter.list({ agent_id: agentId });
    let removed = 0;
    if (all.ok && all.data) {
      for (const r of all.data) {
        if (r.content === oldContent) {
          this._adapter.delete(r.id);
          removed += 1;
        }
      }
    }
    this._adapter.create({
      agent_id: agentId,
      type: 'episodic',
      content: newContent,
    });
    return { ok: true, data: { removed, added: 1 } };
  }

  // Letta GET /v1/health
  health(): OpenMemoryResponse<{ version: string; status: string }> {
    return { ok: true, data: { version: this._version, status: 'ok' } };
  }

  // Get underlying adapter for direct access
  inner(): OpenMemoryAdapter {
    return this._adapter;
  }
}

// V5607: LettaMCPExporter — exposes migration as MCP tool (extension to MCPServer)
export interface MCPMigrationTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const MIGRATION_TOOLS: MCPMigrationTool[] = [
  {
    name: 'Letta.import',
    description: 'Import memories from a Letta JSON export into the marketplace adapter.',
    inputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'Letta JSON export' },
        agentId: { type: 'string', description: 'Filter by agent_id (optional)' },
      },
      required: ['json'],
    },
  },
  {
    name: 'Letta.export',
    description: 'Export marketplace memories to Letta JSON format.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Filter by agent_id (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'Migration.diff',
    description: 'Diff two memory store snapshots to detect changes.',
    inputSchema: {
      type: 'object',
      properties: {
        before: { type: 'string', description: 'JSON array of before records' },
        after: { type: 'string', description: 'JSON array of after records' },
      },
      required: ['before', 'after'],
    },
  },
  {
    name: 'Migration.validate',
    description: 'Validate an array of records against the marketplace schema.',
    inputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'JSON array of records' },
      },
      required: ['json'],
    },
  },
];

// V5608: MigrationMasterIndex
export const MIGRATION_BATCH_6_ENGINES = [
  'LettaImportParser', 'LettaExporter', 'MemoryMigrator', 'FormatConverter',
  'SchemaMapper', 'BatchImporter', 'ImportValidator', 'ImportReport',
  'MigrationDiffEngine', 'MigrationRollback', 'LettaAdapter', 'LettaMCPExporter',
  'MigrationMasterIndex', 'MigrationTracker', 'MigrationAuditLog',
] as const;

export class MigrationMasterIndex {
  list(): string[] {
    return [...MIGRATION_BATCH_6_ENGINES];
  }
  count(): number {
    return MIGRATION_BATCH_6_ENGINES.length;
  }
  has(name: string): boolean {
    return MIGRATION_BATCH_6_ENGINES.includes(name as typeof MIGRATION_BATCH_6_ENGINES[number]);
  }
}

// V5609: MigrationTracker — track active migrations
export interface ActiveMigration {
  id: string;
  source: string;
  startedAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  imported: number;
  failed: number;
  total: number;
}

export class MigrationTracker {
  private _active: Map<string, ActiveMigration> = new Map();

  start(source: string, total: number): string {
    const id = `mig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this._active.set(id, {
      id, source, startedAt: Date.now(), status: 'running', imported: 0, failed: 0, total,
    });
    return id;
  }

  update(id: string, patch: Partial<ActiveMigration>): void {
    const cur = this._active.get(id);
    if (cur) this._active.set(id, { ...cur, ...patch });
  }

  complete(id: string, imported: number, failed: number): void {
    this.update(id, { status: 'completed', imported, failed });
  }

  fail(id: string): void {
    this.update(id, { status: 'failed' });
  }

  get(id: string): ActiveMigration | null {
    return this._active.get(id) ?? null;
  }

  list(): ActiveMigration[] {
    return [...this._active.values()];
  }

  clear(): void {
    this._active.clear();
  }
}

// V5610: MigrationAuditLog
export interface MigrationAuditEntry {
  ts: number;
  migrationId: string;
  action: 'start' | 'import' | 'fail' | 'rollback' | 'complete';
  details: Record<string, unknown>;
}

export class MigrationAuditLog {
  private _entries: MigrationAuditEntry[] = [];

  record(migrationId: string, action: MigrationAuditEntry['action'], details: Record<string, unknown> = {}): void {
    this._entries.push({ ts: Date.now(), migrationId, action, details });
  }

  entries(): MigrationAuditEntry[] {
    return [...this._entries];
  }

  forMigration(id: string): MigrationAuditEntry[] {
    return this._entries.filter(e => e.migrationId === id);
  }

  count(): number {
    return this._entries.length;
  }

  clear(): void {
    this._entries = [];
  }
}