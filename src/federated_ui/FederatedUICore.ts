// V5681-V5700: Federated Cohorts UI — visualize V9 federated primitives.
//
// Reuses the V9 engines (FederatedCohort / FederatedMemoryShare / PrivacyBudgetAggregator /
// PrivacyAudit / SecureChannel) by passing them into the visualization helpers. No V9
// engine code is touched — these are PURE adapter/visualization layer.
//
// 5 engines + 1 master index:
//   - CohortVisualizer          : hierarchical tree view of cohort + member tree
//   - MembershipGraph           : agent ↔ cohort bipartite graph with BFS reachability
//   - PrivacyBudgetChart        : budget consumption timeline + per-agent stacks
//   - AuditExplorer             : queryable audit log explorer with filters + timeline
//   - CohortReport              : markdown + CSV report over cohorts/audit/budget
//   - FederatedCohortsUIMasterIndex : batch 11/11 index
//
// All engines are pure TypeScript with deterministic behavior (no external deps).
// Reusable from MCP via 5 new tools (CohortUI.*) and exposed in CLI via
// `amm cohortui list| demo | tree | graph | audit | report`.

import type { FederatedCohort, Cohort } from '../federated/FederatedCore';
import type { PrivacyAudit, AuditEntry, AuditKind } from '../federated/FederatedCore';
import type { PrivacyBudgetAggregator, BudgetUsage } from '../federated/FederatedCore';
import type { FederatedMemoryShare } from '../federated/FederatedCore';

// V5681: CohortVisualizer — hierarchical tree view
export interface CohortTreeNode {
  id: string;
  label: string;
  members: CohortTreeMember[];
  depth: number;
  privacyLevel: string;
  meta: Record<string, unknown>;
}

export interface CohortTreeMember {
  agentId: string;
  isOwner: boolean;
}

export class CohortVisualizer {
  private _seq = 0;

  buildTree(cohorts: FederatedCohort): CohortTreeNode[] {
    const all = cohorts.list();
    const out: CohortTreeNode[] = [];
    for (const c of all) {
      this._seq += 1;
      const members: CohortTreeMember[] = Array.from(c.members).map((agentId) => ({
        agentId,
        isOwner: agentId === c.ownerAgentId,
      }));
      out.push({
        id: `tree_${this._seq}_${c.id}`,
        label: c.name,
        members,
        depth: 0,
        privacyLevel: c.privacyLevel,
        meta: { cohortId: c.id, owner: c.ownerAgentId, createdAt: c.createdAt },
      });
    }
    return out;
  }

  flatten(trees: CohortTreeNode[]): Array<{ depth: number; type: 'cohort' | 'member'; id: string; label: string }> {
    const out: Array<{ depth: number; type: 'cohort' | 'member'; id: string; label: string }> = [];
    for (const t of trees) {
      out.push({ depth: 0, type: 'cohort', id: t.id, label: t.label });
      for (const m of t.members) {
        out.push({ depth: 1, type: 'member', id: m.agentId, label: `${m.isOwner ? '★ ' : ''}${m.agentId}` });
      }
    }
    return out;
  }

  filterByPrivacy(trees: CohortTreeNode[], level: 'strict' | 'moderate' | 'open'): CohortTreeNode[] {
    return trees.filter((t) => t.privacyLevel === level);
  }

  byMember(trees: CohortTreeNode[], agentId: string): CohortTreeNode[] {
    return trees.filter((t) => t.members.some((m) => m.agentId === agentId));
  }

  countMembers(trees: CohortTreeNode[]): { totalMembers: number; uniqueAgents: number } {
    const seen = new Set<string>();
    let total = 0;
    for (const t of trees) {
      for (const m of t.members) {
        total += 1;
        seen.add(m.agentId);
      }
    }
    return { totalMembers: total, uniqueAgents: seen.size };
  }

  stats(): { calls: number } {
    return { calls: this._seq };
  }
}

// V5682: MembershipGraph — agent ↔ cohort bipartite graph
export interface GraphEdge {
  agentId: string;
  cohortId: string;
  isOwner: boolean;
}

export interface GraphStats {
  agents: number;
  cohorts: number;
  edges: number;
}

export class MembershipGraph {
  private _edges: Map<string, GraphEdge[]> = new Map(); // cohortId -> edges
  private _agentToCohorts: Map<string, Set<string>> = new Map(); // agentId -> cohort set

  build(cohorts: FederatedCohort): GraphEdge[] {
    this._edges.clear();
    this._agentToCohorts.clear();
    const all = cohorts.list();
    const out: GraphEdge[] = [];
    for (const c of all) {
      const edges: GraphEdge[] = [];
      for (const agentId of c.members) {
        const isOwner = agentId === c.ownerAgentId;
        edges.push({ agentId, cohortId: c.id, isOwner });
        out.push({ agentId, cohortId: c.id, isOwner });
        let set = this._agentToCohorts.get(agentId);
        if (!set) {
          set = new Set<string>();
          this._agentToCohorts.set(agentId, set);
        }
        set.add(c.id);
      }
      this._edges.set(c.id, edges);
    }
    return out;
  }

