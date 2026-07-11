import { h, render, type VNode } from './runtime';
import { MEMORY_ENGINES, LAYERS, type EngineMeta } from './data/memoryEngines';
import { runDemo, type DemoResult } from './data/liveDemos';

const THEMES = ['light', 'dark', 'sepia', 'nord'] as const;
type Theme = typeof THEMES[number];

const STORAGE_KEYS = {
  theme: 'amm:theme',
  layer: 'amm:layer',
  query: 'amm:query',
};

const LAYER_LABELS = Object.fromEntries(LAYERS.map(l => [l.id, l.label]));
const LAYER_COLORS = Object.fromEntries(LAYERS.map(l => [l.id, l.color]));

interface State {
  theme: Theme;
  layer: string;
  query: string;
  hoveredEngine: string | null;
  demoFor: string | null;
  demoResult: DemoResult | null;
}

const loadState = (): State => {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const theme = (THEMES as readonly string[]).includes(savedTheme ?? '') ? (savedTheme as Theme) : 'light';
  return {
    theme,
    layer: localStorage.getItem(STORAGE_KEYS.layer) ?? 'all',
    query: localStorage.getItem(STORAGE_KEYS.query) ?? '',
    hoveredEngine: null,
    demoFor: null,
    demoResult: null,
  };
};

let state = loadState();
let rootEl: HTMLElement | null = null;

const persist = (): void => {
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  localStorage.setItem(STORAGE_KEYS.layer, state.layer);
  localStorage.setItem(STORAGE_KEYS.query, state.query);
  document.documentElement.setAttribute('data-theme', state.theme);
};

const setState = (patch: Partial<State>): void => {
  state = { ...state, ...patch };
  persist();
  if (rootEl) render(rootEl, App());
};

const filterEngines = (): EngineMeta[] => {
  return MEMORY_ENGINES.filter(e => {
    const layerOk = state.layer === 'all' || e.layer === state.layer;
    const q = state.query.trim().toLowerCase();
    if (!q) return layerOk;
    return layerOk && (
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.useCase.toLowerCase().includes(q)
    );
  });
};

