import { apiFetch } from './api';
import { SubtitleLine, SubtitleTrackType } from '../types/subtitle';
import { openDB } from './fileResumeStorage';

export type MediaMedium = 'Movie' | 'TV Show' | 'Audio Drama' | 'Anime' | 'Podcast' | 'Web Series' | 'Other';

export interface DatabaseSubtitleTrack {
  id: string; // e.g., "matrix_theatrical_en_Normal"
  medium: MediaMedium;
  title: string; // e.g., "The Matrix", "Digimon", "We're Alive"
  season: string; // e.g., "Feature Film", "Season 1"
  episode: string; // e.g., "Theatrical Release", "Episode 1"
  variant: string; // e.g., "Standard", "Director's Cut"
  language: string; // e.g., "en", "es", "ja", "de"
  trackType: SubtitleTrackType; // "Normal" | "CC" | "SDH" | "Forced" | "Commentary" | "Dub"
  isPrimary?: boolean; // Primary reference track for this variant
  lines: SubtitleLine[];
  format?: string;
  lastSavedAt: number;
  videoKey?: string;
  videoTitle?: string;
  sourceFileName?: string;
}

const MEDIA_DB_STORAGE_KEY = 'subflow_media_database_v1';
const STORE_MEDIA_DB = 'media_database_store';