  cohortsForAgent(agentId: string): string[] {
    return Array.from(this._agentToCohorts.get(agentId) ?? []);
  }

  agentsForCohort(cohortId: string): GraphEdge[] {
    return this._edges.get(cohortId)?.slice() ?? [];
  }

  /** BFS reachability between two agents through shared cohorts */
  reachable(fromAgent: string, toAgent: string): boolean {
    if (fromAgent === toAgent) return true;
    const visited = new Set<string>([fromAgent]);
    const queue = [fromAgent];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const cohorts = this.cohortsForAgent(cur);
      for (const cohortId of cohorts) {
        const edges = this.agentsForCohort(cohortId);
        for (const e of edges) {
          if (e.agentId === toAgent) return true;
          if (!visited.has(e.agentId)) {
            visited.add(e.agentId);
            queue.push(e.agentId);
          }
        }
      }
    }
    return false;
  }

  stats(): GraphStats {
    let total = 0;
    for (const arr of this._edges.values()) total += arr.length;
    return { agents: this._agentToCohorts.size, cohorts: this._edges.size, edges: total };
  }

  reset(): void {
    this._edges.clear();
    this._agentToCohorts.clear();
  }
}

// V5683: PrivacyBudgetChart — budget consumption chart data
export interface BudgetChartPoint {
  agentId: string;
  totalBudget: number;
  consumed: number;
  remaining: number;
  utilization: number; // 0..1
}

export class PrivacyBudgetChart {
  buildStacks(budgets: PrivacyBudgetAggregator): BudgetChartPoint[] {
    const out: BudgetChartPoint[] = [];
    for (const u of budgets.list()) {
      const remaining = u.budgetTotal - u.budgetConsumed;
      const utilization = u.budgetTotal === 0 ? 0 : u.budgetConsumed / u.budgetTotal;
      out.push({
        agentId: u.agentId,
        totalBudget: u.budgetTotal,
        consumed: u.budgetConsumed,
        remaining,
        utilization,
      });
    }
    return out.sort((a, b) => b.utilization - a.utilization);
  }

  asSvgBars(points: BudgetChartPoint[], width = 100): string {
    const lines: string[] = [];
    const max = Math.max(1, ...points.map((p) => p.totalBudget));
    for (const p of points) {
      const used = Math.round((p.consumed / max) * width);
      const total = Math.round((p.totalBudget / max) * width);
      lines.push(`${p.agentId.padEnd(12)} ${'█'.repeat(used)}${'░'.repeat(Math.max(0, total - used))} ${(p.utilization * 100).toFixed(0)}%`);
    }
    return lines.join('\n');
  }

  topConsumers(budgets: PrivacyBudgetAggregator, n: number): BudgetChartPoint[] {
    return this.buildStacks(budgets).slice(0, n);
  }

  warnThresholds(points: BudgetChartPoint[], threshold = 0.8): BudgetChartPoint[] {
    return points.filter((p) => p.utilization >= threshold);
  }

  summary(points: BudgetChartPoint[]): { agents: number; avgUtilization: number; maxUtilization: number; totalRemaining: number } {
    if (points.length === 0) return { agents: 0, avgUtilization: 0, maxUtilization: 0, totalRemaining: 0 };
    let avg = 0;
    let maxU = 0;
    let totalRem = 0;
    for (const p of points) {
      avg += p.utilization;
      if (p.utilization > maxU) maxU = p.utilization;
      totalRem += p.remaining;
    }
    return { agents: points.length, avgUtilization: avg / points.length, maxUtilization: maxU, totalRemaining: totalRem };
  }
}

// V5684: AuditExplorer — queryable audit explorer
export interface AuditTimelineBucket {
  ts: number;
  count: number;
  kinds: Record<string, number>;
}

export class AuditExplorer {
  timeline(audit: PrivacyAudit, bucketMs = 60000): AuditTimelineBucket[] {
    const entries = audit.query();
    if (entries.length === 0) return [];
    const min = entries[0].ts;
    const max = entries[entries.length - 1].ts;
    const count = Math.max(1, Math.ceil((max - min) / bucketMs));
    const buckets: AuditTimelineBucket[] = [];
    for (let i = 0; i < count; i += 1) {
      buckets.push({ ts: min + i * bucketMs, count: 0, kinds: {} });
    }
    for (const e of entries) {
      const idx = Math.min(count - 1, Math.floor((e.ts - min) / bucketMs));
      buckets[idx].count += 1;
      buckets[idx].kinds[e.kind] = (buckets[idx].kinds[e.kind] ?? 0) + 1;
    }
    return buckets;
  }

