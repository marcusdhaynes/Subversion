export interface CharacterStyle {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  color?: string;
}

export interface Character {
  id: string;
  name: string;
  color: string; // Hex color code for badges/subtitles
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  description?: string;
}

export interface FlagData {
  isFlagged: boolean;
  code?: string; // e.g. 'ERR-SYNC', 'ERR-CPS', 'ERR-SPELL', 'ERR-TRANSLATE', 'ERR-STYLE', 'ERR-FIX'
  note?: string; // Editor instructions on what to do/fix
  author?: string; // Collaborator who flagged it
  resolved?: boolean;
  createdAt?: number;
}

export interface ShadowSettings {
  enabled?: boolean;
  color?: string; // Hex color code, e.g. #000000
  opacity?: number; // 0 to 100
  distance?: number; // 0 to 20 px
  angle?: number; // 0 to 360 degrees
  blur?: number; // 0 to 20 px
}

export interface OutlineSettings {
  enabled?: boolean;
  color?: string; // Hex color code, e.g. #000000
  opacity?: number; // 0 to 100
  size?: number; // Spread / thickness, 0 to 20 px
  glow?: number; // Glow blur, 0 to 20 px
}

export interface SubtitleGroup {
  id: string;
  name: string;
  parentGroupId?: string | null; // For nested sub-groups (groups within groups)
  collapsed?: boolean;
  color?: string; // Subtitle text color override for whole group
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  shadow?: ShadowSettings;
  outline?: OutlineSettings;
  hasMusicSymbols?: boolean;
  characterId?: string;
  note?: string;
}

export interface SubtitleLine {
  id: string;
  lineNumber: number; // 1-based, rendered as 4-digit (0001)
  startTime: string; // HH:MM:SS.mmm (e.g. 00:00:01.500)
  endTime: string;   // HH:MM:SS.mmm (e.g. 00:00:04.200)
  groupId?: string | null; // Optional group / folder ID this line belongs to
  characterId?: string; // Optional character ID
  font?: string;     // Specific font override or null to inherit
  size?: number;     // Specific size override or null to inherit
  bold?: boolean;    // Specific bold override
  italic?: boolean;  // Specific italic override
  underline?: boolean; // Underline override
  strikethrough?: boolean; // Strike-through override
  superscript?: boolean; // Superscript override
  subscript?: boolean; // Subscript override
  color?: string;    // Specific subtitle text color override (hex format e.g. #FFFFFF)
  shadow?: ShadowSettings; // Drop-shadow settings
  outline?: OutlineSettings; // Outline (shadow + glow combined) settings
  hasMusicSymbols?: boolean; // Little music symbols on each side of the line
  text: string;      // Subtitle line text
  flag?: FlagData;   // Flag with red error code-like highlight & note
  activeUserEditing?: string; // ID or Name of user currently focused here
}

export type SubtitleTrackType = 'Normal' | 'Forced' | 'CC' | 'SDH' | 'Commentary' | 'Lyrics';

export type LanguageListDisplayMode = 'native' | 'app';

export interface DefaultProjectSettings {
  color?: string; // Default text color override for project/title
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  shadow?: ShadowSettings; // Default shadow for project/title
  outline?: OutlineSettings; // Default outline for project/title
  cpsLimit: number; // Characters per second warning threshold (default 21)
  maxLineLength: number; // Suggested line length (e.g. 42 chars)
  rememberCharacterListScroll?: boolean; // Remember scroll position when character assignment dropdown is reopened
  defaultLanguage?: string; // Default project language code (default 'en')
  languageListDisplay?: LanguageListDisplayMode; // 'native' | 'app' (default 'native')
  rewindSeconds?: number; // Video rewind skip seconds (default 10)
  fastForwardSeconds?: number; // Video fast-forward skip seconds (default 10)
}

export interface CollaboratorUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  role?: string;
  currentLineId?: string | null;
  lastActive: number;
}

export interface Series {
  id: string;
  name: string;
  description?: string;
  color: string;
  defaultSettings: DefaultProjectSettings;
  characters: Character[];
  createdAt?: number;
  updatedAt?: number;
}

export type MediaMedium = 'Movie' | 'TV Show' | 'Audio Drama' | 'Anime' | 'Podcast' | 'Web Series' | 'Other';

export interface DatabaseSubtitleTrack {
  id: string; // e.g., "matrix_theatrical_en_Normal"
  medium: MediaMedium;
  title: string;
  season: string;
  episode: string;
  variant: string;
  language: string;
  trackType: SubtitleTrackType;
  isPrimary?: boolean;
  lines: SubtitleLine[];
  format?: string;
  lastSavedAt: number;
  videoKey?: string;
  videoTitle?: string;
  sourceFileName?: string;
}

export interface AssociatedSubtitleTrack {
  id: string; // `${language}_${trackType}`
  videoKey: string;
  videoTitle: string;
  name: string;
  language: string;
  trackType: SubtitleTrackType;
  lastSavedDirectory?: string;
  lastSavedFileName?: string;
  lastSavedAt: number;
  linesCount: number;
  content?: string;
  lines?: SubtitleLine[];
  isMissing?: boolean;
  fileHandle?: any;
}

export interface VideoSourceInfo {
  key: string;
  title: string;
  url: string;
  sourceType: 'file' | 'url' | 'sample' | 'youtube';
  fileName?: string;
  youtubeId?: string;
  file?: File;
  fileHandle?: FileSystemFileHandle;
}

export interface SubtitleProject {
  id: string;
  title: string;
  fps: number;
  seriesId?: string; // ID of the series this project belongs to
  seriesList?: Series[]; // Saved series library
  language?: string; // Language code (e.g. 'en', 'es', 'ja')
  trackType?: SubtitleTrackType; // Subtitle track type (Normal, Forced, CC, SDH, Commentary, Lyrics)
  videoUrl?: string;
  defaultSettings: DefaultProjectSettings;
  characters: Character[];
  lines: SubtitleLine[];
  groups?: SubtitleGroup[]; // Hierarchical folders and sub-folders
  updatedAt: number;
}

export const COMMON_FONTS = [
  'Inter',
  'Roboto',
  'Arial',
  'Helvetica',
  'Verdana',
  'Trebuchet MS',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',
  'Lucida Console',
  'Comic Neue',
] as const;

export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48] as const;

export const PRESET_FLAG_CODES = [
  { code: 'ERR-SYNC', label: 'Audio Sync Offset', desc: 'Audio and subtitle out of sync' },
  { code: 'ERR-CPS', label: 'Reading Speed High', desc: 'CPS exceeds readable threshold' },
  { code: 'ERR-TRANSLATE', label: 'Translation Check', desc: 'Verify dialect or idiom context' },
  { code: 'ERR-GRAMMAR', label: 'Grammar / Typos', desc: 'Spelling or syntax correction needed' },
  { code: 'ERR-OVERLAP', label: 'Timecode Overlap', desc: 'Overlaps with adjacent line' },
  { code: 'ERR-SPEAKER', label: 'Wrong Speaker', desc: 'Assign to correct character' },
  { code: 'ERR-FORMAT', label: 'Style / Line Break', desc: 'Break line or adjust punctuation' },
  { code: 'ERR-CUSTOM', label: 'General Fix Required', desc: 'Review editor note below' },
] as const;

export const CHARACTER_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#84cc16', // lime
  '#6366f1', // indigo
  '#d946ef', // fuchsia
] as const;