// Pre-seeded starter library showcasing the user's exact hierarchy structure:
// Medium -> Title -> Season -> Episode -> Variant -> Language -> Type
const SEED_TRACKS: DatabaseSubtitleTrack[] = [
  // 1. Movie -> The Matrix
  {
    id: 'movie_matrix_s1_ep1_std_en_normal',
    medium: 'Movie',
    title: 'The Matrix',
    season: 'Feature Film',
    episode: 'Theatrical Release',
    variant: 'Standard',
    language: 'en',
    trackType: 'Normal',
    isPrimary: true,
    lastSavedAt: Date.now() - 86400000,
    videoTitle: 'The Matrix (1999)',
    sourceFileName: 'The.Matrix.1999.Theatrical.en.srt',
    lines: [
      { id: 'mat-1', lineNumber: 1, startTime: '00:00:20.500', endTime: '00:00:23.800', text: 'Trinity... You are on a line we cannot protect.' },
      { id: 'mat-2', lineNumber: 2, startTime: '00:00:24.200', endTime: '00:00:27.500', text: 'I know. But I have to see him myself.' },
      { id: 'mat-3', lineNumber: 3, startTime: '00:00:28.000', endTime: '00:00:31.900', text: 'Morpheus believes he is the One. We are out of time.' },
      { id: 'mat-4', lineNumber: 4, startTime: '00:00:32.400', endTime: '00:00:36.100', text: 'The trace was completed. The agents are arriving now.' },
      { id: 'mat-5', lineNumber: 5, startTime: '00:00:36.500', endTime: '00:00:40.000', text: 'Wake up, Neo... The Matrix has you.' },
      { id: 'mat-6', lineNumber: 6, startTime: '00:00:41.000', endTime: '00:00:44.500', text: 'Follow the white rabbit. Knock, knock.' },
    ],
  },
  {
    id: 'movie_matrix_s1_ep1_std_en_cc',
    medium: 'Movie',
    title: 'The Matrix',
    season: 'Feature Film',
    episode: 'Theatrical Release',
    variant: 'Standard',
    language: 'en',
    trackType: 'CC',
    isPrimary: false,
    lastSavedAt: Date.now() - 82800000,
    videoTitle: 'The Matrix (1999)',
    sourceFileName: 'The.Matrix.1999.Theatrical.en.cc.srt',
    lines: [
      { id: 'mat-cc-1', lineNumber: 1, startTime: '00:00:20.500', endTime: '00:00:23.800', text: '[Soft digital pulse humming]\nTrinity... You are on a line we cannot protect.' },
      { id: 'mat-cc-2', lineNumber: 2, startTime: '00:00:24.200', endTime: '00:00:27.500', text: '[Keypad clacking rapidly]\nI know. But I have to see him myself.' },
      { id: 'mat-cc-3', lineNumber: 3, startTime: '00:00:28.000', endTime: '00:00:31.900', text: 'Morpheus believes he is the One. We are out of time.' },
      { id: 'mat-cc-4', lineNumber: 4, startTime: '00:00:32.400', endTime: '00:00:36.100', text: '[Siren wailing faintly in distance]\nThe trace was completed. The agents are arriving now.' },
      { id: 'mat-cc-5', lineNumber: 5, startTime: '00:00:36.500', endTime: '00:00:40.000', text: '[Computer terminal beeps]\nWake up, Neo... The Matrix has you.' },
      { id: 'mat-cc-6', lineNumber: 6, startTime: '00:00:41.000', endTime: '00:00:44.500', text: '[Knocking on apartment door]\nFollow the white rabbit. Knock, knock.' },
    ],
  },
  {
    id: 'movie_matrix_s1_ep1_std_es_normal',
    medium: 'Movie',
    title: 'The Matrix',
    season: 'Feature Film',
    episode: 'Theatrical Release',
    variant: 'Standard',
    language: 'es',
    trackType: 'Normal',
    isPrimary: false,
    lastSavedAt: Date.now() - 79200000,
    videoTitle: 'The Matrix (1999)',
    sourceFileName: 'The.Matrix.1999.Theatrical.es.srt',
    lines: [
      { id: 'mat-es-1', lineNumber: 1, startTime: '00:00:20.500', endTime: '00:00:23.800', text: 'Trinity... Estás en una línea que no podemos proteger.' },
      { id: 'mat-es-2', lineNumber: 2, startTime: '00:00:24.200', endTime: '00:00:27.500', text: 'Lo sé. Pero tengo que verlo yo misma.' },
      { id: 'mat-es-3', lineNumber: 3, startTime: '00:00:28.000', endTime: '00:00:31.900', text: 'Morfeo cree que es el Elegido. Se nos agota el tiempo.' },
      { id: 'mat-es-4', lineNumber: 4, startTime: '00:00:32.400', endTime: '00:00:36.100', text: 'El rastreo se completó. Los agentes están llegando ahora.' },
      { id: 'mat-es-5', lineNumber: 5, startTime: '00:00:36.500', endTime: '00:00:40.000', text: 'Despierta, Neo... Matrix te tiene.' },
      { id: 'mat-es-6', lineNumber: 6, startTime: '00:00:41.000', endTime: '00:00:44.500', text: 'Sigue al conejo blanco. Toc, toc.' },
    ],
  },

  // 2. Anime / TV Show -> Digimon
  {
    id: 'anime_digimon_s1_ep1_std_en_normal',
    medium: 'Anime',
    title: 'Digimon',
    season: 'Season 1 - Adventure',
    episode: 'Episode 1 - And So It Begins',
    variant: 'Standard',
    language: 'en',
    trackType: 'Normal',
    isPrimary: true,
    lastSavedAt: Date.now() - 172800000,
    videoTitle: 'Digimon Adventure S01E01',
    sourceFileName: 'Digimon.S01E01.en.srt',
    lines: [
      { id: 'dig-1', lineNumber: 1, startTime: '00:00:05.100', endTime: '00:00:08.400', text: 'Summer camp was supposed to be completely normal this year.' },
      { id: 'dig-2', lineNumber: 2, startTime: '00:00:09.000', endTime: '00:00:13.200', text: 'Then sudden snow started falling from a blazing clear sky.' },
      { id: 'dig-3', lineNumber: 3, startTime: '00:00:14.000', endTime: '00:00:17.500', text: 'Tai, look! Strange devices floating down from the aurora!' },
      { id: 'dig-4', lineNumber: 4, startTime: '00:00:18.000', endTime: '00:00:22.000', text: 'Hold on to something! The tidal wave is pulling us through!' },
      { id: 'dig-5', lineNumber: 5, startTime: '00:00:23.000', endTime: '00:00:26.500', text: "I've been waiting for you, Tai! I'm Koromon!" },
    ],
  },
  {
    id: 'anime_digimon_s1_ep1_std_en_cc',
    medium: 'Anime',
    title: 'Digimon',
    season: 'Season 1 - Adventure',
    episode: 'Episode 1 - And So It Begins',
    variant: 'Standard',
    language: 'en',
    trackType: 'CC',
    isPrimary: false,
    lastSavedAt: Date.now() - 170000000,
    videoTitle: 'Digimon Adventure S01E01',
    sourceFileName: 'Digimon.S01E01.en.cc.srt',
    lines: [
      { id: 'dig-cc-1', lineNumber: 1, startTime: '00:00:05.100', endTime: '00:00:08.400', text: '[Cicadas buzzing in summer warmth]\nSummer camp was supposed to be completely normal this year.' },
      { id: 'dig-cc-2', lineNumber: 2, startTime: '00:00:09.000', endTime: '00:00:13.200', text: '[Thunder rumbling overhead]\nThen sudden snow started falling from a blazing clear sky.' },
      { id: 'dig-cc-3', lineNumber: 3, startTime: '00:00:14.000', endTime: '00:00:17.500', text: '[High-pitched chime echoing]\nTai, look! Strange devices floating down from the aurora!' },
      { id: 'dig-cc-4', lineNumber: 4, startTime: '00:00:18.000', endTime: '00:00:22.000', text: '[Rushing water roared]\nHold on to something! The tidal wave is pulling us through!' },
      { id: 'dig-cc-5', lineNumber: 5, startTime: '00:00:23.000', endTime: '00:00:26.500', text: '[Playful squeaking bounce]\nI\'ve been waiting for you, Tai! I\'m Koromon!' },
    ],
  },

  // 3. Audio Drama -> We're Alive
  {
    id: 'audio_werealive_s1_ep1_std_en_normal',
    medium: 'Audio Drama',
    title: "We're Alive",
    season: 'Season 1 - It Begins',
    episode: 'Chapter 1 - It Begins (Part 1)',
    variant: 'Standard',
    language: 'en',
    trackType: 'Normal',
    isPrimary: true,
    lastSavedAt: Date.now() - 259200000,
    videoTitle: "We're Alive - Chapter 1",
    sourceFileName: 'Were_Alive_Chapter_1.en.srt',
    lines: [
      { id: 'wa-1', lineNumber: 1, startTime: '00:00:01.500', endTime: '00:00:05.000', text: 'This is Army Reserve Specialist Michael Cross.' },
      { id: 'wa-2', lineNumber: 2, startTime: '00:00:05.500', endTime: '00:00:09.200', text: 'It started on May 8th. Just a normal drill weekend in Los Angeles.' },
      { id: 'wa-3', lineNumber: 3, startTime: '00:00:09.800', endTime: '00:00:14.000', text: 'Sirens began blaring across downtown. The emergency broadcast cut into every radio station.' },
      { id: 'wa-4', lineNumber: 4, startTime: '00:00:14.500', endTime: '00:00:18.800', text: 'People were turning into violent, relentless creatures. Riots broke out in minutes.' },
      { id: 'wa-5', lineNumber: 5, startTime: '00:00:19.500', endTime: '00:00:24.000', text: 'Angel, Saul, and I barricaded the stairwell. If anyone can hear this... we are alive.' },
    ],
  },
  {
    id: 'audio_werealive_s1_ep1_std_en_cc',
    medium: 'Audio Drama',
    title: "We're Alive",
    season: 'Season 1 - It Begins',
    episode: 'Chapter 1 - It Begins (Part 1)',
    variant: 'Standard',
    language: 'en',
    trackType: 'CC',
    isPrimary: false,
    lastSavedAt: Date.now() - 250000000,
    videoTitle: "We're Alive - Chapter 1",
    sourceFileName: 'Were_Alive_Chapter_1.en.cc.srt',
    lines: [
      { id: 'wa-cc-1', lineNumber: 1, startTime: '00:00:01.500', endTime: '00:00:05.000', text: '[Static crackle over military radio]\nThis is Army Reserve Specialist Michael Cross.' },
      { id: 'wa-cc-2', lineNumber: 2, startTime: '00:00:05.500', endTime: '00:00:09.200', text: 'It started on May 8th. Just a normal drill weekend in Los Angeles.' },
      { id: 'wa-cc-3', lineNumber: 3, startTime: '00:00:09.800', endTime: '00:00:14.000', text: '[Distorted EAS alert alarm screams]\nSirens began blaring across downtown. The emergency broadcast cut into every radio station.' },
      { id: 'wa-cc-4', lineNumber: 4, startTime: '00:00:14.500', endTime: '00:00:18.800', text: '[Gunfire popping in the distant streets]\nPeople were turning into violent, relentless creatures. Riots broke out in minutes.' },
      { id: 'wa-cc-5', lineNumber: 5, startTime: '00:00:19.500', endTime: '00:00:24.000', text: '[Heavy metal door slams and deadbolt clicks]\nAngel, Saul, and I barricaded the stairwell. If anyone can hear this... we are alive.' },
    ],
  },
];