  byKind(audit: PrivacyAudit): Record<AuditKind, number> {
    const all = audit.query();
    const out = {} as Record<AuditKind, number>;
    for (const e of all) {
      out[e.kind] = (out[e.kind] ?? 0) + 1;
    }
    return out;
  }

  byAgent(audit: PrivacyAudit): Record<string, number> {
    const all = audit.query();
    const out: Record<string, number> = {};
    for (const e of all) {
      out[e.agentId] = (out[e.agentId] ?? 0) + 1;
    }
    return out;
  }

  filteredView(audit: PrivacyAudit, filter: { kinds?: AuditKind[]; cohortId?: string; agentIds?: string[]; since?: number } = {}): AuditEntry[] {
    return audit.query({
      kind: filter.kinds && filter.kinds.length === 1 ? filter.kinds[0] : undefined,
      cohortId: filter.cohortId,
      since: filter.since,
    }).filter((e) => !filter.agentIds || filter.agentIds.includes(e.agentId));
  }

  stats(audit: PrivacyAudit): { total: number; firstTs: number | null; lastTs: number | null } {
    const all = audit.query();
    if (all.length === 0) return { total: 0, firstTs: null, lastTs: null };
    return { total: all.length, firstTs: all[0].ts, lastTs: all[all.length - 1].ts };
  }
}

// V5685: CohortReport — markdown + CSV report
export class CohortReport {
  markdown(title: string, sections: { heading: string; lines: string[] }[]): string {
    const out: string[] = [`# ${title}`, ''];
    for (const s of sections) {
      out.push(`## ${s.heading}`, '');
      for (const l of s.lines) out.push(`- ${l}`);
      out.push('');
    }
    return out.join('\n');
  }

  csv(rows: Array<Record<string, unknown>>, columns: string[]): string {
    if (rows.length === 0) return columns.join(',');
    const header = columns.join(',');
    const body = rows.map((r) => columns.map((c) => this._csvValue(r[c])).join(',')).join('\n');
    return `${header}\n${body}`;
  }

  cohortSection(cohorts: FederatedCohort): { heading: string; lines: string[] } {
    const all = cohorts.list();
    return {
      heading: 'Cohorts',
      lines: all.map((c) => `Cohort **${c.name}** (${c.privacyLevel}) — owner: ${c.ownerAgentId}, members: ${c.members.size}`),
    };
  }

  budgetSection(budgets: PrivacyBudgetAggregator): { heading: string; lines: string[] } {
    const all = budgets.list();
    return {
      heading: 'Privacy Budgets',
      lines: all.map((u) => `Agent **${u.agentId}** — ${u.budgetConsumed}/${u.budgetTotal} consumed (${u.budgetTotal > 0 ? ((u.budgetConsumed / u.budgetTotal) * 100).toFixed(1) : '0'}%)`),
    };
  }

  auditSection(audit: PrivacyAudit, limit = 10): { heading: string; lines: string[] } {
    const recent = audit.recent(limit);
    return {
      heading: `Recent Audit (last ${limit})`,
      lines: recent.map((e) => `\`${e.kind}\` agent:${e.agentId} cohort:${e.cohortId}${e.reason ? ' reason:' + e.reason : ''}`),
    };
  }

  private _csvValue(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
}

// V5686: FederatedCohortsUIMasterIndex — batch 11/11 index
export const FEDERATED_UI_ENGINES = [
  'CohortVisualizer',
  'MembershipGraph',
  'PrivacyBudgetChart',
  'AuditExplorer',
  'CohortReport',
  'FederatedCohortsUIMasterIndex',
];

export class FederatedCohortsUIMasterIndex {
  private _items: Array<{ name: string; layer: string; version: string }> = [];

  constructor() {
    for (const name of FEDERATED_UI_ENGINES) {
      this._items.push({ name, layer: 'federated_ui', version: 'V5681+' });
    }
  }

  list(): Array<{ name: string; layer: string; version: string }> {
    return this._items.slice();
  }

  count(): number {
    return this._items.length;
  }

  byName(name: string): { name: string; layer: string; version: string } | undefined {
    return this._items.find((i) => i.name === name);
  }
}

// MCP tool descriptors (5 new tools)
export const COHORT_UI_TOOLS = [
  {
    name: 'CohortVisualizer.buildTree',
    description: 'Build a hierarchical cohort tree visualization',
    inputSchema: { type: 'object', properties: { cohortId: { type: 'string', description: 'Specific cohort id (optional, omit for all)' } }, required: [] },
  },
  {
    name: 'MembershipGraph.stats',
    description: 'Get the membership graph statistics (agents/cohorts/edges)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'PrivacyBudgetChart.summary',
    description: 'Get the privacy budget summary (avg/max utilization + remaining)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'AuditExplorer.byKind',
    description: 'Count audit entries grouped by kind (share/read/deny/etc)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'CohortReport.markdown',
    description: 'Generate a markdown cohort report',
    inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'Report title' } }, required: [] },
  },
] as const;
