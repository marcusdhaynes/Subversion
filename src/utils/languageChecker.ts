/**
 * Utility to verify whether subtitle lines are 100% in the target language
 * and identify any untranslated or partially untranslated lines.
 */

import { SubtitleLine } from '../types/subtitle';

// High-frequency, distinctive English words that do not belong in non-English subtitle translations
const ENGLISH_DISTINCTIVE_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'and', 'to', 'of', 'in', 'that', 'have', 'it', 'for', 'not',
  'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can',
  'like', 'time', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'here', 'picture',
  'dreams', 'wife', 'feet', 'floor', 'dogs', 'hunting', 'lodge', 'fire', 'kill', 'roasting',
  'while', 'little', 'ones', 'play', 'plenty', 'where', 'should', 'tell', 'said', 'down', 'did',
  'get', 'made', 'part', 'eyes', 'water', 'long', 'very', 'words', 'life', 'being', 'those', 'why',
  'before', 'turn', 'same', 'mean', 'move', 'right', 'boy', 'old', 'too', 'does', 'tell', 'set',
  'three', 'air', 'small', 'end', 'put', 'home', 'read', 'hand', 'large', 'add', 'even', 'land',
  'must', 'big', 'high', 'such', 'follow', 'act', 'ask', 'men', 'change', 'went', 'light', 'kind',
  'off', 'need', 'house', 'try', 'again', 'animal', 'point', 'mother', 'world', 'near', 'build',
  'self', 'earth', 'father', 'head', 'stand', 'own', 'page', 'should', 'country', 'found', 'answer',
  'school', 'grow', 'study', 'still', 'learn', 'plant', 'cover', 'food', 'sun', 'four', 'thought',
  'let', 'keep', 'eye', 'never', 'last', 'door', 'between', 'city', 'tree', 'cross', 'since',
  'hard', 'start', 'might', 'story', 'saw', 'far', 'sea', 'draw', 'left', 'late', 'run', 'don\'t',
  'can\'t', 'won\'t', 'didn\'t', 'haven\'t', 'doesn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t',
  'always', 'never', 'together', 'forever', 'morning', 'night', 'tonight', 'tomorrow', 'yesterday',
  'sorry', 'fine', 'sure', 'nothing', 'everything', 'something', 'anything', 'daughter', 'sister',
  'brother', 'friend', 'someone', 'everyone', 'anyone', 'somewhere', 'anywhere', 'nowhere', 'wait',
  'stop', 'listen', 'hear', 'help', 'please', 'thanks', 'thank', 'welcome', 'hello', 'goodbye'
]);

// Non-Latin script regex patterns
const SCRIPT_PATTERNS: Record<string, RegExp> = {
  ar: /[\u0600-\u06FF]/, // Arabic
  ru: /[\u0400-\u04FF]/, // Cyrillic / Russian
  uk: /[\u0400-\u04FF]/, // Ukrainian
  ja: /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/, // Japanese
  ko: /[\uac00-\ud7af\u1100-\u11ff]/, // Korean
  zh: /[\u4e00-\u9fff]/, // Chinese
  'zh-cn': /[\u4e00-\u9fff]/,
  'zh-tw': /[\u4e00-\u9fff]/,
  'zh-hk': /[\u4e00-\u9fff]/,
  yue: /[\u4e00-\u9fff]/,
  hi: /[\u0900-\u097F]/, // Hindi
  he: /[\u0590-\u05FF]/, // Hebrew
  el: /[\u0370-\u03FF]/, // Greek
  th: /[\u0e00-\u0e7f]/, // Thai
};

/**
 * Checks if a single text line is confirmed to be 100% in the target language.
 */
export function isLineInTargetLanguage(text: string, targetLang: string, sourceText?: string): boolean {
  if (!text || !text.trim()) return true;

  const trimmed = text.trim();

  // Purely punctuation, numbers, timestamps, musical notes, or bracketed sound effects
  const withoutCues = trimmed.replace(/\[[^\]]*\]/g, '').replace(/♪[^♪]*♪/g, '').trim();
  if (!withoutCues) return true; // Just cues

  // Check if identical to source text (if source was provided and has alphabetic text)
  if (sourceText && sourceText.trim() === trimmed) {
    const hasAlpha = /[a-zA-Z\u00C0-\u024F\u0600-\u06FF\u0400-\u04FF]/.test(trimmed);
    if (hasAlpha) return false;
  }

  const langPrefix = targetLang.toLowerCase().split('-')[0];

  // 1. If target language has a distinct non-Latin script, verify presence of that script
  if (SCRIPT_PATTERNS[langPrefix] || SCRIPT_PATTERNS[targetLang.toLowerCase()]) {
    const pattern = SCRIPT_PATTERNS[langPrefix] || SCRIPT_PATTERNS[targetLang.toLowerCase()];
    const hasTargetScript = pattern.test(withoutCues);
    // If it has alphabetic characters but none of the target script, it's not translated
    if (!hasTargetScript && /[a-zA-Z]/.test(withoutCues)) {
      return false;
    }
    // Strict check: In non-Latin script languages (e.g. Arabic, Russian, Japanese, Chinese),
    // dialogue lines must NOT retain leftover English words (e.g. "Not a word, Lumiere. ولا كلمة واحدة")
    const cleanDialogue = withoutCues.replace(/\[[^\]]*\]/g, '').replace(/♪[^♪]*♪/g, '').trim();
    const lingeringLatinWords = cleanDialogue.match(/[a-zA-Z]{2,}/g);
    if (lingeringLatinWords && lingeringLatinWords.length > 0) {
      return false;
    }
    return true;
  }

  // 2. For Latin-alphabet languages (e.g. Spanish, French, German, Italian, Portuguese)
  if (langPrefix !== 'en') {
    // Strip punctuation and extract words
    const cleanWords = withoutCues
      .toLowerCase()
      .replace(/[^a-z\u00C0-\u024F\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (cleanWords.length === 0) return true;

    // Count distinctive English words
    let englishWordCount = 0;
    for (const w of cleanWords) {
      if (ENGLISH_DISTINCTIVE_WORDS.has(w)) {
        englishWordCount++;
      }
    }

    // High sensitivity check: If line has distinctive English words
    // E.g. "este es the day your dreams come true" has multiple English words
    // E.g. "Plenty! Here. Picture this." has 4 English words
    if (cleanWords.length <= 4 && englishWordCount >= 1) {
      return false;
    }
    if (englishWordCount >= 2 || (cleanWords.length > 0 && englishWordCount / cleanWords.length >= 0.25)) {
      return false;
    }
  }

  return true;
}

/**
 * Filters and returns all lines that failed the target language check.
 */
export function findUntranslatedLines(
  translatedLines: SubtitleLine[],
  targetLang: string,
  sourceLines?: SubtitleLine[]
): SubtitleLine[] {
  const sourceMap = new Map<number, string>();
  if (sourceLines) {
    sourceLines.forEach((l) => sourceMap.set(l.lineNumber, l.text));
  }

  return translatedLines.filter((l) => {
    const srcText = sourceMap.get(l.lineNumber);
    return !isLineInTargetLanguage(l.text, targetLang, srcText);
  });
}