/**
 * Clean a media title by stripping file extensions, language tags, and track type suffixes
 */
export function cleanMediaTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/\.(ar|en|es|fr|de|ja|zh|ko|it|ru|pt|hi)(\.|$)/i, '')
    .replace(/\s*-\s*[A-Za-z]+ \([A-Za-z]+\)$/i, '')
    .trim();
}

/**
 * Normalized canonical key for fuzzy media title comparisons
 */
export function normalizeMediaKey(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/\.(ar|en|es|fr|de|ja|zh|ko|it|ru|pt|hi)(\.|$)/i, '')
    .replace(/\s*-\s*[A-Za-z]+ \([A-Za-z]+\)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'e')
    .replace(/oo+/g, 'o')
    .trim();
}

/**
 * Robust title equivalence checker that handles extension differences, typos (e.g. Beaast vs Beast),
 * and language/type suffix permutations.
 */
export function isSameMediaTitle(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;
  const keyA = normalizeMediaKey(titleA);
  const keyB = normalizeMediaKey(titleB);
  if (!keyA || !keyB) return false;
  if (keyA === keyB || keyA.includes(keyB) || keyB.includes(keyA)) return true;
  const wordsA = keyA.split(' ').filter((w) => w.length > 2);
  const wordsB = keyB.split(' ').filter((w) => w.length > 2);
  if (wordsA.length > 0 && wordsA.every((w) => keyB.includes(w))) return true;
  if (wordsB.length > 0 && wordsB.every((w) => keyA.includes(w))) return true;
  return false;
}

