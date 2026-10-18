import { apiFetch } from './api';
/**
 * Character Name Localization and Translation Utility
 *
 * Automatically translates or localizes character names to match the selected subtitle language.
 * Supports known movie/series character canons (e.g. Belle, Beast, Gaston, Maurice, Chip, etc.)
 * as well as dynamically transliterating/translating arbitrary character names into any target language
 * using localized cache and on-demand translation.
 */

// Well-known canonical character translations across popular languages
const CANONICAL_CHARACTERS: Record<string, Record<string, string>> = {
  // Beauty and the Beast
  belle: {
    en: 'BELLE',
    es: 'BELLA',
    fr: 'BELLE',
    ar: 'بيل',
    de: 'BELLE',
    it: 'BELLA',
    pt: 'BELA',
    ru: 'БЕЛЛЬ',
    ja: 'ベル',
    ko: '벨',
    zh: '贝儿',
    nl: 'BELLE',
  },
  beast: {
    en: 'BEAST',
    es: 'BESTIA',
    fr: 'LA BÊTE',
    ar: 'الوحش',
    de: 'DAS BIEST',
    it: 'LA BESTIA',
    pt: 'A FERA',
    ru: 'ЧУДОВИЩЕ',
    ja: '野獣',
    ko: '야수',
    zh: '野兽',
    nl: 'HET BEEST',
  },
  gaston: {
    en: 'GASTON',
    es: 'GASTÓN',
    fr: 'GASTON',
    ar: 'غاستون',
    de: 'GASTON',
    it: 'GASTONE',
    pt: 'GASTON',
    ru: 'ГАСТОН',
    ja: 'ガストン',
    ko: '가스통',
    zh: '加斯顿',
    nl: 'GASTON',
  },
  maurice: {
    en: 'MAURICE',
    es: 'MAURICIO',
    fr: 'MAURICE',
    ar: 'موريس',
    de: 'MAURICE',
    it: 'MAURIZIO',
    pt: 'MAURÍCIO',
    ru: 'МОРИС',
    ja: 'モーリス',
    ko: '모리스',
    zh: '莫里斯',
    nl: 'MAURICE',
  },
  lumiere: {
    en: 'LUMIERE',
    es: 'LUMIÈRE',
    fr: 'LUMIÈRE',
    ar: 'لوميير',
    de: 'LUMIÈRE',
    it: 'LUMIÈRE',
    pt: 'LUMIÈRE',
    ru: 'ЛЮМЬЕР',
    ja: 'ルミエール',
    ko: '뤼미에르',
    zh: '卢米埃',
    nl: 'LUMIÈRE',
  },
  cogsworth: {
    en: 'COGSWORTH',
    es: 'DIN DON',
    fr: 'BIG BEN',
    ar: 'كوغسوورث',
    de: 'HERR VON UNRUH',
    it: 'TOCKINS',
    pt: 'HORLÓGIO',
    ru: 'КОГСВОРТ',
    ja: 'コグスワース',
    ko: '콕스워스',
    zh: '葛士华',
    nl: 'PENDULE',
  },
  'mrs. potts': {
    en: 'MRS. POTTS',
    es: 'SRA. POTTS',
    fr: 'MME SAMOVAR',
    ar: 'السيدة بوتس',
    de: 'MADAME POTTINE',
    it: 'MRS. BRIC',
    pt: 'SRA. POTTS',
    ru: 'МИССИС ПОТТС',
    ja: 'ポット夫人',
    ko: '포트 부인',
    zh: '茶煲太太',
    nl: 'MEVROUW TUIT',
  },
  chip: {
    en: 'CHIP',
    es: 'CHIP',
    fr: 'CHIP',
    ar: 'تشيب',
    de: 'TASSILO',
    it: 'CHICCO',
    pt: 'CHIP',
    ru: 'ЧИП',
    ja: 'チップ',
    ko: '칩',
    zh: '阿齐',
    nl: 'BARSTJE',
  },
  narrator: {
    en: 'NARRATOR',
    es: 'NARRADOR',
    fr: 'NARRATEUR',
    ar: 'الراوي',
    de: 'ERZÄHLER',
    it: 'NARRATORE',
    pt: 'NARRADOR',
    ru: 'РАССКАЗЧИК',
    ja: 'ナレーター',
    ko: '내레이터',
    zh: '旁白',
    nl: 'VERTELPER',
  },
};

const CHAR_TRANS_CACHE_KEY = 'subflow_character_translations_cache';

function getMemoryCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CHAR_TRANS_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveToMemoryCache(key: string, val: string) {
  try {
    const cache = getMemoryCache();
    cache[key] = val;
    localStorage.setItem(CHAR_TRANS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * Synchronously retrieves character name in target language.
 * Checks canon table, persistent translation cache, and triggers background AI translation if missing.
 */
export function getLocalizedCharacterName(name: string, targetLanguage = 'en'): string {
  if (!name || !name.trim()) return name;
  const lang = (targetLanguage || 'en').toLowerCase();
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();

  // If language is English, return original name
  if (lang === 'en') {
    return trimmed;
  }

  // 1. Check canonical table
  if (CANONICAL_CHARACTERS[key] && CANONICAL_CHARACTERS[key][lang]) {
    return CANONICAL_CHARACTERS[key][lang];
  }

  // Strip common punctuation (e.g. "Belle:" or "(Belle)")
  const cleanKey = key.replace(/[():]/g, '').trim();
  if (CANONICAL_CHARACTERS[cleanKey] && CANONICAL_CHARACTERS[cleanKey][lang]) {
    return CANONICAL_CHARACTERS[cleanKey][lang];
  }

  // 2. Check localized persistent cache
  const cacheKey = `${lang}_${cleanKey}`;
  const cache = getMemoryCache();
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // 3. Fallback: Trigger non-blocking background fetch so future frames use it immediately
  apiFetch('/api/translate-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lines: [{ lineNumber: 1, text: trimmed }],
      targetLang: lang,
      sourceLang: 'en',
      targetType: 'Normal',
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.translatedLines?.[0]?.text) {
        const translated = data.translatedLines[0].text.trim().toUpperCase();
        saveToMemoryCache(cacheKey, translated);
      }
    })
    .catch(() => {});

  return trimmed;
}
