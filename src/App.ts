import { h, render, type VNode } from './runtime';
import { MEMORY_ENGINES, LAYERS, type EngineMeta } from './data/memoryEngines';
import { runDemo, type DemoResult } from './data/liveDemos';
import { t, LAYER_LABELS, LAYER_DESCS, LOCALES, type Locale } from './data/i18n';

const THEMES = ['light', 'dark', 'sepia', 'nord'] as const;
type Theme = typeof THEMES[number];

const STORAGE_KEYS = {
  theme: 'amm:theme',
  layer: 'amm:layer',
  query: 'amm:query',
  locale: 'amm:locale',
};

interface State {
  theme: Theme;
  layer: string;
  query: string;
  locale: Locale;
  hoveredEngine: string | null;
  demoFor: string | null;
  demoResult: DemoResult | null;
}

const loadState = (): State => {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const theme: Theme = (THEMES as readonly string[]).includes(savedTheme ?? '') ? (savedTheme as Theme) : 'light';
  const savedLocale = localStorage.getItem(STORAGE_KEYS.locale);
  const locale: Locale = (LOCALES as readonly string[]).includes(savedLocale ?? '') ? (savedLocale as Locale) : 'en';
  return {
    theme,
    layer: localStorage.getItem(STORAGE_KEYS.layer) ?? 'all',
    query: localStorage.getItem(STORAGE_KEYS.query) ?? '',
    locale,
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
  localStorage.setItem(STORAGE_KEYS.locale, state.locale);
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.setAttribute('data-locale', state.locale);
};

const setState = (patch: Partial<State>): void => {
  state = { ...state, ...patch };
  persist();
  if (rootEl) render(rootEl, App());
};

// V10: 4-tier locale fallback for engine metadata fields. Returns the value in the
// current locale if present, otherwise falls back through nearby locales then en.
const pickI18n = <T,>(en: T, zh?: T | null, ja?: T | null, ko?: T | null): T => {
  if (state.locale === 'ja') return (ja ?? ko ?? zh ?? en) as T;
  if (state.locale === 'ko') return (ko ?? ja ?? zh ?? en) as T;
  if (state.locale === 'zh') return (zh ?? ja ?? ko ?? en) as T;
  return en;
};

// Like pickI18n but accepts `field` (engine-meta locale variant suffix) and looks up
// the right field. Used when wiring App.ts UI to render the localized name/description.
const pickMeta = (e: EngineMeta, field: 'name' | 'description' | 'useCase'): string => {
  if (state.locale === 'ja') return e[`${field}Ja` as const] ?? e[`${field}Ko` as const] ?? e[`${field}Zh` as const] ?? e[field];
  if (state.locale === 'ko') return e[`${field}Ko` as const] ?? e[`${field}Ja` as const] ?? e[`${field}Zh` as const] ?? e[field];
  if (state.locale === 'zh') return e[`${field}Zh` as const] ?? e[`${field}Ja` as const] ?? e[`${field}Ko` as const] ?? e[field];
  return e[field];
};

const filterEngines = (): EngineMeta[] => {
  return MEMORY_ENGINES.filter(e => {
    const layerOk = state.layer === 'all' || e.layer === state.layer;
    const q = state.query.trim().toLowerCase();
    if (!q) return layerOk;
    const haystack = [
      e.name,
      pickI18n(e.description, e.descriptionZh) ?? '',
      pickI18n(e.useCase, e.useCaseZh) ?? '',
    ].join(' ').toLowerCase();
    return layerOk && haystack.includes(q);
  });
};

const formatStars = (n: number): string => n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const renderEngineCard = (e: EngineMeta): VNode => {
  const rating = e.ratingCount > 0 ? e.ratingSum / e.ratingCount : 0;
  const isHovered = state.hoveredEngine === e.id;
  const engineName = pickI18n(e.name, e.nameZh) ?? e.name;
  const layerLabel = LAYER_LABELS[state.locale][e.layer] ?? e.layer;
  const description = pickI18n(e.description, e.descriptionZh) ?? e.description;
  const useCase = pickI18n(e.useCase, e.useCaseZh) ?? e.useCase;
  return h('article', { class: 'engine-card', 'data-engine-id': e.id },
    h('div', { class: 'engine-header' },
      h('h3', { class: 'engine-name' }, engineName,
        h('span', { class: 'engine-layer-badge' }, layerLabel)),
    ),
    h('div', { class: 'engine-use-case' }, description),
    h('div', { class: 'engine-use-case', style: { color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' } }, `${t('app.card.when', state.locale)}: ${useCase}`),
    h('pre', { class: 'engine-code-block' }, e.codePreview),
    h('div', { class: 'engine-meta' },
      h('span', null, '↓ ', formatStars(e.pulled), ' ', t('app.meta.installs_label', state.locale), ' · ',
        h('strong', null, `★ ${rating.toFixed(1)}`), ' (', String(e.ratingCount), ')'),
    ),
    h('div', { class: 'engine-actions' },
      h('button', {
        class: 'btn btn-primary',
        onClick: () => { state.demoFor = e.id; state.demoResult = runDemo(e.id); state.hoveredEngine = null; if (rootEl) render(rootEl, App()); },
      }, isHovered ? t('app.card.try_now_active', state.locale) : t('app.card.try_now', state.locale)),
      h('button', {
        class: 'btn btn-ghost',
        onClick: () => { setState({ hoveredEngine: isHovered ? null : e.id }); },
      }, isHovered ? t('app.card.hide_code', state.locale) : t('app.card.show_code', state.locale)),
    ),
  );
};

const renderModal = (): VNode | null => {
  if (!state.demoFor || !state.demoResult) return null;
  const e = MEMORY_ENGINES.find(x => x.id === state.demoFor);
  if (!e) return null;
  const r = state.demoResult;
  const engineName = pickI18n(e.name, e.nameZh) ?? e.name;
  const layerLabel = LAYER_LABELS[state.locale][e.layer] ?? e.layer;
  const description = pickI18n(e.description, e.descriptionZh) ?? e.description;
  return h('div', { class: 'modal-overlay', onClick: () => setState({ demoFor: null, demoResult: null }) },
    h('div', { class: 'modal', onClick: (ev: Event) => ev.stopPropagation() },
      h('h3', null, engineName, h('span', { class: 'engine-layer-badge', style: { marginLeft: '8px' } }, layerLabel)),
      h('div', { class: 'modal-section' },
        h('div', { class: 'modal-section-title' }, t('app.modal.steps', state.locale)),
        h('div', { class: 'engine-use-case' }, description),
      ),
      h('div', { class: 'modal-section' },
        h('div', { class: 'modal-section-title' }, `${t('app.modal.output', state.locale)} (${r.steps.length} · ${r.durationMs.toFixed(2)}ms)`),
        h('pre', { class: 'code-output' }, r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')),
      ),
      h('div', { class: 'modal-section' },
        h('div', { class: 'modal-section-title' }, t('app.modal.output', state.locale)),
        h('pre', { class: 'code-output' }, r.output),
      ),
      h('div', { class: 'engine-actions', style: { borderTop: 'none', marginTop: '8px' } },
        h('button', { class: 'btn btn-primary', onClick: () => setState({ demoFor: null, demoResult: null }) }, t('app.modal.close', state.locale)),
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
          h('div', null, t('app.brand.title', state.locale)),
          h('div', { style: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' } }, t('app.brand.subtitle', state.locale)),
        ),
      ),
      h('div', { class: 'search-bar' },
        h('input', {
          type: 'search',
          placeholder: t('app.search.placeholder', state.locale),
          value: state.query,
          oninput: (ev: Event) => { setState({ query: (ev.target as HTMLInputElement).value }); },
        }),
      ),
      h('div', { class: 'header-actions' },
        // Locale switcher (EN | 中文)
        h('div', { class: 'theme-switcher', role: 'group', 'aria-label': t('app.lang.label', state.locale) },
          ...LOCALES.map(loc =>
            h('button', {
              class: `theme-btn ${state.locale === loc ? 'active' : ''}`,
              onClick: () => setState({ locale: loc }),
              'aria-label': loc === 'en' ? 'English' : '中文',
              'aria-pressed': state.locale === loc,
            }, t(loc === 'en' ? 'app.lang.en' : 'app.lang.zh', state.locale)),
          ),
        ),
        // Theme switcher
        h('div', { class: 'theme-switcher', role: 'group', 'aria-label': t('app.theme.label', state.locale) },
          ...THEMES.map(theme =>
            h('button', {
              key: theme,
              class: `theme-btn ${state.theme === theme ? 'active' : ''}`,
              onClick: () => setState({ theme }),
              'aria-label': `${theme} ${t('app.theme.label', state.locale)}`,
              'aria-pressed': state.theme === theme,
            }, `${theme === 'light' ? '☀' : theme === 'dark' ? '🌙' : theme === 'sepia' ? '📜' : '❄'} ${t(`app.theme.${theme}`, state.locale)}`),
          ),
        ),
      ),
    ),
    h('main', { class: 'main' },
      h('div', { class: 'hero' },
        h('h1', null, t('app.hero.title', state.locale)),
        h('p', null, t('app.hero.description', state.locale)),
        h('div', { class: 'hero-meta' },
          h('span', null, h('strong', null, String(MEMORY_ENGINES.length)), ` ${t('app.hero.stats.engines', state.locale)}`),
          h('span', null, '•'),
          h('span', null, h('strong', null, String(LAYERS.length)), ` ${t('app.hero.stats.layers', state.locale)}`),
          h('span', null, '•'),
          h('span', null, h('strong', null, formatStars(totalInstalls)), ` ${t('app.hero.stats.installs', state.locale)}`),
        ),
      ),
      h('div', { class: 'toolbar' },
        h('button', { class: `layer-chip ${state.layer === 'all' ? 'active' : ''}`, onClick: () => setState({ layer: 'all' }) },
          h('span', { class: 'layer-dot', style: { background: '#888' } }),
          `${t('app.toolbar.layer.all', state.locale)} (${MEMORY_ENGINES.length})`,
        ),
        ...LAYERS.map(l =>
          h('button', {
            key: l.id,
            class: `layer-chip ${state.layer === l.id ? 'active' : ''}`,
            onClick: () => setState({ layer: l.id }),
          },
            h('span', { class: 'layer-dot', style: { background: l.color } }),
            `${LAYER_LABELS[state.locale][l.id] ?? l.label} (${layerCounts[l.id] ?? 0})`,
          ),
        ),
      ),
      engines.length === 0
        ? h('div', { class: 'empty-state' },
            h('h3', null, t('app.empty.title', state.locale)),
            h('p', null, t('app.empty.description', state.locale)))
        : h('div', { class: 'engine-grid' },
            ...engines.map(renderEngineCard)),
    ),
    h('footer', { class: 'footer' },
      h('p', null,
        t('app.footer', state.locale, { n: MEMORY_ENGINES.length }),
      ),
    ),
    renderModal(),
  );
};

export const mountApp = (root: HTMLElement): void => {
  rootEl = root;
  persist();
  render(root, App());
};