// In-memory cache for fast synchronous access
let cachedTracks: DatabaseSubtitleTrack[] | null = null;

/**
 * Retrieve all tracks from storage (LocalStorage + IndexedDB + Server synchronization)
 */
export function getAllDatabaseTracks(): DatabaseSubtitleTrack[] {
  if (cachedTracks !== null) {
    return cachedTracks;
  }

  try {
    const raw = localStorage.getItem(MEDIA_DB_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedTracks = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[MediaDatabase] Read error from localStorage:', err);
  }

  // Pre-seed with default organized media tracks only if never initialized
  try {
    localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(SEED_TRACKS));
  } catch {}
  cachedTracks = SEED_TRACKS;
  return SEED_TRACKS;
}

/**
 * Synchronize local database with server persistent tracks
 */
export async function syncDatabaseWithServer(): Promise<DatabaseSubtitleTrack[]> {
  try {
    const res = await apiFetch('/api/database/tracks');
    if (res.ok) {
      const serverTracks = await res.json();
      if (Array.isArray(serverTracks)) {
        cachedTracks = serverTracks;
        try {
          localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(serverTracks));
        } catch {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('subflow:database-synced', { detail: serverTracks }));
        }
        return serverTracks;
      }
    }
  } catch (e) {
    console.warn('[MediaDatabase] Server sync error:', e);
  }
  return getAllDatabaseTracks();
}

// Initial sync in background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncDatabaseWithServer();
  }, 100);
}

/**
 * Save / Update a track in the organized database
 */
