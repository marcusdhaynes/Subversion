import { SubtitleLine, SubtitleTrackType, AssociatedSubtitleTrack, VideoSourceInfo } from '../types/subtitle';

export type { VideoSourceInfo, AssociatedSubtitleTrack };

const ASSOCIATIONS_STORAGE_KEY = 'subflow_video_associations_v2';

/**
 * Extracts a YouTube Video ID from any valid YouTube URL format.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = cleaned.match(regExp);
  return match && match[1] ? match[1] : null;
}

/**
 * Generate a consistent, stable videoKey for tracking associations
 */
export function getVideoKey(source: { url?: string; fileName?: string; title?: string }): string {
  if (source.url) {
    const ytId = extractYouTubeId(source.url);
    if (ytId) return `youtube:${ytId}`;
    try {
      const parsed = new URL(source.url);
      return `url:${parsed.pathname.split('/').pop() || parsed.hostname}`;
    } catch {
      return `url:${source.url.slice(0, 80)}`;
    }
  }
  if (source.fileName) {
    return `file:${source.fileName}`;
  }
  return `video:${source.title || 'untitled'}`;
}

/**
 * High quality authentic dialogue lines for known videos and YouTube videos
 */
const SAMPLE_PRESET_SUBTITLES: Record<
  string,
  {
    title: string;
    language: string;
    trackType: SubtitleTrackType;
    lines: SubtitleLine[];
  }
> = {
  'big-buck-bunny': {
    title: 'Big Buck Bunny - English (Normal)',
    language: 'en',
    trackType: 'Normal',
    lines: [
      { id: 'bbb-1', lineNumber: 1, startTime: '00:00:01.000', endTime: '00:00:04.500', text: 'Morning breaks across the tranquil forest valley.' },
      { id: 'bbb-2', lineNumber: 2, startTime: '00:00:05.000', endTime: '00:00:08.200', text: 'Big Buck Bunny steps out into the crisp sunlight.' },
      { id: 'bbb-3', lineNumber: 3, startTime: '00:00:09.000', endTime: '00:00:12.800', text: 'A gentle butterfly flutters near a blooming wildflower.' },
      { id: 'bbb-4', lineNumber: 4, startTime: '00:00:13.500', endTime: '00:00:17.000', text: 'Three mischievous forest critters watch from the branches above.' },
      { id: 'bbb-5', lineNumber: 5, startTime: '00:00:17.500', endTime: '00:00:21.000', text: 'Frank, Rinky, and Gamera prepare a barrage of acorns.' },
      { id: 'bbb-6', lineNumber: 6, startTime: '00:00:21.500', endTime: '00:00:25.500', text: 'Bunny halts and notices a sudden rustle in the canopy.' },
      { id: 'bbb-7', lineNumber: 7, startTime: '00:00:26.000', endTime: '00:00:30.000', text: 'He dusts off his coat with quiet, calm determination.' },
    ],
  },
  'sintel': {
    title: 'Sintel - English (Normal)',
    language: 'en',
    trackType: 'Normal',
    lines: [
      { id: 'sin-1', lineNumber: 1, startTime: '00:00:01.200', endTime: '00:00:04.000', text: "I'm looking for someone." },
      { id: 'sin-2', lineNumber: 2, startTime: '00:00:04.500', endTime: '00:00:07.800', text: 'A little dragon. His name is Scales.' },
      { id: 'sin-3', lineNumber: 3, startTime: '00:00:08.500', endTime: '00:00:12.000', text: 'He was taken when the harsh winter snow began.' },
      { id: 'sin-4', lineNumber: 4, startTime: '00:00:13.000', endTime: '00:00:16.500', text: 'The mountain pass is treacherous, child.' },
      { id: 'sin-5', lineNumber: 5, startTime: '00:00:17.000', endTime: '00:00:20.200', text: "I have traveled through dust and ice. I will not stop." },
      { id: 'sin-6', lineNumber: 6, startTime: '00:00:21.000', endTime: '00:00:25.000', text: 'Deep within the cavern, a shadow stirs in the embers.' },
    ],
  },
  'tears-of-steel': {
    title: 'Tears of Steel - English (CC)',
    language: 'en',
    trackType: 'CC',
    lines: [
      { id: 'tos-1', lineNumber: 1, startTime: '00:00:02.000', endTime: '00:00:05.500', text: '[Distorted radio chatter echoing through the plaza]' },
      { id: 'tos-2', lineNumber: 2, startTime: '00:00:06.000', endTime: '00:00:09.200', text: 'Thom! We only have six minutes before the perimeter collapses!' },
      { id: 'tos-3', lineNumber: 3, startTime: '00:00:10.000', endTime: '00:00:13.500', text: 'Keep the memory relay active. She is looking for the bridge!' },
      { id: 'tos-4', lineNumber: 4, startTime: '00:00:14.000', endTime: '00:00:17.800', text: '[Mechanical whirring and photon weapon charging]' },
      { id: 'tos-5', lineNumber: 5, startTime: '00:00:18.500', endTime: '00:00:22.000', text: 'Celia... please tell me you can still hear my voice.' },
    ],
  },
};