const formatStars = (n: number): string => n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const renderEngineCard = (e: EngineMeta): VNode => {
  const rating = e.ratingCount > 0 ? e.ratingSum / e.ratingCount : 0;
  const isHovered = state.hoveredEngine === e.id;
  return h('article', { class: 'engine-card', 'data-engine-id': e.id },
    h('div', { class: 'engine-header' },
      h('h3', { class: 'engine-name' }, e.name,
        h('span', { class: 'engine-layer-badge' }, LAYER_LABELS[e.layer] || e.layer)),
    ),
    h('div', { class: 'engine-use-case' }, e.description),
    e.useCase ? h('div', { class: 'engine-use-case', style: { color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' } }, `When: ${e.useCase}`) : null,
    h('pre', { class: 'engine-code-block' }, e.codePreview),
    h('div', { class: 'engine-meta' },
      h('span', null, '↓ ', formatStars(e.pulled), ' installs · ', h('strong', null, `★ ${rating.toFixed(1)}`), ' (', String(e.ratingCount), ')'),
    ),
    h('div', { class: 'engine-actions' },
      h('button', {
        class: 'btn btn-primary',
        onClick: () => { state.demoFor = e.id; state.demoResult = runDemo(e.id); state.hoveredEngine = null; if (rootEl) render(rootEl, App()); },
      }, isHovered ? '✓ try now' : 'try now'),
      h('button', {
        class: 'btn btn-ghost',
        onClick: () => { setState({ hoveredEngine: isHovered ? null : e.id }); },
      }, isHovered ? 'hide code' : 'show code'),
    ),
  );
};

const renderModal = (): VNode | null => {
  if (!state.demoFor || !state.demoResult) return null;
  const e = MEMORY_ENGINES.find(x => x.id === state.demoFor);
  if (!e) return null;
  const r = state.demoResult;
  return h('div', { class: 'modal-overlay', onClick: () => setState({ demoFor: null, demoResult: null }) },
    h('div', { class: 'modal', onClick: (ev: Event) => ev.stopPropagation() },
      h('h3', null, e.name, h('span', { class: 'engine-layer-badge', style: { marginLeft: '8px' } }, LAYER_LABELS[e.layer] || e.layer)),
      h('div', { class: 'modal-section' },
        h('div', { class: 'modal-section-title' }, 'description'),
        h('div', { class: 'engine-use-case' }, e.description),
      ),
      h('div', { class: 'modal-section' },
        h('div', { class: 'modal-section-title' }, `use case (${r.steps.length} steps · ${r.durationMs.toFixed(2)}ms)`),
        h('pre', { class: 'code-output' }, r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')),
      ),
      h('div', { class: 'modal-section' },
        h('div', { class: 'modal-section-title' }, 'output'),
        h('pre', { class: 'code-output' }, r.output),
      ),
      h('div', { class: 'engine-actions', style: { borderTop: 'none', marginTop: '8px' } },
        h('button', { class: 'btn btn-primary', onClick: () => setState({ demoFor: null, demoResult: null }) }, 'close'),
      ),
    ),
  );
};

export const App = (): VNode => {
  const engines = filterEngines();
  const totalInstalls = MEMORY_ENGINES.reduce((s, e) => s + e.pulled, 0);
  const layerCounts = MEMORY_ENGINES.reduce<Record<string, number>>((acc, e) => {
    acc[e.layer] = (acc[e.layer] ?? 0) + 1;
    return acc;
  }, {});

  return h('div', { class: 'app' },
    h('header', { class: 'header' },
      h('div', { class: 'brand' },
        h('div', { class: 'brand-logo' }, 'M'),
        h('div', null,
          h('div', null, 'Agent Memory Marketplace'),
          h('div', { style: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' } }, 'Curated registry for AI agent memory engines'),
        ),
      ),
      h('div', { class: 'search-bar' },
        h('input', {
          type: 'search',
          placeholder: 'Search engines by name, description, or use case…',
          value: state.query,
          oninput: (ev: Event) => { setState({ query: (ev.target as HTMLInputElement).value }); },
        }),
      ),
      h('div', { class: 'theme-switcher', role: 'group', 'aria-label': 'Theme switcher' },
        ...THEMES.map(t =>
          h('button', {
            class: `theme-btn ${state.theme === t ? 'active' : ''}`,
            onClick: () => setState({ theme: t }),
            'aria-label': `${t} theme`,
            'aria-pressed': state.theme === t,
          }, `${t === 'light' ? '☀' : t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '❄'} ${t}`),
        ),
      ),
    ),
    h('main', { class: 'main' },
      h('div', { class: 'hero' },
        h('h1', null, 'Discover AI Agent Memory Engines'),
        h('p', null, 'A curated marketplace of long-term memory layers for AI agents — search, integrate, and benchmark engines inspired by TencentDB Agent Memory, Letta, Zep, and the open-source agent-memory ecosystem.'),
        h('div', { class: 'hero-meta' },
          h('span', null, h('strong', null, String(MEMORY_ENGINES.length)), ' engines indexed'),
          h('span', null, '•'),
          h('span', null, h('strong', null, String(LAYERS.length)), ' layers'),
          h('span', null, '•'),
          h('span', null, h('strong', null, formatStars(totalInstalls)), ' cumulative installs'),
        ),
      ),
      h('div', { class: 'toolbar' },
        h('button', { class: `layer-chip ${state.layer === 'all' ? 'active' : ''}`, onClick: () => setState({ layer: 'all' }) },
          h('span', { class: 'layer-dot', style: { background: '#888' } }),
          `All (${MEMORY_ENGINES.length})`,
        ),
        ...LAYERS.map(l =>
          h('button', {
            class: `layer-chip ${state.layer === l.id ? 'active' : ''}`,
            onClick: () => setState({ layer: l.id }),
          },
            h('span', { class: 'layer-dot', style: { background: l.color } }),
            `${l.label} (${layerCounts[l.id] ?? 0})`,
          ),
        ),
      ),
      engines.length === 0
        ? h('div', { class: 'empty-state' },
            h('h3', null, 'No engines match'),
            h('p', null, 'Try a different search term or layer filter.'))
        : h('div', { class: 'engine-grid' },
            ...engines.map(renderEngineCard)),
    ),
    h('footer', { class: 'footer' },
      h('p', null,
        'Built with ', h('strong', null, 'vanilla TS + zero-dep runtime'),
        ' + esbuild · ',
        'Theme-aware CSS · ',
        MEMORY_ENGINES.length, ' engines indexed · open source MIT · ',
        h('a', { href: `${import.meta.env.BASE_URL ?? '/'}credits` }, 'credits'),
      ),
    ),
    renderModal(),
  );
};

// Mount helper
export const mountApp = (root: HTMLElement): void => {
  rootEl = root;
  persist();
  render(root, App());
};