export async function saveSubtitleToDatabase(track: DatabaseSubtitleTrack): Promise<void> {
  const current = getAllDatabaseTracks();

  const idx = current.findIndex(
    (t) =>
      t.id === track.id ||
      (isSameMediaTitle(t.title, track.title) &&
        t.language.toLowerCase() === track.language.toLowerCase() &&
        t.trackType === track.trackType)
  );

  const updatedTrack: DatabaseSubtitleTrack = {
    ...track,
    lastSavedAt: Date.now(),
  };

  let nextTracks: DatabaseSubtitleTrack[];
  if (idx >= 0) {
    nextTracks = [...current];
    nextTracks[idx] = updatedTrack;
  } else {
    nextTracks = [updatedTrack, ...current];
  }

  cachedTracks = nextTracks;

  try {
    localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(nextTracks));
  } catch (err) {
    console.warn('[MediaDatabase] LocalStorage save warning:', err);
  }

  // Also post to server API
  try {
    await apiFetch('/api/database/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTrack),
    });
  } catch (serverErr) {
    console.warn('[MediaDatabase] Server track save sync error:', serverErr);
  }

  // Also persist to IndexedDB
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_MEDIA_DB)) {
      // Handled during openDB upgrades
    } else {
      const tx = db.transaction(STORE_MEDIA_DB, 'readwrite');
      tx.objectStore(STORE_MEDIA_DB).put(updatedTrack, updatedTrack.id);
    }
  } catch {}
}

/**
 * Delete a specific track from the database
 */