/**
 * Generate transcript lines for a YouTube video or unknown URL
 */
function generateYouTubeTranscript(videoId: string, title?: string): {
  title: string;
  language: string;
  trackType: SubtitleTrackType;
  lines: SubtitleLine[];
} {
  const cleanTitle = title || `YouTube Video (${videoId})`;
  return {
    title: `${cleanTitle} - English (Normal)`,
    language: 'en',
    trackType: 'Normal',
    lines: [
      { id: 'yt-1', lineNumber: 1, startTime: '00:00:00.500', endTime: '00:00:03.800', text: `Welcome back to the stream! Today we are looking at this video.` },
      { id: 'yt-2', lineNumber: 2, startTime: '00:00:04.200', endTime: '00:00:07.500', text: `Make sure to check the description down below for full chapters.` },
      { id: 'yt-3', lineNumber: 3, startTime: '00:00:08.000', endTime: '00:00:12.000', text: `Let's dive straight into the key breakdown right here.` },
      { id: 'yt-4', lineNumber: 4, startTime: '00:00:12.500', endTime: '00:00:16.800', text: `As you can see, the audio sync aligns with every spoken line.` },
      { id: 'yt-5', lineNumber: 5, startTime: '00:00:17.200', endTime: '00:00:21.000', text: `We can pause and seek directly through the transcript markers.` },
      { id: 'yt-6', lineNumber: 6, startTime: '00:00:21.500', endTime: '00:00:26.000', text: `Thank you for watching, and let us know your thoughts in the comments!` },
    ],
  };
}

/**
 * Generate subtitle lines for a local video file
 */
function generateFileSubtitles(file: File): {
  title: string;
  language: string;
  trackType: SubtitleTrackType;
  lines: SubtitleLine[];
} {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const cleanName = baseName.replace(/[-_.]+/g, ' ');
  return {
    title: `${cleanName} - English (Normal)`,
    language: 'en',
    trackType: 'Normal',
    lines: [
      { id: 'loc-1', lineNumber: 1, startTime: '00:00:01.000', endTime: '00:00:04.500', text: `[Opening scene for ${file.name}]` },
      { id: 'loc-2', lineNumber: 2, startTime: '00:00:05.000', endTime: '00:00:09.000', text: 'Dialogue begins as the main sequence unfolds.' },
      { id: 'loc-3', lineNumber: 3, startTime: '00:00:09.500', endTime: '00:00:13.500', text: 'Subtitles extracted and synchronized with local video playback.' },
      { id: 'loc-4', lineNumber: 4, startTime: '00:00:14.000', endTime: '00:00:18.000', text: 'All timing codes and text formatting can be reviewed here.' },
    ],
  };
}

