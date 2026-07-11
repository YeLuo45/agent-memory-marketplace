// Live demo runners — execute each engine against synthetic data
// and return a presentable output. Used by the marketplace UI to show
// real engine behavior without requiring the user to open a console.

import {
  EpisodicStore,
  SemanticIndex,
  ProceduralCache,
  ConsolidationEngine,
  ForgettingEngine,
  MemoryRetriever,
  MemoryEncoder,
  MemoryDecoder,
  MemoryHierarchy,
  MemoryCoreIndex,
} from '../engines/AgentMemoryCore';
import {
  LongTermMemoryManager,
  ShortTermMemory,
  WorkingMemory,
  AssociativeMemory,
  ContextWindow,
  AttentionMechanism,
  MemoryCompression,
  MemoryCache,
  MemoryProfiler,
  MemoryAdvancedIndex,
} from '../engines/AgentMemoryAdvanced';
import {
  MemoryDashboard,
  MemoryConfig,
  MemoryAudit,
  MemoryProfile,
  MemoryMigration,
  MemoryReport,
  MemoryBenchmark,
  MemoryMasterIndex,
  MemoryIntegrationIndex,
} from '../engines/AgentMemoryIntegration';
import {
  VectorEmbedder,
  CosineSim,
  DistanceMetric,
  VectorNormalizer,
  HNSWIndex,
  PQCompressor,
  HybridSearcher,
  VectorCache,
  TokenBag,
  VectorMigrator,
  MemVectorCoreIndex,
} from '../engines/MemVectorCore';

export interface DemoResult {
  engineId: string;
  title: string;
  steps: string[];
  output: string;
  durationMs: number;
}

const measure = <T,>(fn: () => T): { result: T; ms: number } => {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
};

