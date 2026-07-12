// V3-V10: i18n tests — EN, ZH, JA, KO
//
// Coverage:
//  - t() resolves key in each of the 4 locales
//  - 4-tier locale fallback via pickI18n (en, zh, ja, ko)
//  - LAYER_LABELS / LAYER_DESCS populated in all 4 locales
//  - STRINGS has same key set across all 4 locales
//  - No empty strings in any locale
//  - All 38 engines have nameJa + nameKo + descriptionJa + descriptionKo + useCaseJa + useCaseKo

import { describe, it, expect } from 'vitest';
import {
  t,
  LAYER_LABELS,
  LAYER_DESCS,
  STRINGS,
  LOCALES,
  pickI18n,
  firstI18n,
  ENGINE_FIELD_LOCALE_SUFFIX,
  type Locale,
} from './i18n';
import { MEMORY_ENGINES } from './memoryEngines';

describe('i18n.t() — basic key resolution (4 locales)', () => {
  it('returns EN string when locale = en', () => {
    expect(t('app.brand.title', 'en')).toBe('Agent Memory Marketplace');
    expect(t('app.lang.label', 'en')).toBe('Language');
  });

  it('returns ZH string when locale = zh', () => {
    expect(t('app.brand.title', 'zh')).toBe('智能体记忆引擎市场');
    expect(t('app.lang.label', 'zh')).toBe('语言');
  });

  it('returns JA string when locale = ja', () => {
    expect(t('app.brand.title', 'ja')).toBe('エージェントメモリー・マーケットプレース');
    expect(t('app.lang.label', 'ja')).toBe('言語');
  });

  it('returns KO string when locale = ko', () => {
    expect(t('app.brand.title', 'ko')).toBe('에이전트 메모리 마켓플레이스');
    expect(t('app.lang.label', 'ko')).toBe('언어');
  });

  it('falls back to EN when locale = en (default) but key missing', () => {
    expect(t('app.brand.title')).toBe('Agent Memory Marketplace');
  });

  it('substitutes {n} variables in each locale', () => {
    expect(t('app.footer', 'en', { n: 38 })).toContain('38 engines indexed');
    expect(t('app.footer', 'ja', { n: 38 })).toContain('38 件のエンジン');
    expect(t('app.footer', 'ko', { n: 38 })).toContain('38 개 엔진');
  });

  it('preserves key when translation missing', () => {
    expect(t('app.brand.nonexistent', 'en')).toBe('app.brand.nonexistent');
    expect(t('app.brand.nonexistent', 'ja')).toBe('app.brand.nonexistent');
  });
});

describe('i18n.LOCALES + ENGINE_FIELD_LOCALE_SUFFIX', () => {
  it('LOCALES lists exactly en/zh/ja/ko', () => {
    expect(LOCALES).toEqual(['en', 'zh', 'ja', 'ko']);
  });

  it('ENGINE_FIELD_LOCALE_SUFFIX maps every locale', () => {
    expect(ENGINE_FIELD_LOCALE_SUFFIX.en).toBe('');
    expect(ENGINE_FIELD_LOCALE_SUFFIX.zh).toBe('Zh');
    expect(ENGINE_FIELD_LOCALE_SUFFIX.ja).toBe('Ja');
    expect(ENGINE_FIELD_LOCALE_SUFFIX.ko).toBe('Ko');
  });
});