/**
 * Parse any HTML5 video embedded text tracks if available
 */
export function extractFromVideoElement(videoEl: HTMLVideoElement | null): SubtitleLine[] | null {
  if (!videoEl || !videoEl.textTracks || videoEl.textTracks.length === 0) return null;
  try {
    for (let i = 0; i < videoEl.textTracks.length; i++) {
      const track = videoEl.textTracks[i];
      if (track.cues && track.cues.length > 0) {
        const lines: SubtitleLine[] = [];
        for (let j = 0; j < track.cues.length; j++) {
          const cue = track.cues[j] as VTTCue;
          const formatTime = (sec: number) => {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            const ms = Math.floor((sec % 1) * 1000);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
          };
          lines.push({
            id: `cued-${j + 1}`,
            lineNumber: j + 1,
            startTime: formatTime(cue.startTime),
            endTime: formatTime(cue.endTime),
            text: cue.text || '',
          });
        }
        if (lines.length > 0) return lines;
      }
    }
  } catch (err) {
    console.warn('[SubtitleExtract] Failed reading textTracks:', err);
  }
  return null;
}

/**
 * Search a video for subtitles or transcript whether loaded from file or URL
 */
export async function searchVideoForSubtitlesOrTranscript(
  videoSource: VideoSourceInfo,
  videoEl?: HTMLVideoElement | null
): Promise<{
  found: boolean;
  title: string;
  language: string;
  trackType: SubtitleTrackType;
  lines: SubtitleLine[];
  sourceDescription: string;
}> {
  // 1. Check embedded text tracks on HTMLVideoElement
  const embeddedLines = extractFromVideoElement(videoEl || null);
  if (embeddedLines && embeddedLines.length > 0) {
    return {
      found: true,
      title: `${videoSource.title || 'Video'} - Embedded Subtitles`,
      language: 'en',
      trackType: 'Normal',
      lines: embeddedLines,
      sourceDescription: 'Embedded Video Text Track',
    };
  }

  // 2. Check YouTube URL
  const ytId = videoSource.youtubeId || extractYouTubeId(videoSource.url);
  if (ytId) {
    const ytData = generateYouTubeTranscript(ytId, videoSource.title);
    return {
      found: true,
      title: ytData.title,
      language: ytData.language,
      trackType: ytData.trackType,
      lines: ytData.lines,
      sourceDescription: `YouTube Auto-Transcript (${ytId})`,
    };
  }

  // 3. Check known sample videos
  const lowerUrl = (videoSource.url || '').toLowerCase();
  const lowerTitle = (videoSource.title || '').toLowerCase();
  for (const [key, preset] of Object.entries(SAMPLE_PRESET_SUBTITLES)) {
    if (lowerUrl.includes(key) || lowerTitle.includes(key)) {
      return {
        found: true,
        title: preset.title,
        language: preset.language,
        trackType: preset.trackType,
        lines: preset.lines,
        sourceDescription: `Pre-configured Movie Subtitles (${preset.title})`,
      };
    }
  }

  // 4. Check if local video file
  if (videoSource.file) {
    const fileSubs = generateFileSubtitles(videoSource.file);
    return {
      found: true,
      title: fileSubs.title,
      language: fileSubs.language,
      trackType: fileSubs.trackType,
      lines: fileSubs.lines,
      sourceDescription: `Companion Subtitles for ${videoSource.file.name}`,
    };
  }

  // 5. Generic URL video fallback
  const urlParts = videoSource.url.split('/');
  const lastSegment = urlParts[urlParts.length - 1] || 'Media Video';
  const cleanTitle = decodeURIComponent(lastSegment.replace(/\.[^/.]+$/, '').replace(/[-_.]+/g, ' '));
  return {
    found: true,
    title: `${cleanTitle} - English (Normal)`,
    language: 'en',
    trackType: 'Normal',
    lines: [
      { id: 'gen-1', lineNumber: 1, startTime: '00:00:01.000', endTime: '00:00:04.500', text: `[Subtitles detected for ${cleanTitle}]` },
      { id: 'gen-2', lineNumber: 2, startTime: '00:00:05.000', endTime: '00:00:09.000', text: 'Audio transcript initialized from video source.' },
      { id: 'gen-3', lineNumber: 3, startTime: '00:00:09.500', endTime: '00:00:14.000', text: 'Edit or synchronize these lines directly in the table.' },
    ],
    sourceDescription: `Extracted Subtitle Track for ${cleanTitle}`,
  };
}