// Advance values
export const runDemo = (engineId: string): DemoResult => {
  const useAdvanced = false; // reserved for future use

  switch (engineId) {
    case 'EpisodicStore': {
      const { result, ms } = measure(() => {
        const s = new EpisodicStore();
        s.record('user said hi', 0.7);
        s.record('user asked about weather', 0.9);
        s.record('user thanked', 0.4);
        return {
          recent: s.recent(3).map(e => `${e.content} (imp=${e.importance})`),
          important: s.important(0.6).map(e => e.content),
          total: s.size(),
        };
      });
      return { engineId, title: 'EpisodicStore', steps: ['record 3 episodes', 'recent(3)', 'important(≥0.6)'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'SemanticIndex': {
      const { result, ms } = measure(() => {
        const s = new SemanticIndex();
        s.add('m1', ['python', 'ai']).add('m2', ['python']).add('m3', ['rust']);
        return {
          python: s.findByTag('python'),
          rust: s.findByTag('rust'),
          tags: { m1: s.tags('m1'), m2: s.tags('m2') },
          total: s.size(),
        };
      });
      return { engineId, title: 'SemanticIndex', steps: ['add 3 entries with tags', 'findByTag × 2', 'tags() × 2'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'ProceduralCache': {
      const { result, ms } = measure(() => {
        const p = new ProceduralCache();
        p.store('reset-pwd', ['verify email', 'send token', 'redirect to /reset']);
        p.store('extract-text', ['open pdf', 'extract plain text']);
        return {
          resetPwd: p.get('reset-pwd'),
          extract: p.get('extract-text'),
          hasReset: p.has('reset-pwd'),
          size: p.size(),
        };
      });
      return { engineId, title: 'ProceduralCache', steps: ['store 2 procedures', 'get × 2'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'ConsolidationEngine': {
      const { result, ms } = measure(() => {
        const c = new ConsolidationEngine();
        const items = [
          { id: 'a', content: 'cat sat on the rug', timestamp: 1, importance: 0.5 },
          { id: 'b', content: 'cat sat on the mat', timestamp: 2, importance: 0.6 },
          { id: 'c', content: 'dog ran in the park', timestamp: 3, importance: 0.8 },
        ];
        return {
          merged: c.consolidate(items).length,
          mergeable: c.mergeable(items),
          sample: c.consolidate(items)[0]?.content,
        };
      });
      return { engineId, title: 'ConsolidationEngine', steps: ['3 similar episodes', 'consolidate'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'ForgettingEngine': {
      const { result, ms } = measure(() => {
        const f = new ForgettingEngine();
        const old = { id: 'old', content: 'x', timestamp: Date.now() - 1_000_000, importance: 0.5 };
        const fresh = { id: 'fresh', content: 'y', timestamp: Date.now(), importance: 0.5 };
        return {
          decay: f.relevance(old, 100_000),
          forgetOld: f.shouldForget(old, 100_000, 0.01),
          forgetFresh: f.shouldForget(fresh, 100_000, 0.01),
        };
      });
      return { engineId, title: 'ForgettingEngine', steps: ['compute decay', 'shouldForget × 2'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryRetriever': {
      const { result, ms } = measure(() => {
        const r = new MemoryRetriever();
        const items = [
          { id: 'a', content: 'user likes sunny weather', timestamp: Date.now() - 100, importance: 0.8 },
          { id: 'b', content: 'weather forecast was cloudy', timestamp: Date.now(), importance: 0.4 },
          { id: 'c', content: 'user mentioned cat', timestamp: Date.now(), importance: 0.7 },
        ];
        const top = r.retrieve(items, 'weather', 2);
        return {
          query: 'weather',
          topK: top.map(m => m.id),
          scores: top.map(m => r.score(m, 'weather').toFixed(3)),
        };
      });
      return { engineId, title: 'MemoryRetriever', steps: ['score 3 memories for query "weather"', 'retrieve top-2'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryEncoder': {
      const { result, ms } = measure(() => {
        const e = new MemoryEncoder();
        const msg = 'hello world';
        const enc = e.encode(msg);
        return {
          input: msg,
          encoded: enc,
          size: e.encodedSize(msg),
        };
      });
      return { engineId, title: 'MemoryEncoder', steps: ['encode "hello world"'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryDecoder': {
      const { result, ms } = measure(() => {
        const d = new MemoryDecoder();
        return {
          reverse: d.reverse('mem:abc12345:hello world'),
          split: d.split('alpha | beta | gamma'),
        };
      });
      return { engineId, title: 'MemoryDecoder', steps: ['reverse + split'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryHierarchy': {
      const { result, ms } = measure(() => {
        const h = new MemoryHierarchy();
        const now = Date.now();
        const items = [
          { id: 'h', content: 'x', timestamp: now, importance: 0.9 },
          { id: 'w', content: 'y', timestamp: now - 100_000, importance: 0.5 },
          { id: 'c', content: 'z', timestamp: now - 1_000_000, importance: 0.1 },
        ];
        return {
          tiers: h.partition(items, now),
        };
      });
      return { engineId, title: 'MemoryHierarchy', steps: ['classify 3 items by importance + age'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'LongTermMemoryManager': {
      const { result, ms } = measure(() => {
        const m = new LongTermMemoryManager();
        m.store('theme', 'dark').store('locale', 'en-US').store('user-id', 'u_42');
        return {
          stored: m.list(),
          age1ms: m.age('theme'),
          value: m.get('user-id'),
        };
      });
      return { engineId, title: 'LongTermMemoryManager', steps: ['store 3 keys', 'list + age + get'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'ShortTermMemory': {
      const { result, ms } = measure(() => {
        const s = new ShortTermMemory(3);
        s.push('a').push('b').push('c').push('d');  // 'a' evicted
        return {
          rollingWindow: s.recent(),
          size: s.size(),
          capacity: s.capacity(),
        };
      });
      return { engineId, title: 'ShortTermMemory', steps: ['push 4 with cap=3 (FIFO eviction)'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'WorkingMemory': {
      const { result, ms } = measure(() => {
        const w = new WorkingMemory();
        w.focus('a', 'content-a', 0.9).focus('b', 'content-b', 0.3);
        w.decay(0.5);
        return {
          focused: w.focusedIds(0.4),
          afterDecay: { a: w.get('a')?.attention, b: w.get('b')?.attention },
        };
      });
      return { engineId, title: 'WorkingMemory', steps: ['focus 2 items + decay(0.5)'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'AssociativeMemory': {
      const { result, ms } = measure(() => {
        const a = new AssociativeMemory();
        a.link('ramen', 'japanese-food').link('ramen', 'cold-dishes').link('japanese-food', 'sushi');
        return {
          ramenNeighbors: a.neighbors('ramen'),
          reachable: a.reachable('ramen', 2),
          linkCount: a.linkCount(),
        };
      });
      return { engineId, title: 'AssociativeMemory', steps: ['link 3 pairs (graph)', 'neighbors + BFS'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'ContextWindow': {
      const { result, ms } = measure(() => {
        const w = new ContextWindow(5);
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(c => w.add(c));
        return {
          contents: w.contents(),
          size: w.size(),
          remaining: w.remaining(),
          isFull: w.isFull(),
        };
      });
      return { engineId, title: 'ContextWindow', steps: ['add 7 tokens to cap-5'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'AttentionMechanism': {
      const { result, ms } = measure(() => {
        const a = new AttentionMechanism();
        const w = a.attend([1, 0], [[1, 0], [0, 1], [0.5, 0.5]]);
        return {
          weights: w.map(x => x.toFixed(4)),
          topK: a.topK(w, 2),
        };
      });
      return { engineId, title: 'AttentionMechanism', steps: ['attend over 3 keys'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryCompression': {
      const { result, ms } = measure(() => {
        const c = new MemoryCompression();
        const items = ['hello world', 'hello world', 'goodbye world', 'hello world'];
        const compressed = c.compress(items);
        return {
          before: items.length,
          after: compressed.length,
          ratio: c.ratio(items, compressed).toFixed(3),
          truncated: c.truncate(['long-message-here'], 5),
        };
      });
      return { engineId, title: 'MemoryCompression', steps: ['dedup + truncate'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryCache': {
      const { result, ms } = measure(() => {
        const c = new MemoryCache(2);
        c.set('a', 1).set('b', 2).set('c', 3);  // 'a' evicted
        return {
          hit_a: c.get('a'),
          hit_b: c.get('b'),
          hit_c: c.get('c'),
          size: c.size(),
        };
      });
      return { engineId, title: 'MemoryCache', steps: ['set 3 keys, cap=2 (LRU evict)'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryProfiler': {
      const { result, ms } = measure(() => {
        const p = new MemoryProfiler();
        p.record('agent-1', 25, 1024).record('agent-1', 50, 2048);
        return {
          avgMs: p.averageDuration('agent-1'),
          totalBytes: p.totalBytes('agent-1'),
          ops: p.operations(),
        };
      });
      return { engineId, title: 'MemoryProfiler', steps: ['record 2 ops for agent-1'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryDashboard': {
      const { result, ms } = measure(() => {
        const d = new MemoryDashboard();
        d.setPanel('ltm', 'LTM Size', 1024).setPanel('stm', 'STM Capacity', 10).setPanel('q', 'Queries/min', 50);
        return {
          panels: d.panelNames(),
          count: d.panelCount(),
          panel_ltm: d.getPanel('ltm'),
        };
      });
      return { engineId, title: 'MemoryDashboard (integration)', steps: ['set 3 named panels'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryConfig': {
      const { result, ms } = measure(() => {
        const c = new MemoryConfig();
        c.set('window', 4096).set('compression', 'gzip').set('debug', true);
        return {
          window: c.getNumber('window'),
          compression: c.getString('compression'),
          debug: c.getBoolean('debug'),
          size: c.size(),
        };
      });
      return { engineId, title: 'MemoryConfig (integration)', steps: ['set 3 typed configs'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryAudit': {
      const { result, ms } = measure(() => {
        const a = new MemoryAudit();
        a.record('user-1', 'write', 'episodic').record('user-1', 'read', 'semantic').record('user-2', 'write', 'ltm');
        return {
          user1: a.forAgent('user-1').length,
          user2: a.forAgent('user-2').length,
          total: a.count(),
        };
      });
      return { engineId, title: 'MemoryAudit (integration)', steps: ['record 3 audit entries'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryProfile': {
      const { result, ms } = measure(() => {
        const p = new MemoryProfile();
        p.record('agent-7', 50, 100).record('agent-7', 200, 400);
        return {
          avgItems: p.averageItems('agent-7'),
          avgMs: p.averageDuration('agent-7'),
          totalRecords: p.runs('agent-7').length,
        };
      });
      return { engineId, title: 'MemoryProfile (integration)', steps: ['record 2 sessions'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryMigration': {
      const { result, ms } = measure(() => {
        const m = new MemoryMigration();
        let n = 0;
        m.define('v1', () => { n += 1; });
        m.define('v2', async () => { n += 1; });
        return {
          pending1: m.migrationCount(),
          afterRun: null as null | { v1: boolean; v2: boolean },
          // run via promise chain
        };
      });
      const m2 = new MemoryMigration();
      let n2 = 0;
      m2.define('v1', () => { n2 += 1; });
      return {
        output: JSON.stringify({
          runReturned: null,
          beforeRun: result,
        }, null, 2),
        steps: ['define 1 migration', 'inspect (run via UI button)'],
        engineId, title: 'MemoryMigration (integration)',
        durationMs: ms,
      };
    }

    case 'MemoryReport': {
      const { result, ms } = measure(() => {
        const r = new MemoryReport();
        const md = r.generate('Q1 Memory', { ltm: 1024, stm: 50, queries_per_min: 100 });
        const csv = r.toCSV({ a: 1, b: 2 });
        return { md: md.slice(0, 120) + '…', csv };
      });
      return { engineId, title: 'MemoryReport (integration)', steps: ['generate markdown + CSV'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryBenchmark': {
      const { result, ms } = measure(() => {
        const b = new MemoryBenchmark();
        b.record('episodic', 0.85).record('semantic', 0.95).record('procedural', 0.78);
        return {
          best: b.best(),
          all: b.results(),
        };
      });
      return { engineId, title: 'MemoryBenchmark (integration)', steps: ['compare 3 stores'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryCoreIndex': {
      const { result, ms } = measure(() => {
        const idx = new MemoryCoreIndex();
        return { engines: idx.list(), count: idx.count() };
      });
      return { engineId, title: 'MemoryCoreIndex (batch 1/3 index)', steps: ['list + count'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryAdvancedIndex': {
      const { result, ms } = measure(() => {
        const idx = new MemoryAdvancedIndex();
        return { engines: idx.list(), count: idx.count() };
      });
      return { engineId, title: 'MemoryAdvancedIndex (batch 2/3 index)', steps: ['list + count'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryMasterIndex': {
      const { result, ms } = measure(() => {
        const idx = new MemoryMasterIndex();
        return {
          engines: idx.list(),
          count: idx.count(),
          hasEpisodic: idx.has('EpisodicStore'),
        };
      });
      return { engineId, title: 'MemoryMasterIndex (master across 3 batches)', steps: ['list + count + has'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemoryIntegrationIndex': {
      const { result, ms } = measure(() => {
        const idx = new MemoryIntegrationIndex();
        return { engines: idx.list(), count: idx.count() };
      });
      return { engineId, title: 'MemoryIntegrationIndex (batch 3/3 index)', steps: ['list + count'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    // ===== MemVector engines (V5556-V5575) =====
    case 'VectorEmbedder': {
      const { result, ms } = measure(() => {
        const e = new VectorEmbedder(64);
        const v = e.embedText('hello world');
        const tags = e.embedTags(['python', 'ai']);
        const proj = e.project(v.values, 32);
        return {
          text_dim: v.dim,
          text_first_5: v.values.slice(0, 5).map(x => x.toFixed(4)),
          tag_first_5: tags.values.slice(0, 5).map(x => x.toFixed(4)),
          project_to_32: proj.length,
        };
      });
      return { engineId, title: 'VectorEmbedder', steps: ['embed text + tags', 'project to 32-dim'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'CosineSim': {
      const { result, ms } = measure(() => {
        const c = new CosineSim();
        return {
          identity: c.similarity([1, 0, 0], [1, 0, 0]).toFixed(4),
          ortho: c.similarity([1, 0], [0, 1]).toFixed(4),
          opp: c.similarity([1, 0], [-1, 0]).toFixed(4),
          l2: c.distance([1, 0], [4, 3]).toFixed(4),
          top1: c.topK([1, 0], [[1, 0], [0.5, 0.5]], 1)[0],
        };
      });
      return { engineId, title: 'CosineSim', steps: ['4 similarity checks + topK'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'DistanceMetric': {
      const { result, ms } = measure(() => {
        return {
          cosine: DistanceMetric.cosine([1, 0], [0, 1]).toFixed(4),
          euclidean: DistanceMetric.euclidean([1, 0], [4, 3]).toFixed(4),
          dot: DistanceMetric.dot([1, 2, 3], [4, 5, 6]),
        };
      });
      return { engineId, title: 'DistanceMetric', steps: ['cosine + euclidean + dot'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'HNSWIndex': {
      const { result, ms } = measure(() => {
        const idx = new HNSWIndex(8, 3);
        idx.insert('a', [1, 0, 0]);
        idx.insert('b', [1, 0, 0.1]);
        idx.insert('c', [0, 1, 0]);
        idx.insert('d', [0.5, 0.5, 0]);
        const q = idx.query([1, 0, 0], 3);
        return {
          ids: idx.ids(),
          top3: q.map(x => ({ id: x.id, score: x.score.toFixed(4) })),
          avgDegree: idx.averageDegree().toFixed(2),
        };
      });
      return { engineId, title: 'HNSWIndex', steps: ['insert 4 vectors', 'top-3 query'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'PQCompressor': {
      const { result, ms } = measure(() => {
        const c = new PQCompressor(4);
        const v = Array.from({ length: 8 }, (_, i) => i / 8);
        const codes = c.compress(v);
        return {
          original_dim: v.length,
          codes_dim: codes.length,
          codes: codes,
          ratio: c.compressionRatio(8).toFixed(2),
          approx: c.approxDistance([10, 20], [15, 25]),
        };
      });
      return { engineId, title: 'PQCompressor', steps: ['compress 8-dim to 4 codes', 'approx distance'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'HybridSearcher': {
      const { result, ms } = measure(() => {
        const h = new HybridSearcher();
        const items = [
          { id: 'a', tags: ['python', 'ai'], vector: [1, 0, 0] },
          { id: 'b', tags: ['python'], vector: [1, 0, 0.1] },
          { id: 'c', tags: ['rust'], vector: [0, 1, 0] },
        ];
        const r0 = h.search('python', [1, 0, 0], items, { alpha: 0, limit: 3 });
        const r1 = h.search('python', [1, 0, 0], items, { alpha: 1, limit: 3 });
        const r05 = h.search('python', [1, 0, 0], items, { alpha: 0.5, limit: 3 });
        const gt = new Set(['a', 'b']);
        const best = h.tuneAlpha('python', [1, 0, 0], items, gt);
        return {
          alpha_0: r0.map(x => ({ id: x.id, combined: x.combined.toFixed(3) })),
          alpha_1: r1.map(x => ({ id: x.id, combined: x.combined.toFixed(3) })),
          alpha_05: r05.map(x => ({ id: x.id, combined: x.combined.toFixed(3) })),
          best_alpha: best.toFixed(2),
        };
      });
      return { engineId, title: 'HybridSearcher', steps: ['test α=0/0.5/1', 'grid search best α'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'VectorCache': {
      const { result, ms } = measure(() => {
        const c = new VectorCache(2);
        c.set('k1', [0.1, 0.2, 0.3]);
        c.set('k2', [0.4, 0.5, 0.6]);
        c.get('k1'); c.get('k1'); c.get('k3'); c.get('k1');
        c.set('k4', [0.7, 0.8, 0.9]); // evicts k2
        return {
          hit: c.hitRate().toFixed(2),
          size: c.size(),
          has_k1: c.has('k1'),
          has_k2: c.has('k2'),
          has_k4: c.has('k4'),
        };
      });
      return { engineId, title: 'VectorCache', steps: ['cache + access + evict'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'TokenBag': {
      const { result, ms } = measure(() => {
        const t = new TokenBag();
        t.fit(['the cat sat on the mat', 'the dog ran fast', 'python is great fun']);
        const v = t.vectorize('the cat ran fast');
        return {
          vocab_size: t.vocabSize(),
          vector_dim: v.dim,
          tokenized: TokenBag.tokenize('Cat  DOG, Cat!'),
        };
      });
      return { engineId, title: 'TokenBag', steps: ['fit on 3 docs', 'vectorize + tokenize'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'VectorMigrator': {
      const { result, ms } = measure(() => {
        const m = new VectorMigrator();
        const padTrunc = m.migrate([[1, 2, 3, 4, 5, 6, 7, 8]], 8, 4, 'pad-truncate');
        const proj = m.migrate([[1, 2, 3, 4]], 4, 8, 'random-projection');
        const up = m.migrate([[1, 2]], 2, 5, 'pad-truncate');
        return {
          pad_truncate_8_to_4: padTrunc,
          random_projection_4_to_8: proj,
          pad_2_to_5: up,
        };
      });
      return { engineId, title: 'VectorMigrator', steps: ['3 migration strategies'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'VectorNormalizer': {
      const { result, ms } = measure(() => {
        return {
          l2: VectorNormalizer.normalize([3, 4]),
          minmax: VectorNormalizer.minMax([1, 2, 3, 4, 5]),
          zscore: VectorNormalizer.zScore([1, 2, 3]),
          constant: VectorNormalizer.zScore([5, 5, 5]),
        };
      });
      return { engineId, title: 'VectorNormalizer', steps: ['L2 + minmax + zscore'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    case 'MemVectorCoreIndex': {
      const { result, ms } = measure(() => {
        const idx = new MemVectorCoreIndex();
        return {
          count: idx.count(),
          has_VectorEmbedder: idx.has('VectorEmbedder'),
          has_HNSWIndex: idx.has('HNSWIndex'),
          has_MemVectorCoreIndex: idx.has('MemVectorCoreIndex'),
          has_Missing: idx.has('Missing'),
        };
      });
      return { engineId, title: 'MemVectorCoreIndex', steps: ['batch index metadata'], output: JSON.stringify(result, null, 2), durationMs: ms };
    }

    default:
      return { engineId, title: engineId, steps: [], output: 'No demo available', durationMs: 0 };
  }
};
