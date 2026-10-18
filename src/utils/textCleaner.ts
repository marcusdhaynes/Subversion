/**
 * Subtitle Text Sanitizer & Markup Stripper
 *
 * Strips any content that is not actually dialogue text from subtitle strings,
 * including HTML/XML tags (<font...>, <span>, <b>, <i>, etc.), ASS/SSA override codes
 * ({\an9}, {\pos}, {\b1}, {\c&H...&}, etc.), cue markers, and dangling separators.
 */

export interface ExtractedStyles {
  cleanText: string;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

/**
 * Strips all HTML/XML tags, ASS/SSA override tags, and formatting artifacts.
 *
 * Examples:
 *   '<font face="Palatino Sans Arabic Bold" size="36" color="#f7f7f7"><b>هيَّا</b></font>'
 *   => 'هيَّا'
 *
 *   '<font face="Hacen Casablanca" size="34" color="#e9e9e9">{\\an9}: تفضَّلوا بزيارتنا على</font>'
 *   => 'تفضَّلوا بزيارتنا على'
 */
export function cleanSubtitleDialogue(rawText: string): string {
  if (!rawText) return '';

  // Ultra-fast path: If text has no HTML tags, curly braces, entities, or backslashes, return immediately
  if (!rawText.includes('<') && !rawText.includes('{') && !rawText.includes('&') && !rawText.includes('\\')) {
    return rawText.trim();
  }

  let text = String(rawText);

  // 1. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');

  // 2. Strip HTML / XML tags (<font ...>, </font>, <b>, <i>, <u>, <span>, etc.)
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');

  // 3. Strip ASS / SSA curly brace tags (e.g. {\an9}, {\pos(100,200)}, {\b1}, etc.)
  // and handle trailing colons / dashes like "{\an9}: " or "{\an8} - "
  text = text.replace(/\{[^{}]*\}(?:\s*[:\-–—]\s*|\s*)/g, '');

  // 4. Strip any remaining curly braces or unclosed tags
  text = text.replace(/\{[^}]*\}?/g, '');

  // 5. Strip ASS line breaks \N, \n, and hard space \h
  text = text.replace(/\\[Nn]/g, ' ').replace(/\\h/g, ' ');

  // 6. Strip Karaoke tags, WebVTT cue timestamps like <00:01.234> or [00:01:23]
  text = text.replace(/<[0-9:.]+>/g, '').replace(/\[\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\]/g, '');

  // 7. Strip leading separator artifacts left after tag removal (e.g. ": dialogue" or "- dialogue")
  text = text.replace(/^[:\-–—\s]+(?=[^\s:\-–—])/, '');

  // 8. Normalize multi-spaces and trim
  text = text.replace(/[\t\r\f]+/g, ' ').replace(/ +/g, ' ').trim();

  return text;
}

/**
 * Extracts typography overrides from tags (face, size, bold, italic)
 * while returning clean, pure dialogue text.
 */
export function parseAndCleanSubtitleText(rawText: string): ExtractedStyles {
  if (!rawText) return { cleanText: '' };

  // Ultra-fast path: If text has no markup tags or override braces, return immediately
  if (!rawText.includes('<') && !rawText.includes('{') && !rawText.includes('&') && !rawText.includes('\\')) {
    return { cleanText: rawText.trim() };
  }

  let font: string | undefined;
  let size: number | undefined;
  let bold: boolean | undefined;
  let italic: boolean | undefined;
  let color: string | undefined;

  // Extract from <font face="..." size="..." color="...">
  const fontMatch = rawText.match(/<font\s+([^>]+)>/i);
  if (fontMatch) {
    const attrs = fontMatch[1];
    const faceMatch = attrs.match(/face=["']([^"']+)["']/i);
    if (faceMatch && faceMatch[1].trim()) {
      font = faceMatch[1].trim();
    }

    const sizeMatch = attrs.match(/size=["']?(\d+)["']?/i);
    if (sizeMatch) {
      size = parseInt(sizeMatch[1], 10);
    }

    const colorMatch = attrs.match(/color=["']([^"']+)["']/i);
    if (colorMatch && colorMatch[1].trim()) {
      color = colorMatch[1].trim();
    }
  }

  // Extract from ASS {\fnFontName} and {\fsFontSize}
  const assFnMatch = rawText.match(/\{\\fn([^}]+)\}/i);
  if (assFnMatch && assFnMatch[1].trim()) {
    font = assFnMatch[1].trim();
  }

  const assFsMatch = rawText.match(/\{\\fs(\d+)\}/i);
  if (assFsMatch) {
    size = parseInt(assFsMatch[1], 10);
  }

  // Detect bold: <b> or {\b1} or {\b700} or in font name "Bold"
  if (/<b>/i.test(rawText) || /\{\\b[1-9]/i.test(rawText) || (font && /bold/i.test(font))) {
    bold = true;
  }

  // Detect italic: <i> or {\i1} or in font name "Italic" / "Oblique"
  if (/<i>/i.test(rawText) || /\{\\i1\}/i.test(rawText) || (font && /italic|oblique/i.test(font))) {
    italic = true;
  }

  const cleanText = cleanSubtitleDialogue(rawText);

  return {
    cleanText,
    font,
    size,
    bold,
    italic,
    color,
  };
}
