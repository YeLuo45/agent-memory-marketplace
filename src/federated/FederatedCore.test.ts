// V5656-V5680: Federated Memory Plugin tests.

import { describe, it, expect } from 'vitest';
import {
  FederatedCohort,
  FederatedMemoryShare,
  PrivacyBudgetAggregator,
  SecureChannel,
  SecureAggregation,
  PrivacyAudit,
  PrivacyBudgetEnforcer,
  FederatedMemoryIndex,
  FEDERATED_ENGINES,
  FEDERATED_TOOLS,
} from './FederatedCore';

describe('FederatedCohort', () => {
  it('create returns a cohort with owner auto-added', () => {
    const c = new FederatedCohort();
    const cohort = c.create('alpha', 'agent-1', 'moderate');
    expect(cohort.ownerAgentId).toBe('agent-1');
    expect(c.isMember(cohort.id, 'agent-1')).toBe(true);
  });

  it('addMember + removeMember work and protect owner', () => {
    const c = new FederatedCohort();
    const cohort = c.create('alpha', 'agent-1');
    expect(c.addMember(cohort.id, 'agent-2')).toBe(true);
    expect(c.isMember(cohort.id, 'agent-2')).toBe(true);
    expect(c.removeMember(cohort.id, 'agent-1')).toBe(false); // owner protected
    expect(c.removeMember(cohort.id, 'agent-2')).toBe(true);
  });

  it('isMember returns false for unknown cohort', () => {
    const c = new FederatedCohort();
    expect(c.isMember('nope', 'agent-1')).toBe(false);
  });

  it('get + list return cohort data', () => {
    const c = new FederatedCohort();
    const cohort = c.create('alpha', 'agent-1');
    expect(c.get(cohort.id)?.name).toBe('alpha');
    expect(c.list().length).toBe(1);
  });

  it('stats reports total cohorts + member count', () => {
    const c = new FederatedCohort();
    const c1 = c.create('a', 'agent-1');
    c.create('b', 'agent-2');
    c.addMember(c1.id, 'agent-3');
    const s = c.stats();
    expect(s.total).toBe(2);
    expect(s.members).toBe(3);
  });
});

describe('FederatedMemoryShare', () => {
  const setup = (): { c: FederatedCohort; s: FederatedMemoryShare; a: PrivacyAudit; cohort: ReturnType<FederatedCohort['create']> } => {
    const c = new FederatedCohort();
    const s = new FederatedMemoryShare();
    const a = new PrivacyAudit();
    const cohort = c.create('team-a', 'agent-1');
    c.addMember(cohort.id, 'agent-2');
    return { c, s, a, cohort };
  };

  it('share requires cohort membership', () => {
    const { c, s, a, cohort } = setup();
    const r = s.share('agent-1', cohort.id, 'hello', 0.1, c, a);
    expect(r.ok).toBe(true);
    expect(r.shareId).toMatch(/^share_/);
  });

  it('share denies non-member', () => {
    const { c, s, a, cohort } = setup();
    const r = s.share('stranger', cohort.id, 'hello', 0.1, c, a);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('not a cohort');
  });

  it('read returns content for cohort members', () => {
    const { c, s, a, cohort } = setup();
    const share = s.share('agent-1', cohort.id, 'hello world', 0.1, c, a);
    const r = s.read(share.shareId!, 'agent-2', c, a);
    expect(r.ok).toBe(true);
    expect(r.content).toBe('hello world');
    expect(r.hash).toBeDefined();
  });

  it('read denies non-members', () => {
    const { c, s, a, cohort } = setup();
    const share = s.share('agent-1', cohort.id, 'hello', 0.1, c, a);
    const r = s.read(share.shareId!, 'stranger', c, a);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('not a cohort');
  });

  it('listForCohort returns only matching cohort entries', () => {
    const { c, s, a, cohort } = setup();
    s.share('agent-1', cohort.id, 'a', 0.1, c, a);
    s.share('agent-1', cohort.id, 'b', 0.1, c, a);
    expect(s.listForCohort(cohort.id, 'agent-1', c).length).toBe(2);
    expect(s.listForCohort('other-cohort', 'agent-1', c).length).toBe(0);
  });

  it('drop restricts to owner', () => {
    const { c, s, a, cohort } = setup();
    const share = s.share('agent-1', cohort.id, 'hello', 0.1, c, a);
    expect(s.drop(share.shareId!, 'agent-2')).toBe(false);
    expect(s.drop(share.shareId!, 'agent-1')).toBe(true);
  });

  it('stats reports total + per-cohort breakdown', () => {
    const { c, s, a, cohort } = setup();
    s.share('agent-1', cohort.id, 'x', 0.1, c, a);
    const stats = s.stats();
    expect(stats.total).toBe(1);
    expect(stats.byCohort[cohort.id]).toBe(1);
  });
});