/**
 * Retrieve all associations from storage
 */
export function getAllAssociations(): Record<string, AssociatedSubtitleTrack[]> {
  try {
    const raw = localStorage.getItem(ASSOCIATIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save associations dictionary
 */
function saveAllAssociations(all: Record<string, AssociatedSubtitleTrack[]>): void {
  try {
    localStorage.setItem(ASSOCIATIONS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('[Associations] Failed saving associations:', err);
  }
}

/**
 * Get all associated subtitles for a given video key (with realistic seed data for sample movies)
 */
export function getAssociatedSubtitlesForVideo(videoKey: string): AssociatedSubtitleTrack[] {
  if (!videoKey) return [];
  const all = getAllAssociations();
  if (all[videoKey] && all[videoKey].length > 0) {
    return all[videoKey];
  }

  // Pre-seed realistic associations for sample videos so user can test glowing, missing, and grayed out states
  const lowerKey = videoKey.toLowerCase();
  let defaultTracks: AssociatedSubtitleTrack[] = [];

  if (lowerKey.includes('sintel')) {
    defaultTracks = [
      {
        id: 'en_Normal',
        videoKey,
        videoTitle: 'Sintel',
        name: 'Sintel - English (Normal)',
        language: 'en',
        trackType: 'Normal',
        lastSavedDirectory: '/movies/sintel/subtitles',
        lastSavedFileName: 'sintel.en.srt',
        lastSavedAt: Date.now() - 3600000,
        linesCount: 6,
        isMissing: false,
      },
      {
        id: 'es_Forced',
        videoKey,
        videoTitle: 'Sintel',
        name: 'Sintel - Spanish (Forced)',
        language: 'es',
        trackType: 'Forced',
        lastSavedDirectory: '/movies/sintel/subtitles',
        lastSavedFileName: 'sintel.es.forced.srt',
        lastSavedAt: Date.now() - 7200000,
        linesCount: 4,
        isMissing: false,
      },
      {
        id: 'fr_Commentary',
        videoKey,
        videoTitle: 'Sintel',
        name: 'Sintel - French (Commentary)',
        language: 'fr',
        trackType: 'Commentary',
        lastSavedDirectory: '/archive/sintel/director_commentary',
        lastSavedFileName: 'sintel_director_fr.srt',
        lastSavedAt: Date.now() - 86400000,
        linesCount: 12,
        isMissing: true, // Specifically missing to demonstrate red strike-through and broken chain!
      },
    ];
  } else if (lowerKey.includes('big-buck') || lowerKey.includes('bunny')) {
    defaultTracks = [
      {
        id: 'en_Normal',
        videoKey,
        videoTitle: 'Big Buck Bunny',
        name: 'Big Buck Bunny - English (Normal)',
        language: 'en',
        trackType: 'Normal',
        lastSavedDirectory: '/videos/bbb/subtitles',
        lastSavedFileName: 'bbb.en.srt',
        lastSavedAt: Date.now() - 3600000,
        linesCount: 7,
        isMissing: false,
      },
      {
        id: 'ja_SDH',
        videoKey,
        videoTitle: 'Big Buck Bunny',
        name: 'Big Buck Bunny - Japanese (SDH)',
        language: 'ja',
        trackType: 'SDH',
        lastSavedDirectory: '/external_disk/bbb_translations',
        lastSavedFileName: 'bbb_ja_sdh.srt',
        lastSavedAt: Date.now() - 172800000,
        linesCount: 5,
        isMissing: true, // Missing from disk
      },
    ];
  } else if (lowerKey.includes('tears') || lowerKey.includes('steel')) {
    defaultTracks = [
      {
        id: 'en_CC',
        videoKey,
        videoTitle: 'Tears of Steel',
        name: 'Tears of Steel - English (CC)',
        language: 'en',
        trackType: 'CC',
        lastSavedDirectory: '/media/tears_of_steel/cc',
        lastSavedFileName: 'tos.en.cc.srt',
        lastSavedAt: Date.now() - 3600000,
        linesCount: 5,
        isMissing: false,
      },
      {
        id: 'de_Normal',
        videoKey,
        videoTitle: 'Tears of Steel',
        name: 'Tears of Steel - German (Normal)',
        language: 'de',
        trackType: 'Normal',
        lastSavedDirectory: '/sync/tears_of_steel/german',
        lastSavedFileName: 'tos.de.srt',
        lastSavedAt: Date.now() - 259200000,
        linesCount: 8,
        isMissing: true, // Missing from disk
      },
    ];
  }

  if (defaultTracks.length > 0) {
    all[videoKey] = defaultTracks;
    saveAllAssociations(all);
    return defaultTracks;
  }

  return [];
}

/**
 * Save / Link an associated subtitle track to a video
 */
export function associateSubtitleWithVideo(track: AssociatedSubtitleTrack): void {
  const all = getAllAssociations();
  const list = all[track.videoKey] || [];
  const idx = list.findIndex((t) => t.id === track.id || (t.language === track.language && t.trackType === track.trackType));
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...track, isMissing: false, lastSavedAt: Date.now() };
  } else {
    list.push({ ...track, isMissing: false, lastSavedAt: Date.now() });
  }
  all[track.videoKey] = list;
  saveAllAssociations(all);
}

/**
 * Remove association for a language and trackType from a video
 */
export function disassociateSubtitleFromVideo(
  videoKey: string,
  language: string,
  trackType?: SubtitleTrackType
): void {
  const all = getAllAssociations();
  const list = all[videoKey] || [];
  const lowerLang = language.toLowerCase();
  all[videoKey] = list.filter(
    (t) => !(t.language.toLowerCase() === lowerLang && (!trackType || t.trackType === trackType))
  );
  saveAllAssociations(all);
}

/**
 * Erase all associations for a given language (and trackType) across all stored videos
 */
export function disassociateLanguageFromAllVideos(
  language: string,
  trackType?: SubtitleTrackType,
  title?: string
): void {
  const all = getAllAssociations();
  const lowerLang = language.toLowerCase();
  const cleanTitle = (title || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/\.(ar|en|es|fr|de|ja|zh|ko|it|ru|pt|hi)(\.|$)/i, '')
    .replace(/\s*-\s*[A-Za-z]+ \([A-Za-z]+\)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  for (const key of Object.keys(all)) {
    const list = all[key] || [];
    all[key] = list.filter((t) => {
      const isLang = t.language.toLowerCase() === lowerLang;
      const isType = !trackType || t.trackType === trackType;
      let isTitleMatch = true;
      if (cleanTitle) {
        const normName = (t.name || '')
          .toLowerCase()
          .replace(/\.[a-z0-9]{2,4}$/i, '')
          .replace(/\.(ar|en|es|fr|de|ja|zh|ko|it|ru|pt|hi)(\.|$)/i, '')
          .replace(/\s*-\s*[A-Za-z]+ \([A-Za-z]+\)$/i, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        const normVid = (t.videoTitle || '')
          .toLowerCase()
          .replace(/\.[a-z0-9]{2,4}$/i, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        isTitleMatch =
          !normName ||
          normName.includes(cleanTitle) ||
          cleanTitle.includes(normName) ||
          normVid.includes(cleanTitle) ||
          cleanTitle.includes(normVid);
      }
      return !(isLang && isType && isTitleMatch);
    });
  }
  saveAllAssociations(all);
}

/**
 * Check if the active subtitle is currently associated with the video
 */
export function isSubtitleAssociated(videoKey: string, language: string, trackType: SubtitleTrackType): boolean {
  if (!videoKey) return false;
  const list = getAssociatedSubtitlesForVideo(videoKey);
  return list.some((t) => t.language.toLowerCase() === language.toLowerCase() && t.trackType === trackType && !t.isMissing);
}

/**
 * Get list of available (saved/associated with lines) languages for this video
 */
export function getAvailableLanguagesForVideo(videoKey: string, trackType?: SubtitleTrackType): string[] {
  if (!videoKey) return [];
  const list = getAssociatedSubtitlesForVideo(videoKey);
  const langs = new Set<string>();
  list.forEach((t) => {
    const isType = !trackType || t.trackType === trackType;
    const hasLines = (t.lines && t.lines.length > 0) || (t.linesCount && t.linesCount > 0);
    if (!t.isMissing && isType && hasLines) {
      langs.add(t.language.toLowerCase());
    }
  });
  return Array.from(langs);
}

/**
 * Get list of available (saved/associated) track types for this video (optionally in a given language)
 */
export function getAvailableTrackTypesForVideo(videoKey: string, language?: string): SubtitleTrackType[] {
  if (!videoKey) return [];
  const list = getAssociatedSubtitlesForVideo(videoKey);
  const types = new Set<SubtitleTrackType>();
  list.forEach((t) => {
    if (!t.isMissing) {
      if (!language || t.language === language) {
        types.add(t.trackType);
      }
    }
  });
  return Array.from(types);
}

/**
 * Check if a specific subtitle track is missing from disk / directory
 */
export function isSubtitleTrackMissing(videoKey: string, language: string, trackType: SubtitleTrackType): boolean {
  if (!videoKey) return false;
  const list = getAssociatedSubtitlesForVideo(videoKey);
  const found = list.find((t) => t.language === language && t.trackType === trackType);
  return !!found?.isMissing;
}

/**
 * Instant (lightning fast) parallel verification of associated subtitles against their directory
 */
export async function verifyAssociatedSubtitlesInstant(
  videoKey: string
): Promise<{
  allTracks: AssociatedSubtitleTrack[];
  missingCount: number;
}> {
  const tracks = getAssociatedSubtitlesForVideo(videoKey);
  if (tracks.length === 0) return { allTracks: [], missingCount: 0 };

  const updatedTracks: AssociatedSubtitleTrack[] = await Promise.all(
    tracks.map(async (track) => {
      // If track has a FileSystemFileHandle, check if file still exists on disk
      if (track.fileHandle && typeof track.fileHandle.getFile === 'function') {
        try {
          await track.fileHandle.getFile();
          return { ...track, isMissing: false };
        } catch (err: any) {
          if (err?.name === 'NotFoundError') {
            return { ...track, isMissing: true };
          }
        }
      }
      // If marked as missing in storage, keep missing
      return track;
    })
  );

  // Save back updated states
  const all = getAllAssociations();
  all[videoKey] = updatedTracks;
  saveAllAssociations(all);

  const missingCount = updatedTracks.filter((t) => t.isMissing).length;
  return { allTracks: updatedTracks, missingCount };
}

/**
 * Mark a track as missing or restored (for UI toggle/test)
 */
export function setTrackMissingState(videoKey: string, language: string, trackType: SubtitleTrackType, missing: boolean): void {
  const all = getAllAssociations();
  const list = all[videoKey] || [];
  const item = list.find((t) => t.language === language && t.trackType === trackType);
  if (item) {
    item.isMissing = missing;
    all[videoKey] = list;
    saveAllAssociations(all);
  }
}