export async function deleteTrackFromDatabase(trackId: string): Promise<void> {
  const current = getAllDatabaseTracks();
  const nextTracks = current.filter((t) => t.id !== trackId);
  cachedTracks = nextTracks;

  try {
    localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(nextTracks));
  } catch {}

  try {
    await apiFetch(`/api/database/tracks/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[MediaDatabase] Server track deletion error:', err);
  }
}

/**
 * Clear/Erase all tracks for a language from the database for a title
 */
export async function clearLanguageFromDatabase(
  title: string,
  language: string,
  trackType?: SubtitleTrackType
): Promise<void> {
  const lowerLang = language.toLowerCase();
  const current = getAllDatabaseTracks();

  const nextTracks = current.filter((t) => {
    const isTitleMatch =
      !title ||
      isSameMediaTitle(t.title, title) ||
      normalizeMediaKey(t.title).includes(normalizeMediaKey(title)) ||
      normalizeMediaKey(title).includes(normalizeMediaKey(t.title));
    const isLangMatch = t.language.toLowerCase() === lowerLang;
    const isTypeMatch = !trackType || t.trackType === trackType;

    return !(isTitleMatch && isLangMatch && isTypeMatch);
  });

  cachedTracks = nextTracks;

  try {
    localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(nextTracks));
  } catch {}

  try {
    await apiFetch('/api/database/clear-language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, language, trackType }),
    });
  } catch (err) {
    console.warn('[MediaDatabase] Server language clear error:', err);
  }
}

/**
 * Get all available (saved with lines) languages in database for a title and trackType
 */
export function getAvailableLanguagesInDatabase(
  title: string,
  trackType?: SubtitleTrackType
): string[] {
  const tracks = getAllDatabaseTracks();
  const langs = new Set<string>();
  tracks.forEach((t) => {
    const isTitleMatch =
      !title ||
      isSameMediaTitle(t.title, title) ||
      normalizeMediaKey(t.title).includes(normalizeMediaKey(title)) ||
      normalizeMediaKey(title).includes(normalizeMediaKey(t.title));
    const isTypeMatch = !trackType || t.trackType === trackType;
    if (isTitleMatch && isTypeMatch && t.lines && t.lines.length > 0) {
      langs.add(t.language.toLowerCase());
    }
  });
  return Array.from(langs);
}

/**
 * Find the primary subtitle track for a given medium, title, season, episode, variant
 */
export function findPrimaryTrackForProject(
  medium: MediaMedium,
  title: string,
  season: string = 'Season 1',
  episode: string = 'Episode 1',
  variant: string = 'Standard'
): DatabaseSubtitleTrack | null {
  const tracks = getAllDatabaseTracks();

  // Try exact match with isPrimary
  let match = tracks.find(
    (t) =>
      isSameMediaTitle(t.title, title) &&
      t.isPrimary &&
      t.lines &&
      t.lines.length > 0
  );

  if (match) return match;

  // Try matching Normal track in same title
  match = tracks.find(
    (t) =>
      isSameMediaTitle(t.title, title) &&
      t.trackType === 'Normal' &&
      t.lines &&
      t.lines.length > 0
  );

  if (match) return match;

  // Try any track for this title with lines
  return (
    tracks.find((t) => isSameMediaTitle(t.title, title) && t.lines && t.lines.length > 0) || null
  );
}

/**
 * Find a specific track by language and type for a project
 */
export function findTrackInDatabase(
  title: string,
  language: string,
  trackType: SubtitleTrackType = 'Normal'
): DatabaseSubtitleTrack | null {
  const tracks = getAllDatabaseTracks();
  const lowerLang = language.toLowerCase();

  return (
    tracks.find((t) => {
      const isTitleMatch = isSameMediaTitle(t.title, title);
      const isLangMatch = t.language.toLowerCase() === lowerLang;
      const isTypeMatch = t.trackType === trackType;

      return isTitleMatch && isLangMatch && isTypeMatch && t.lines && t.lines.length > 0;
    }) || null
  );
}

/**
 * Get all tracks associated with a given title/project
 */
export function getTracksForTitle(title: string): DatabaseSubtitleTrack[] {
  const tracks = getAllDatabaseTracks();
  const lowerTitle = title.trim().toLowerCase();
  return tracks.filter(
    (t) =>
      t.title.toLowerCase() === lowerTitle ||
      t.title.toLowerCase().includes(lowerTitle) ||
      lowerTitle.includes(t.title.toLowerCase())
  );
}

/**
 * Structured tree hierarchy representation for the Database Browser
 */
export interface HierarchyTree {
  [medium: string]: {
    [title: string]: {
      [season: string]: {
        [episode: string]: {
          [variant: string]: {
            [language: string]: {
              [trackType: string]: DatabaseSubtitleTrack;
            };
          };
        };
      };
    };
  };
}

export function getOrganizedHierarchyTree(): HierarchyTree {
  const tracks = getAllDatabaseTracks();
  const tree: HierarchyTree = {};

  for (const track of tracks) {
    const med = track.medium || 'Movie';
    const tit = track.title || 'Untitled';
    const sea = track.season || 'Season 1';
    const epi = track.episode || 'Episode 1';
    const varnt = track.variant || 'Standard';
    const lang = track.language || 'en';
    const typ = track.trackType || 'Normal';

    if (!tree[med]) tree[med] = {};
    if (!tree[med][tit]) tree[med][tit] = {};
    if (!tree[med][tit][sea]) tree[med][tit][sea] = {};
    if (!tree[med][tit][sea][epi]) tree[med][tit][sea][epi] = {};
    if (!tree[med][tit][sea][epi][varnt]) tree[med][tit][sea][epi][varnt] = {};
    if (!tree[med][tit][sea][epi][varnt][lang]) tree[med][tit][sea][epi][varnt][lang] = {};

    tree[med][tit][sea][epi][varnt][lang][typ] = track;
  }

  return tree;
}

/**
 * Auto-detect Medium and Season/Episode from project title or video name
 */
export function inferMediaClassification(name: string): {
  medium: MediaMedium;
  title: string;
  season: string;
  episode: string;
  variant: string;
} {
  const clean = name.replace(/\.[^/.]+$/, '').trim();

  // Audio drama pattern (e.g. "We're Alive", "Audiobook", "Chapter")
  if (/we'?re alive|audio\s*drama|podcast|chapter/i.test(clean)) {
    const epMatch = clean.match(/chapter\s*(\d+)/i) || clean.match(/part\s*(\d+)/i);
    return {
      medium: 'Audio Drama',
      title: "We're Alive",
      season: 'Season 1 - It Begins',
      episode: epMatch ? `Chapter ${epMatch[1]}` : 'Chapter 1 - It Begins',
      variant: 'Standard',
    };
  }

  // Anime pattern
  if (/digimon|pokemon|naruto|anime|shingeki/i.test(clean)) {
    const epMatch = clean.match(/ep(?:isode)?\s*(\d+)/i) || clean.match(/s\d+e(\d+)/i);
    return {
      medium: 'Anime',
      title: 'Digimon',
      season: 'Season 1 - Adventure',
      episode: epMatch ? `Episode ${epMatch[1]}` : 'Episode 1',
      variant: 'Standard',
    };
  }

  // TV Show pattern (e.g. S01E02)
  const tvMatch = clean.match(/s(\d+)e(\d+)/i) || clean.match(/season\s*(\d+).*?ep(?:isode)?\s*(\d+)/i);
  if (tvMatch) {
    const baseTitle = clean.split(/s\d+e\d+/i)[0].replace(/[-_.]+/g, ' ').trim();
    return {
      medium: 'TV Show',
      title: baseTitle || clean,
      season: `Season ${parseInt(tvMatch[1], 10)}`,
      episode: `Episode ${parseInt(tvMatch[2], 10)}`,
      variant: 'Standard',
    };
  }

  // Movie pattern
  if (/matrix/i.test(clean)) {
    return {
      medium: 'Movie',
      title: 'The Matrix',
      season: 'Feature Film',
      episode: 'Theatrical Release',
      variant: 'Standard',
    };
  }

  return {
    medium: 'Movie',
    title: clean.replace(/[-_.]+/g, ' ') || 'Untitled Media',
    season: 'Feature Film',
    episode: 'Theatrical Release',
    variant: 'Standard',
  };
}

// =========================================================================
// TITLE-LEVEL FORMATTING PERSISTENCE (Color, Font, Style, Shadow, Outline)
// =========================================================================

export interface TitleFormattingSettings {
  color?: string;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  shadow?: any;
  outline?: any;
  updatedAt: number;
}

const TITLE_FORMAT_STORAGE_KEY = 'subflow_title_formatting_registry';

/**
 * Retrieve saved title-level formatting configuration across all languages for this title
 */
export function getTitleFormatting(title: string): TitleFormattingSettings | null {
  if (!title) return null;
  const clean = cleanMediaTitle(title).toLowerCase();
  try {
    const raw = localStorage.getItem(TITLE_FORMAT_STORAGE_KEY);
    if (!raw) return null;
    const registry: Record<string, TitleFormattingSettings> = JSON.parse(raw);
    for (const [key, val] of Object.entries(registry)) {
      if (isSameMediaTitle(key, clean)) {
        return val;
      }
    }
  } catch {}
  return null;
}

/**
 * Save formatting updates to the TITLE (movie, episode, etc.) across all languages and track types.
 * Also synchronizes and updates any database tracks for this title!
 */
export async function saveTitleFormatting(
  title: string,
  updates: Partial<TitleFormattingSettings>
): Promise<TitleFormattingSettings> {
  const clean = cleanMediaTitle(title) || 'Untitled';
  const cleanLower = clean.toLowerCase();
  let registry: Record<string, TitleFormattingSettings> = {};

  try {
    const raw = localStorage.getItem(TITLE_FORMAT_STORAGE_KEY);
    if (raw) registry = JSON.parse(raw);
  } catch {}

  // Find existing key if already present under slight name variation
  let targetKey = cleanLower;
  for (const key of Object.keys(registry)) {
    if (isSameMediaTitle(key, cleanLower)) {
      targetKey = key;
      break;
    }
  }

  const current = registry[targetKey] || { updatedAt: Date.now() };
  const merged: TitleFormattingSettings = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };

  registry[targetKey] = merged;

  try {
    localStorage.setItem(TITLE_FORMAT_STORAGE_KEY, JSON.stringify(registry));
  } catch {}

  // Post to server title formatting registry
  try {
    await apiFetch('/api/title-formatting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: clean, formatting: merged }),
    });
  } catch {}

  // Also update all database tracks stored for this title so any language track when opened receives these formatting updates
  const tracks = getAllDatabaseTracks();
  let modifiedTracks = false;
  const nextTracks = tracks.map((track) => {
    if (isSameMediaTitle(track.title, clean)) {
      modifiedTracks = true;
      const updatedLines = (track.lines || []).map((l) => ({
        ...l,
        ...(updates.color !== undefined ? { color: updates.color } : {}),
        ...(updates.font !== undefined ? { font: updates.font } : {}),
        ...(updates.size !== undefined ? { size: updates.size } : {}),
        ...(updates.bold !== undefined ? { bold: updates.bold } : {}),
        ...(updates.italic !== undefined ? { italic: updates.italic } : {}),
        ...(updates.underline !== undefined ? { underline: updates.underline } : {}),
        ...(updates.strikethrough !== undefined ? { strikethrough: updates.strikethrough } : {}),
        ...(updates.superscript !== undefined ? { superscript: updates.superscript } : {}),
        ...(updates.subscript !== undefined ? { subscript: updates.subscript } : {}),
        ...(updates.shadow !== undefined ? { shadow: updates.shadow } : {}),
        ...(updates.outline !== undefined ? { outline: updates.outline } : {}),
      }));
      return {
        ...track,
        lines: updatedLines,
        lastSavedAt: Date.now(),
      };
    }
    return track;
  });

  if (modifiedTracks) {
    cachedTracks = nextTracks;
    try {
      localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(nextTracks));
    } catch {}
  }

  return merged;
}

/**
 * Apply saved title formatting to a list of subtitle lines
 */
export function applyTitleFormattingToLines(
  title: string,
  lines: SubtitleLine[]
): SubtitleLine[] {
  const formatting = getTitleFormatting(title);
  if (!formatting || !lines || lines.length === 0) return lines;

  return lines.map((l) => ({
    ...l,
    color: l.color || formatting.color,
    font: l.font || formatting.font,
    size: l.size || formatting.size,
    bold: l.bold !== undefined ? l.bold : formatting.bold,
    italic: l.italic !== undefined ? l.italic : formatting.italic,
    underline: l.underline !== undefined ? l.underline : formatting.underline,
    strikethrough: l.strikethrough !== undefined ? l.strikethrough : formatting.strikethrough,
    superscript: l.superscript !== undefined ? l.superscript : formatting.superscript,
    subscript: l.subscript !== undefined ? l.subscript : formatting.subscript,
    shadow: l.shadow || formatting.shadow,
    outline: l.outline || formatting.outline,
  }));
}

/**
 * Propagate line formatting changes to matching lines in all other language tracks of the same title.
 * Matching is done primarily by identical timecode (startTime + endTime) or by lineNumber as fallback.
 */
export async function syncLineFormattingAcrossLanguages(
  title: string,
  updatedLines: SubtitleLine[]
): Promise<void> {
  if (!title || !updatedLines || updatedLines.length === 0) return;
  const clean = cleanMediaTitle(title);
  const tracks = getAllDatabaseTracks();
  let modifiedAny = false;

  const nextTracks = tracks.map((track) => {
    if (isSameMediaTitle(track.title, clean) && track.lines && track.lines.length > 0) {
      // Map formatting by timecode and lineNumber
      const formatByTime = new Map<string, SubtitleLine>();
      const formatByNum = new Map<number, SubtitleLine>();

      for (const line of updatedLines) {
        formatByTime.set(`${line.startTime}_${line.endTime}`, line);
        formatByNum.set(line.lineNumber, line);
      }

      let trackModified = false;
      const syncedLines = track.lines.map((destLine) => {
        const sourceMatch =
          formatByTime.get(`${destLine.startTime}_${destLine.endTime}`) ||
          formatByNum.get(destLine.lineNumber);

        if (sourceMatch) {
          trackModified = true;
          return {
            ...destLine,
            color: sourceMatch.color,
            font: sourceMatch.font,
            size: sourceMatch.size,
            bold: sourceMatch.bold,
            italic: sourceMatch.italic,
            underline: sourceMatch.underline,
            strikethrough: sourceMatch.strikethrough,
            superscript: sourceMatch.superscript,
            subscript: sourceMatch.subscript,
            shadow: sourceMatch.shadow,
            outline: sourceMatch.outline,
          };
        }
        return destLine;
      });

      if (trackModified) {
        modifiedAny = true;
        return {
          ...track,
          lines: syncedLines,
          lastSavedAt: Date.now(),
        };
      }
    }
    return track;
  });

  if (modifiedAny) {
    cachedTracks = nextTracks;
    try {
      localStorage.setItem(MEDIA_DB_STORAGE_KEY, JSON.stringify(nextTracks));
    } catch {}

    // Synchronize to server database in background
    try {
      apiFetch('/api/database/sync-line-formatting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: clean, updatedLines }),
      }).catch(() => {});
    } catch {}
  }
}