describe('i18n.pickI18n() — 4-tier locale fallback helper', () => {
  it('en request returns en', () => {
    expect(pickI18n('en', 'en-name', 'zh-name', 'ja-name', 'ko-name')).toBe('en-name');
  });

  it('zh request returns zh when supplied', () => {
    expect(pickI18n('zh', 'en-name', 'zh-name', 'ja-name', 'ko-name')).toBe('zh-name');
  });

  it('ja request returns ja when supplied', () => {
    expect(pickI18n('ja', 'en-name', 'zh-name', 'ja-name', 'ko-name')).toBe('ja-name');
  });

  it('ko request returns ko when supplied', () => {
    expect(pickI18n('ko', 'en-name', 'zh-name', 'ja-name', 'ko-name')).toBe('ko-name');
  });

  it('ja request falls through ko → zh → en if ja missing', () => {
    expect(pickI18n('ja', 'en-name', 'zh-name', undefined, 'ko-name')).toBe('ko-name');
    expect(pickI18n('ja', 'en-name', 'zh-name', undefined, undefined)).toBe('zh-name');
    expect(pickI18n('ja', 'en-name', undefined, undefined, undefined)).toBe('en-name');
  });

  it('zh request falls through ja → ko → en if zh missing', () => {
    expect(pickI18n('zh', 'en-name', undefined, 'ja-name', 'ko-name')).toBe('ja-name');
    expect(pickI18n('zh', 'en-name', undefined, undefined, 'ko-name')).toBe('ko-name');
  });

  it('ko request falls through ja → zh → en if ko missing', () => {
    expect(pickI18n('ko', 'en-name', 'zh-name', 'ja-name', undefined)).toBe('ja-name');
  });
});

describe('i18n.firstI18n() — generic first non-empty', () => {
  it('returns en when nothing else supplied', () => {
    expect(firstI18n('en-name')).toBe('en-name');
  });

  it('returns first non-empty', () => {
    expect(firstI18n('en-name', null, undefined, '', 'zh-name')).toBe('zh-name');
  });

  it('returns en if all optionals are empty', () => {
    expect(firstI18n('en-name', null, undefined, '')).toBe('en-name');
  });
});

describe('i18n.LAYER_LABELS — 17 layers × 4 locales', () => {
  it('EN labels are non-empty strings', () => {
    expect(LAYER_LABELS.en.episodic).toBe('Episodic');
    expect(LAYER_LABELS.en.memvector).toBe('MemVector');
    expect(LAYER_LABELS.en.federated).toBe('Federated');
  });

  it('ZH labels are non-empty strings and differ from EN', () => {
    expect(LAYER_LABELS.zh.episodic).toBe('事件记忆');
    expect(LAYER_LABELS.zh.semantic).toBe('语义记忆');
    expect(LAYER_LABELS.zh.memvector).toBe('向量检索');
    expect(LAYER_LABELS.zh.federated).toBe('联邦');
    expect(LAYER_LABELS.zh.episodic).not.toBe(LAYER_LABELS.en.episodic);
  });

  it('JA labels are non-empty strings and differ from EN', () => {
    expect(LAYER_LABELS.ja.episodic).toBe('エピソード記憶');
    expect(LAYER_LABELS.ja.semantic).toBe('意味記憶');
    expect(LAYER_LABELS.ja.memvector).toBe('ベクトル検索');
    expect(LAYER_LABELS.ja.federated).toBe('連合');
    expect(LAYER_LABELS.ja.episodic).not.toBe(LAYER_LABELS.en.episodic);
  });

  it('KO labels are non-empty strings and differ from EN', () => {
    expect(LAYER_LABELS.ko.episodic).toBe('에피소드 기억');
    expect(LAYER_LABELS.ko.semantic).toBe('시맨틱 기억');
    expect(LAYER_LABELS.ko.memvector).toBe('벡터 검색');
    expect(LAYER_LABELS.ko.federated).toBe('연합');
    expect(LAYER_LABELS.ko.episodic).not.toBe(LAYER_LABELS.en.episodic);
  });

  it('all 4 locales have all 17 layers', () => {
    const keys = [
      'episodic', 'semantic', 'procedural', 'consolidation',
      'short-term', 'long-term', 'working', 'associative',
      'compressor', 'integration', 'memvector',
      'multimodal', 'mcp', 'migration', 'streaming',
      'playback', 'federated',
    ];
    for (const locale of LOCALES) {
      for (const k of keys) {
        expect(LAYER_LABELS[locale][k], `${locale}.${k}`).toBeTruthy();
      }
    }
  });
});