describe('PrivacyBudgetAggregator', () => {
  it('setBudget initializes a new budget', () => {
    const b = new PrivacyBudgetAggregator();
    const u = b.setBudget('agent-1', 10);
    expect(u.budgetTotal).toBe(10);
  });

  it('consume returns allowed + remaining when under cap', () => {
    const b = new PrivacyBudgetAggregator();
    b.setBudget('agent-1', 10);
    const r = b.consume('agent-1', 3);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(7);
  });

  it('consume denies when over cap', () => {
    const b = new PrivacyBudgetAggregator();
    b.setBudget('agent-1', 5);
    b.consume('agent-1', 3);
    const r = b.consume('agent-1', 5);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(2);
  });

  it('refund restores budget', () => {
    const b = new PrivacyBudgetAggregator();
    b.setBudget('agent-1', 10);
    b.consume('agent-1', 4);
    const r = b.refund('agent-1', 2);
    expect(r.remaining).toBe(8);
  });

  it('list + get return budget data', () => {
    const b = new PrivacyBudgetAggregator();
    b.setBudget('agent-1', 10);
    b.setBudget('agent-2', 20);
    expect(b.get('agent-1')?.budgetTotal).toBe(10);
    expect(b.list().length).toBe(2);
  });

  it('topConsumers returns sorted by consumed desc', () => {
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 10);
    b.setBudget('b', 10);
    b.setBudget('c', 10);
    b.consume('a', 3);
    b.consume('b', 7);
    b.consume('c', 1);
    const top = b.topConsumers(2);
    expect(top[0].agentId).toBe('b');
    expect(top[1].agentId).toBe('a');
  });

  it('stats aggregates across agents', () => {
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 10);
    b.setBudget('b', 20);
    b.consume('a', 3);
    b.consume('b', 5);
    const s = b.stats();
    expect(s.totalBudget).toBe(30);
    expect(s.totalConsumed).toBe(8);
  });
});

describe('SecureChannel', () => {
  it('open returns channel id for two agents', () => {
    const sc = new SecureChannel();
    const r = sc.open('a', 'b');
    expect(r.channelId).toContain('a');
    expect(r.channelId).toContain('b');
  });

  it('open is idempotent for the same pair', () => {
    const sc = new SecureChannel();
    const r1 = sc.open('a', 'b');
    const r2 = sc.open('a', 'b');
    expect(r1.channelId).toBe(r2.channelId);
    expect(sc.stats().channels).toBe(1);
  });

  it('send + receive roundtrips a message for both endpoints', () => {
    const sc = new SecureChannel();
    const { channelId } = sc.open('a', 'b');
    const send = sc.send('a', 'b', 'hello');
    expect(send.ok).toBe(true);
    const recvB = sc.receive(channelId, 'b');
    expect(recvB.length).toBe(1);
    expect(recvB[0].content).toContain('decrypted');
  });

  it('receive returns empty for channel strangers', () => {
    const sc = new SecureChannel();
    sc.open('a', 'b');
    sc.send('a', 'b', 'hello');
    const recv = sc.receive(sc.listChannels()[0], 'stranger');
    expect(recv.length).toBe(0);
  });

  it('send without open channel returns ok=false', () => {
    const sc = new SecureChannel();
    const r = sc.send('a', 'c', 'hello');
    expect(r.ok).toBe(false);
  });

  it('stats reports channels + messages', () => {
    const sc = new SecureChannel();
    sc.open('a', 'b');
    sc.send('a', 'b', 'x');
    sc.send('a', 'b', 'y');
    const s = sc.stats();
    expect(s.channels).toBe(1);
    expect(s.messages).toBe(2);
  });
});

describe('SecureAggregation', () => {
  it('contribute accumulates values', () => {
    const agg = new SecureAggregation();
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 10);
    b.setBudget('b', 10);
    expect(agg.contribute('s1', 'a', 5, b).ok).toBe(true);
    expect(agg.contribute('s1', 'b', 3, b).ok).toBe(true);
  });

  it('aggregate sum / avg / count works correctly', () => {
    const agg = new SecureAggregation();
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 10);
    b.setBudget('b', 10);
    b.setBudget('c', 10);
    agg.contribute('s1', 'a', 5, b);
    agg.contribute('s1', 'b', 3, b);
    agg.contribute('s1', 'c', 7, b);
    expect(agg.aggregate('s1', 'sum')?.value).toBe(15);
    expect(agg.aggregate('s1', 'avg')?.value).toBe(5);
    expect(agg.aggregate('s1', 'count')?.value).toBe(3);
  });

  it('aggregate returns undefined for empty session', () => {
    const agg = new SecureAggregation();
    expect(agg.aggregate('none', 'sum')).toBeUndefined();
  });

  it('dropSession removes session', () => {
    const agg = new SecureAggregation();
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 10);
    agg.contribute('s1', 'a', 5, b);
    expect(agg.dropSession('s1')).toBe(true);
    expect(agg.dropSession('s1')).toBe(false);
  });

  it('list returns contributions without revealing value', () => {
    const agg = new SecureAggregation();
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 10);
    agg.contribute('s1', 'a', 5, b);
    const items = agg.list('s1');
    expect(items.length).toBe(1);
    expect(items[0].value).toBe(5);
  });

  it('contribute denied when budget exhausted', () => {
    const agg = new SecureAggregation();
    const b = new PrivacyBudgetAggregator();
    b.setBudget('a', 1);
    b.consume('a', 1);
    const r = agg.contribute('s1', 'a', 5, b);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('budget');
  });
});

