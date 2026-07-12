// V5681-V5700: Federated Cohorts UI tests

import { describe, it, expect } from 'vitest';
import {
  CohortVisualizer,
  MembershipGraph,
  PrivacyBudgetChart,
  AuditExplorer,
  CohortReport,
  FederatedCohortsUIMasterIndex,
  FEDERATED_UI_ENGINES,
  COHORT_UI_TOOLS,
} from './FederatedUICore';
import { FederatedCohort, PrivacyBudgetAggregator, PrivacyAudit } from '../federated/FederatedCore';

const setup = () => {
  const cohorts = new FederatedCohort();
  const budgets = new PrivacyBudgetAggregator();
  const audit = new PrivacyAudit();
  const c1 = cohorts.create('alpha', 'agent-1', 'moderate');
  const c2 = cohorts.create('beta', 'agent-2', 'strict');
  cohorts.addMember(c1.id, 'agent-2');
  cohorts.addMember(c2.id, 'agent-1');
  budgets.setBudget('agent-1', 10);
  budgets.setBudget('agent-2', 10);
  budgets.consume('agent-1', 6);
  budgets.consume('agent-2', 3);
  audit.record({ kind: 'share', agentId: 'agent-1', cohortId: c1.id });
  audit.record({ kind: 'read', agentId: 'agent-2', cohortId: c1.id });
  audit.record({ kind: 'deny', agentId: 'stranger', cohortId: c1.id, reason: 'no_access' });
  return { cohorts, budgets, audit, c1, c2 };
};

describe('CohortVisualizer', () => {
  it('buildTree returns one node per cohort with members', () => {
    const v = new CohortVisualizer();
    const { cohorts } = setup();
    const trees = v.buildTree(cohorts);
    expect(trees.length).toBe(2);
    expect(trees[0].members.length).toBeGreaterThanOrEqual(1);
  });

  it('flatten emits cohort + member entries', () => {
    const v = new CohortVisualizer();
    const { cohorts } = setup();
    const trees = v.buildTree(cohorts);
    const flat = v.flatten(trees);
    expect(flat.length).toBeGreaterThan(2);
    expect(flat[0].type).toBe('cohort');
    expect(flat[1].type).toBe('member');
  });

  it('filterByPrivacy returns only matching level', () => {
    const v = new CohortVisualizer();
    const { cohorts } = setup();
    const trees = v.buildTree(cohorts);
    expect(v.filterByPrivacy(trees, 'strict').length).toBe(1);
    expect(v.filterByPrivacy(trees, 'moderate').length).toBe(1);
  });

  it('byMember returns cohorts containing an agent', () => {
    const v = new CohortVisualizer();
    const { cohorts } = setup();
    const trees = v.buildTree(cohorts);
    expect(v.byMember(trees, 'agent-1').length).toBe(2);
    expect(v.byMember(trees, 'stranger').length).toBe(0);
  });

  it('countMembers reports total + unique', () => {
    const v = new CohortVisualizer();
    const { cohorts } = setup();
    const trees = v.buildTree(cohorts);
    const s = v.countMembers(trees);
    expect(s.totalMembers).toBe(4);  // alpha: agent-1+agent-2, beta: agent-2+agent-1
    expect(s.uniqueAgents).toBe(2);
  });

  it('stats counts calls', () => {
    const v = new CohortVisualizer();
    const { cohorts } = setup();
    v.buildTree(cohorts);
    v.buildTree(cohorts);
    expect(v.stats().calls).toBeGreaterThanOrEqual(2);
  });
});

describe('MembershipGraph', () => {
  it('build returns edges for every member', () => {
    const g = new MembershipGraph();
    const { cohorts } = setup();
    const edges = g.build(cohorts);
    expect(edges.length).toBe(4);
  });

  it('cohortsForAgent returns matching cohorts', () => {
    const g = new MembershipGraph();
    const { cohorts } = setup();
    g.build(cohorts);
    expect(g.cohortsForAgent('agent-1').length).toBe(2);
    expect(g.cohortsForAgent('stranger').length).toBe(0);
  });

  it('agentsForCohort returns member edges', () => {
    const g = new MembershipGraph();
    const { cohorts, c1 } = setup();
    g.build(cohorts);
    const edges = g.agentsForCohort(c1.id);
    expect(edges.length).toBe(2);
    expect(edges.some((e) => e.isOwner)).toBe(true);
  });

  it('reachable BFS finds reachable agents', () => {
    const g = new MembershipGraph();
    const { cohorts } = setup();
    g.build(cohorts);
    expect(g.reachable('agent-1', 'agent-2')).toBe(true);
    expect(g.reachable('agent-1', 'agent-1')).toBe(true);
    expect(g.reachable('agent-1', 'stranger')).toBe(false);
  });

  it('stats counts agents/cohorts/edges', () => {
    const g = new MembershipGraph();
    const { cohorts } = setup();
    g.build(cohorts);
    const s = g.stats();
    expect(s.agents).toBe(2);
    expect(s.cohorts).toBe(2);
    expect(s.edges).toBe(4);
  });

  it('reset clears state', () => {
    const g = new MembershipGraph();
    const { cohorts } = setup();
    g.build(cohorts);
    g.reset();
    expect(g.stats().agents).toBe(0);
  });
});