describe('i18n.LAYER_DESCS — 17 layers × 4 locales', () => {
  it('all 17 layers have descriptions in all 4 locales', () => {
    const keys = [
      'episodic', 'semantic', 'procedural', 'consolidation',
      'short-term', 'long-term', 'working', 'associative',
      'compressor', 'integration', 'memvector',
      'multimodal', 'mcp', 'migration', 'streaming',
      'playback', 'federated',
    ];
    for (const locale of LOCALES) {
      for (const k of keys) {
        expect(LAYER_DESCS[locale][k], `${locale}.${k}`).toBeTruthy();
      }
    }
  });

  it('ZH/JA/KO descriptions are valid (≥2 chars)', () => {
    for (const locale of ['zh', 'ja', 'ko'] as const) {
      for (const [_k, desc] of Object.entries(LAYER_DESCS[locale])) {
        expect(desc.length, `${locale}.${_k}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('i18n.STRINGS — all 4 locales have matching key counts', () => {
  it('all 4 locales have identical key sets', () => {
    const enKeys = Object.keys(STRINGS.en).sort();
    for (const locale of ['zh', 'ja', 'ko'] as const) {
      const keys = Object.keys(STRINGS[locale]).sort();
      expect(keys, locale).toEqual(enKeys);
    }
  });

  it('no empty strings in any locale', () => {
    for (const locale of LOCALES) {
      for (const [k, v] of Object.entries(STRINGS[locale])) {
        expect(v.length, `${locale}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it('each locale has the locale switcher button text', () => {
    expect(STRINGS.en['app.lang.ja']).toBe('日本語');
    expect(STRINGS.zh['app.lang.ja']).toBe('日本語');
    expect(STRINGS.ja['app.lang.ja']).toBe('日本語');
    expect(STRINGS.ko['app.lang.ja']).toBe('日本語');
    expect(STRINGS.en['app.lang.ko']).toBe('한국어');
    expect(STRINGS.ja['app.lang.ko']).toBe('한국어');
    expect(STRINGS.ko['app.lang.ko']).toBe('한국어');
  });
});

describe('memoryEngines metadata — V10 4-locale coverage', () => {
  it('38 engines total', () => {
    expect(MEMORY_ENGINES.length).toBe(38);
  });

  it('all 38 engines have nameJa + nameKo populated', () => {
    for (const e of MEMORY_ENGINES) {
      expect(e.nameJa, `${e.id}.nameJa`).toBeTruthy();
      expect(e.nameKo, `${e.id}.nameKo`).toBeTruthy();
    }
  });

  it('all 38 engines have descriptionJa + descriptionKo populated', () => {
    for (const e of MEMORY_ENGINES) {
      expect(e.descriptionJa, `${e.id}.descriptionJa`).toBeTruthy();
      expect(e.descriptionJa.length, `${e.id}.descriptionJa`).toBeGreaterThanOrEqual(2);
      expect(e.descriptionKo, `${e.id}.descriptionKo`).toBeTruthy();
      expect(e.descriptionKo.length, `${e.id}.descriptionKo`).toBeGreaterThanOrEqual(2);
    }
  });

  it('all 38 engines have useCaseJa + useCaseKo populated', () => {
    for (const e of MEMORY_ENGINES) {
      expect(e.useCaseJa, `${e.id}.useCaseJa`).toBeTruthy();
      expect(e.useCaseKo, `${e.id}.useCaseKo`).toBeTruthy();
    }
  });

  it('JA/KO names are distinct from EN names (not just copy-paste)', () => {
    const enJaSame = MEMORY_ENGINES.filter((e) => e.name === e.nameJa);
    expect(enJaSame.length, `engines with name === nameJa`).toBe(0);
    const enKoSame = MEMORY_ENGINES.filter((e) => e.name === e.nameKo);
    expect(enKoSame.length, `engines with name === nameKo`).toBe(0);
  });
});
