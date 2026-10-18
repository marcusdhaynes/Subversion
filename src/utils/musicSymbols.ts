export const MUSIC_SYMBOLS = ['♪', '♫', '♬', '♩'] as const;
export type MusicSymbol = typeof MUSIC_SYMBOLS[number];

export type MusicPlacement = 'both' | 'start' | 'end' | 'none';

const MUSIC_REGEX = /^[♪♫♬♩\s]+|[♪♫♬♩\s]+$/g;

/**
 * Strips music notes from the start and end of text
 */
export function stripMusicSymbols(text: string): string {
  if (!text) return '';
  return text.replace(MUSIC_REGEX, '').trim();
}

/**
 * Detects existing musical symbols and their placement
 */
export function detectMusicState(text: string): {
  hasMusic: boolean;
  symbol: MusicSymbol;
  placement: MusicPlacement;
  cleanText: string;
} {
  const trimmed = (text || '').trim();
  const clean = stripMusicSymbols(trimmed);

  // Check which symbol is present
  const firstChar = trimmed.charAt(0);
  const lastChar = trimmed.charAt(trimmed.length - 1);

  const matchedSymbol: MusicSymbol = (
    MUSIC_SYMBOLS.find((s) => trimmed.includes(s)) || '♪'
  ) as MusicSymbol;

  const startsWith = MUSIC_SYMBOLS.some((s) => trimmed.startsWith(s));
  const endsWith = MUSIC_SYMBOLS.some((s) => trimmed.endsWith(s));

  if (startsWith && endsWith) {
    return { hasMusic: true, symbol: matchedSymbol, placement: 'both', cleanText: clean };
  } else if (startsWith) {
    return { hasMusic: true, symbol: matchedSymbol, placement: 'start', cleanText: clean };
  } else if (endsWith) {
    return { hasMusic: true, symbol: matchedSymbol, placement: 'end', cleanText: clean };
  }

  return { hasMusic: false, symbol: '♪', placement: 'none', cleanText: clean };
}

/**
 * Applies a musical symbol with the chosen placement
 */
export function applyMusic(
  text: string,
  symbol: string = '♪',
  placement: MusicPlacement = 'both'
): string {
  const clean = stripMusicSymbols(text);
  if (!clean) {
    if (placement === 'none') return '';
    if (placement === 'both') return `${symbol} ${symbol}`;
    return symbol;
  }

  switch (placement) {
    case 'both':
      return `${symbol} ${clean} ${symbol}`;
    case 'start':
      return `${symbol} ${clean}`;
    case 'end':
      return `${clean} ${symbol}`;
    case 'none':
    default:
      return clean;
  }
}