describe('PrivacyBudgetChart', () => {
  it('buildStacks reports agent budgets with utilization', () => {
    const c = new PrivacyBudgetChart();
    const { budgets } = setup();
    const points = c.buildStacks(budgets);
    expect(points.length).toBe(2);
    const a1 = points.find((p) => p.agentId === 'agent-1');
    expect(a1?.utilization).toBeCloseTo(0.6);
  });

  it('asSvgBars returns padded bar string', () => {
    const c = new PrivacyBudgetChart();
    const { budgets } = setup();
    const points = c.buildStacks(budgets);
    const svg = c.asSvgBars(points, 20);
    expect(svg.split('\n').length).toBe(2);
    expect(svg).toContain('%');
  });

  it('topConsumers returns sorted by utilization desc', () => {
    const c = new PrivacyBudgetChart();
    const { budgets } = setup();
    const top = c.topConsumers(budgets, 1);
    expect(top[0].agentId).toBe('agent-1');
  });

  it('warnThresholds filters above threshold', () => {
    const c = new PrivacyBudgetChart();
    const { budgets } = setup();
    const points = c.buildStacks(budgets);
    const warns = c.warnThresholds(points, 0.5);
    expect(warns.length).toBe(1);
    expect(warns[0].agentId).toBe('agent-1');
  });

  it('summary aggregates across agents', () => {
    const c = new PrivacyBudgetChart();
    const { budgets } = setup();
    const points = c.buildStacks(budgets);
    const s = c.summary(points);
    expect(s.agents).toBe(2);
    expect(s.maxUtilization).toBeCloseTo(0.6);
  });

  it('summary returns zero on empty', () => {
    const c = new PrivacyBudgetChart();
    const s = c.summary([]);
    expect(s.agents).toBe(0);
    expect(s.maxUtilization).toBe(0);
  });
});

describe('AuditExplorer', () => {
  it('timeline buckets entries', () => {
    const e = new AuditExplorer();
    const { audit } = setup();
    const buckets = e.timeline(audit, 60000);
    expect(buckets.length).toBeGreaterThanOrEqual(1);
    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(3);
  });

  it('byKind counts each kind', () => {
    const e = new AuditExplorer();
    const { audit } = setup();
    const k = e.byKind(audit);
    expect(k.share).toBe(1);
    expect(k.read).toBe(1);
    expect(k.deny).toBe(1);
  });

  it('byAgent counts per agent', () => {
    const e = new AuditExplorer();
    const { audit } = setup();
    const a = e.byAgent(audit);
    expect(a['agent-1']).toBe(1);
    expect(a['stranger']).toBe(1);
  });

  it('filteredView respects multiple filters', () => {
    const e = new AuditExplorer();
    const { audit, c1 } = setup();
    const filtered = e.filteredView(audit, { kinds: ['share', 'read'], agentIds: ['agent-1', 'agent-2'] });
    expect(filtered.length).toBe(2);
    expect(filtered.every((x) => x.cohortId === c1.id)).toBe(true);
  });

  it('stats reports total + first/last ts', () => {
    const e = new AuditExplorer();
    const { audit } = setup();
    const s = e.stats(audit);
    expect(s.total).toBe(3);
    expect(s.firstTs).not.toBeNull();
    expect(s.lastTs).not.toBeNull();
  });

  it('stats returns null timestamps on empty audit', () => {
    const e = new AuditExplorer();
    const s = e.stats(new PrivacyAudit());
    expect(s.total).toBe(0);
    expect(s.firstTs).toBeNull();
  });
});

describe('CohortReport', () => {
  it('markdown produces title + sections + bullet lines', () => {
    const r = new CohortReport();
    const md = r.markdown('Test', [{ heading: 'Section A', lines: ['first', 'second'] }]);
    expect(md).toContain('# Test');
    expect(md).toContain('## Section A');
    expect(md).toContain('- first');
  });

  it('csv returns header row + data rows', () => {
    const r = new CohortReport();
    const csv = r.csv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], ['a', 'b']);
    expect(csv.split('\n')[0]).toBe('a,b');
    expect(csv.split('\n')[1]).toBe('1,x');
  });

  it('csv escapes commas + quotes', () => {
    const r = new CohortReport();
    const csv = r.csv([{ a: 'hello, world', b: 'say "hi"' }], ['a', 'b']);
    expect(csv).toContain('"hello, world"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('cohortSection returns cohort metadata', () => {
    const r = new CohortReport();
    const { cohorts } = setup();
    const s = r.cohortSection(cohorts);
    expect(s.heading).toBe('Cohorts');
    expect(s.lines.length).toBe(2);
  });

  it('budgetSection returns agent utilization', () => {
    const r = new CohortReport();
    const { budgets } = setup();
    const s = r.budgetSection(budgets);
    expect(s.heading).toBe('Privacy Budgets');
    expect(s.lines[0]).toContain('agent-1');
  });

  it('auditSection returns recent entries', () => {
    const r = new CohortReport();
    const { audit } = setup();
    const s = r.auditSection(audit, 2);
    expect(s.heading).toContain('Recent Audit');
    expect(s.lines.length).toBe(2);
  });
});

describe('FederatedCohortsUIMasterIndex', () => {
  it('lists 6 federated UI engines', () => {
    const idx = new FederatedCohortsUIMasterIndex();
    expect(idx.count()).toBe(6);
  });

  it('list includes self + 5 batch engines', () => {
    const idx = new FederatedCohortsUIMasterIndex();
    const names = idx.list().map((i) => i.name).sort();
    expect(names).toContain('FederatedCohortsUIMasterIndex');
    expect(names).toContain('CohortVisualizer');
    expect(names.length).toBe(6);
  });

  it('FEDERATED_UI_ENGINES constant has 6 entries', () => {
    expect(FEDERATED_UI_ENGINES.length).toBe(6);
  });

  it('COHORT_UI_TOOLS exports 5 MCP tool descriptors', () => {
    expect(COHORT_UI_TOOLS.length).toBe(5);
  });

  it('byName finds an engine', () => {
    const idx = new FederatedCohortsUIMasterIndex();
    expect(idx.byName('MembershipGraph')?.layer).toBe('federated_ui');
  });
});