describe('PrivacyAudit', () => {
  it('record appends an entry with id + ts', () => {
    const a = new PrivacyAudit();
    const e = a.record({ kind: 'share', agentId: 'a1', cohortId: 'c1' });
    expect(e.id).toMatch(/^audit_/);
    expect(a.count()).toBe(1);
  });

  it('query filters by kind + agentId + cohortId + since', () => {
    const a = new PrivacyAudit();
    a.record({ kind: 'share', agentId: 'a1', cohortId: 'c1' });
    a.record({ kind: 'read', agentId: 'a2', cohortId: 'c1' });
    a.record({ kind: 'deny', agentId: 'a3', cohortId: 'c2', reason: 'no_access' });
    expect(a.query({ kind: 'share' }).length).toBe(1);
    expect(a.query({ agentId: 'a1' }).length).toBe(1);
    expect(a.query({ cohortId: 'c1' }).length).toBe(2);
  });

  it('recent returns last N entries', () => {
    const a = new PrivacyAudit();
    for (let i = 0; i < 5; i += 1) a.record({ kind: 'share', agentId: `a${i}`, cohortId: 'c1' });
    expect(a.recent(2).length).toBe(2);
  });

  it('clear wipes all or by agent', () => {
    const a = new PrivacyAudit();
    a.record({ kind: 'share', agentId: 'a1', cohortId: 'c1' });
    a.record({ kind: 'share', agentId: 'a2', cohortId: 'c1' });
    expect(a.clear('a1')).toBe(1);
    expect(a.count()).toBe(1);
    expect(a.clear()).toBe(1);
    expect(a.count()).toBe(0);
  });

  it('stats groups by kind', () => {
    const a = new PrivacyAudit();
    a.record({ kind: 'share', agentId: 'a1', cohortId: 'c1' });
    a.record({ kind: 'share', agentId: 'a2', cohortId: 'c1' });
    a.record({ kind: 'deny', agentId: 'a3', cohortId: 'c1' });
    const s = a.stats();
    expect(s.byKind.share).toBe(2);
    expect(s.byKind.deny).toBe(1);
  });
});

describe('PrivacyBudgetEnforcer', () => {
  it('enforce + audit log entry for allowed', () => {
    const b = new PrivacyBudgetAggregator();
    const a = new PrivacyAudit();
    b.setBudget('a1', 10);
    const e = new PrivacyBudgetEnforcer(b, a);
    const r = e.enforce('a1', 3);
    expect(r.allowed).toBe(true);
    expect(a.count()).toBe(1);
  });

  it('enforce increments deniedCount when blocked', () => {
    const b = new PrivacyBudgetAggregator();
    const a = new PrivacyAudit();
    b.setBudget('a1', 1);
    const e = new PrivacyBudgetEnforcer(b, a);
    e.enforce('a1', 1);
    e.enforce('a1', 1);
    expect(e.deniedCount()).toBe(1);
  });

  it('refund records audit + restores budget', () => {
    const b = new PrivacyBudgetAggregator();
    const a = new PrivacyAudit();
    b.setBudget('a1', 10);
    const e = new PrivacyBudgetEnforcer(b, a);
    e.enforce('a1', 5);
    const r = e.refund('a1', 2);
    expect(r.remaining).toBe(7);
    expect(a.query({ kind: 'budget_refund' }).length).toBe(1);
  });

  it('budget returns the underlying aggregator', () => {
    const b = new PrivacyBudgetAggregator();
    const a = new PrivacyAudit();
    b.setBudget('a1', 10);
    const e = new PrivacyBudgetEnforcer(b, a);
    expect(e.budget()).toBe(b);
  });
});

describe('FederatedMemoryIndex', () => {
  it('lists 8 federated engines', () => {
    const idx = new FederatedMemoryIndex();
    expect(idx.count()).toBe(8);
  });

  it('list includes self + all 7 batch engines', () => {
    const idx = new FederatedMemoryIndex();
    const names = idx.list().map((i) => i.name).sort();
    expect(names).toContain('FederatedMemoryIndex');
    expect(names).toContain('FederatedCohort');
    expect(names.length).toBe(8);
  });

  it('FEDERATED_ENGINES constant has 8 entries', () => {
    expect(FEDERATED_ENGINES.length).toBe(8);
  });

  it('FEDERATED_TOOLS exports 5 MCP tool descriptors', () => {
    expect(FEDERATED_TOOLS.length).toBe(5);
  });

  it('byName finds an engine', () => {
    const idx = new FederatedMemoryIndex();
    const item = idx.byName('SecureChannel');
    expect(item?.layer).toBe('federated');
  });
});
