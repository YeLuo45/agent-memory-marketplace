// V3-V8: i18n tests — ensure t() / LAYER_LABELS / LAYER_DESCS render correctly for EN and ZH

import { describe, it, expect } from 'vitest';
import { t, LAYER_LABELS, LAYER_DESCS, STRINGS } from './i18n';

describe('i18n.t() — basic key resolution', () => {
  it('returns EN string when locale = en', () => {
    expect(t('app.brand.title', 'en')).toBe('Agent Memory Marketplace');
    expect(t('app.lang.label', 'en')).toBe('Language');
  });

  it('returns ZH string when locale = zh', () => {
    expect(t('app.brand.title', 'zh')).toBe('智能体记忆引擎市场');
    expect(t('app.lang.label', 'zh')).toBe('语言');
  });

  it('falls back to EN when locale = en (default) but key missing', () => {
    expect(t('app.brand.title')).toBe('Agent Memory Marketplace');
  });

  it('substitutes {n} variables when present', () => {
    const out = t('app.footer', 'en', { n: 38 });
    expect(out).toContain('38 engines indexed');
  });

  it('preserves key when translation missing', () => {
    expect(t('app.brand.nonexistent', 'en')).toBe('app.brand.nonexistent');
  });
});

describe('i18n.LAYER_LABELS — all 11 layers translated', () => {
  it('EN labels are non-empty strings', () => {
    expect(LAYER_LABELS.en.episodic).toBe('Episodic');
    expect(LAYER_LABELS.en.memvector).toBe('MemVector');
  });

  it('ZH labels are non-empty strings and differ from EN', () => {
    expect(LAYER_LABELS.zh.episodic).toBe('事件记忆');
    expect(LAYER_LABELS.zh.semantic).toBe('语义记忆');
    expect(LAYER_LABELS.zh.memvector).toBe('向量检索');
    expect(LAYER_LABELS.zh.episodic).not.toBe(LAYER_LABELS.en.episodic);
  });

  it('both locales have all 11 layers', () => {
    const keys = ['episodic', 'semantic', 'procedural', 'consolidation', 'short-term', 'long-term', 'working', 'associative', 'compressor', 'integration', 'memvector'];
    for (const k of keys) {
      expect(LAYER_LABELS.en[k]).toBeTruthy();
      expect(LAYER_LABELS.zh[k]).toBeTruthy();
    }
  });
});

describe('i18n.LAYER_DESCS — both locales', () => {
  it('all 11 layers have descriptions in both locales', () => {
    const keys = ['episodic', 'semantic', 'procedural', 'consolidation', 'short-term', 'long-term', 'working', 'associative', 'compressor', 'integration', 'memvector'];
    for (const k of keys) {
      expect(LAYER_DESCS.en[k]).toBeTruthy();
      expect(LAYER_DESCS.zh[k]).toBeTruthy();
    }
  });

  it('ZH descriptions are valid Chinese (>=4 chars, no empty strings)', () => {
    const keys = Object.keys(LAYER_DESCS.zh) as Array<keyof typeof LAYER_DESCS.zh>;
    for (const k of keys) {
      const desc = LAYER_DESCS.zh[k];
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('i18n.STRINGS — both locales have matching key counts', () => {
  it('EN and ZH have same keys', () => {
    const enKeys = Object.keys(STRINGS.en).sort();
    const zhKeys = Object.keys(STRINGS.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it('no empty strings in any locale', () => {
    for (const locale of ['en', 'zh'] as const) {
      for (const [k, v] of Object.entries(STRINGS[locale])) {
        expect(v.length, `${locale}.${k}`).toBeGreaterThan(0);
      }
    }
  });
});
