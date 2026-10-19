import { apiFetch } from './utils/api';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useDarkMode } from './hooks/useDarkMode';
import { Header } from './components/Header';
import { SubtitleTable } from './components/SubtitleTable';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import {
  saveSubtitleToDatabase,
  findTrackInDatabase,
  findPrimaryTrackForProject,
  inferMediaClassification,
  cleanMediaTitle,
  clearLanguageFromDatabase,
  deleteTrackFromDatabase,
  syncDatabaseWithServer,
  getAvailableLanguagesInDatabase,
  getAllDatabaseTracks,
  DatabaseSubtitleTrack,
  saveTitleFormatting,
  getTitleFormatting,
  applyTitleFormattingToLines,
  syncLineFormattingAcrossLanguages,
} from './utils/mediaDatabase';
import { getLanguageByCode } from './utils/languages';
import { runAITranslationWithVerification, TranslationProgressUpdate } from './utils/aiTranslationRunner';
import { isLineInTargetLanguage } from './utils/languageChecker';
import { SubtitleLine, FlagData, Character, SubtitleTrackType, SubtitleProject } from './types/subtitle';
import { secondsToTimecode, timecodeToSeconds } from './utils/timecode';
import { parseAnySubtitle } from './utils/subtitleParser';
import {
  VideoSourceInfo,
  searchVideoForSubtitlesOrTranscript,
  getAssociatedSubtitlesForVideo,
  associateSubtitleWithVideo,
  disassociateSubtitleFromVideo,
  disassociateLanguageFromAllVideos,
  isSubtitleAssociated,
  getAvailableLanguagesForVideo,
  getAvailableTrackTypesForVideo,
  isSubtitleTrackMissing,
  verifyAssociatedSubtitlesInstant,
  getVideoKey,
  extractYouTubeId,
} from './utils/videoSubtitleManager';
import {
  getSubtitleSession,
  loadLastSubtitleFile,
  pickSubtitleFile,
  saveSubtitleSession,
  SavedSubtitleSession,
  getVideoSession,
  loadLastVideoFile,
} from './utils/fileResumeStorage';
import { SAMPLE_VIDEOS } from './components/VideoPlayerPreview';
import { FileText, AlertCircle, Upload, Check, X, Sparkles, Languages } from 'lucide-react';

const SettingsModal = React.lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const FlagEditorModal = React.lazy(() => import('./components/FlagEditorModal').then((module) => ({ default: module.FlagEditorModal })));
const UserLoginModal = React.lazy(() => import('./components/UserLoginModal').then((module) => ({ default: module.UserLoginModal })));
const ImportExportModal = React.lazy(() => import('./components/ImportExportModal').then((module) => ({ default: module.ImportExportModal })));
const AutoTranslateModal = React.lazy(() => import('./components/AutoTranslateModal').then((module) => ({ default: module.AutoTranslateModal })));
const MediaDatabaseModal = React.lazy(() => import('./components/MediaDatabaseModal').then((module) => ({ default: module.MediaDatabaseModal })));
const MobileSubtitleCardView = React.lazy(() => import('./components/MobileSubtitleCardView').then((module) => ({ default: module.MobileSubtitleCardView })));

// Download modal code only when it is first needed. Once opened, keep it mounted
// so closing/reopening preserves the existing modal's internal state and behavior.
function MountAfterFirstOpen({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [hasOpened, setHasOpened] = useState(open);
  useEffect(() => { if (open) setHasOpened(true); }, [open]);
  return open || hasOpened ? <>{children}</> : null;
}

export default function App() {
  const {
    project,
    setProject,
    currentUser,
    setCurrentUser,
    collaborators,
    isConnected,
    isSaving,
    lastSavedAt,
    updateTitle,
    updateLine,
    addLine,
    deleteLine,
    deleteLines,
    reorderLines,
    updateCharacters,
    updateDefaults,
    selectSeries,
    updateSeriesList,
    replaceProject,
    setFocusedLine,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    undo,
    redo,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleGroupCollapse,
    moveLinesToGroup,
    moveGroup,
    reorderProjectItems,
    updateLanguage,
    updateTrackType,
    saveToLocalStorage,
  } = useRealtimeSync();

  const {
    isDark,
    currentTheme,
    availableThemesForMode,
    toggleDarkMode,
    selectTheme,
  } = useDarkMode();

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'series' | 'characters' | 'typography' | 'language'>('series');
  const [isUserLoginOpen, setIsUserLoginOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'export' | 'import'>('export');
  const [flagModalLine, setFlagModalLine] = useState<SubtitleLine | null>(null);

  // Auto-Translate Modal state
  const [isAutoTranslateOpen, setIsAutoTranslateOpen] = useState(false);
  const [pendingTranslateData, setPendingTranslateData] = useState<{
    sourceLang: string;
    targetLang: string;
    sourceType: SubtitleTrackType;
    targetType: SubtitleTrackType;
  } | null>(null);

  // Media Database Hierarchy Browser Modal state
  const [isMediaDatabaseOpen, setIsMediaDatabaseOpen] = useState(false);

  // AI Translation progress state for sliding Header bar
  const [translationProgress, setTranslationProgress] = useState<TranslationProgressUpdate | null>(null);

  // Subtitle Resume & Missing notice state
  const [missingSubtitleNotice, setMissingSubtitleNotice] = useState<{ fileName: string; reason: string } | null>(null);
  const [subtitleResumeNotice, setSubtitleResumeNotice] = useState<string | null>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement | null>(null);

  // Video Player Accordion & PiP state
  const [isVideoOpen, setIsVideoOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('subflow_is_video_open');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });
  const [isPipActive, setIsPipActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Video Source & Subtitle Association state
  const [activeVideoSource, setActiveVideoSource] = useState<VideoSourceInfo | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableTrackTypes, setAvailableTrackTypes] = useState<SubtitleTrackType[]>([]);
  const [missingLanguages, setMissingLanguages] = useState<string[]>([]);
  const [missingTrackTypes, setMissingTrackTypes] = useState<SubtitleTrackType[]>([]);

  // Refresh associations for active video key and database tracks
  const refreshAssociations = useCallback(
    async (
      videoKey: string | undefined,
      currentLang: string,
      currentTrack: SubtitleTrackType,
      excludeLang?: string
    ) => {
      let missingLangs: string[] = [];
      let missingTypes: SubtitleTrackType[] = [];

      if (videoKey) {
        const { allTracks } = await verifyAssociatedSubtitlesInstant(videoKey);
        missingLangs = allTracks.filter((t) => t.isMissing).map((t) => t.language.toLowerCase());
        missingTypes = allTracks
          .filter((t) => t.isMissing && t.language.toLowerCase() === currentLang.toLowerCase())
          .map((t) => t.trackType);
      }

      // Compute available languages across media database, video associations, and current project
      const availableLangsSet = new Set<string>();

      // 1. From database for this title and current track type (tracks with lines)
      const dbLangs = getAvailableLanguagesInDatabase(project.title, currentTrack);
      dbLangs.forEach((l) => availableLangsSet.add(l.toLowerCase()));

      // 2. From active video associations if present
      if (videoKey) {
        const videoLangs = getAvailableLanguagesForVideo(videoKey, currentTrack);
        videoLangs.forEach((l) => availableLangsSet.add(l.toLowerCase()));
      }

      // 3. From current project lines if matching currentTrack
      if (
        project.lines &&
        project.lines.length > 0 &&
        project.language &&
        (project.trackType || 'Normal') === currentTrack
      ) {
        availableLangsSet.add(project.language.toLowerCase());
      }

      if (excludeLang) {
        availableLangsSet.delete(excludeLang.toLowerCase());
      }

      const availableTypes = videoKey
        ? getAvailableTrackTypesForVideo(videoKey, currentLang)
        : [project.trackType || 'Normal'];

      setAvailableLanguages(Array.from(availableLangsSet));
      setAvailableTrackTypes(availableTypes);
      setMissingLanguages(missingLangs);
      setMissingTrackTypes(missingTypes);
    },
    [project.title, project.lines, project.language, project.trackType]
  );

  // Check if current subtitle track is associated with the active video
  const isCurrentSubtitleAssociated = useMemo(() => {
    if (!activeVideoSource) return false;
    return isSubtitleAssociated(
      activeVideoSource.key,
      project.language || 'en',
      project.trackType || 'Normal'
    );
  }, [activeVideoSource, project.language, project.trackType, availableLanguages, availableTrackTypes]);

  // Check if current subtitle track is missing from last saved directory
  const isCurrentSubtitleMissing = useMemo(() => {
    if (!activeVideoSource) return false;
    return isSubtitleTrackMissing(
      activeVideoSource.key,
      project.language || 'en',
      project.trackType || 'Normal'
    );
  }, [activeVideoSource, project.language, project.trackType, missingLanguages, missingTrackTypes]);

  // Handler when any video is loaded (file, custom URL, YouTube, or sample)
  const handleVideoLoaded = useCallback(
    async (source: VideoSourceInfo) => {
      setActiveVideoSource(source);
      try {
        localStorage.setItem(
          'subflow_last_video_source',
          JSON.stringify({
            key: source.key,
            title: source.title,
            url: source.url,
            sourceType: source.sourceType,
            fileName: source.fileName,
            youtubeId: source.youtubeId,
          })
        );
      } catch {}

      // If active subtitle is already loaded, associate it with this video!
      if (project.lines && project.lines.length > 0) {
        associateSubtitleWithVideo({
          id: `${project.language || 'en'}_${project.trackType || 'Normal'}`,
          videoKey: source.key,
          videoTitle: source.title,
          name: project.title,
          language: project.language || 'en',
          trackType: project.trackType || 'Normal',
          lastSavedDirectory: source.fileName ? `/videos/${source.fileName}/subtitles` : `/transcripts/${source.key}`,
          lastSavedFileName: `${source.fileName || 'video'}.${project.language || 'en'}.srt`,
          lastSavedAt: Date.now(),
          linesCount: project.lines.length,
          lines: project.lines,
        });
      }

      // Check all associated subtitles/transcripts instantly from directory
      await refreshAssociations(
        source.key,
        project.language || 'en',
        project.trackType || 'Normal'
      );
    },
    [project.language, project.trackType, project.title, project.lines, refreshAssociations]
  );

  // Toggle Associate button
  const handleToggleAssociate = useCallback(() => {
    if (!activeVideoSource) return;
    const currentLang = project.language || 'en';
    const currentType = project.trackType || 'Normal';
    const currentKey = activeVideoSource.key;

    if (isCurrentSubtitleAssociated && !isCurrentSubtitleMissing) {
      // Disassociate
      disassociateSubtitleFromVideo(currentKey, currentLang, currentType);
    } else {
      // Associate with video (or re-associate if it was missing)
      associateSubtitleWithVideo({
        id: `${currentLang}_${currentType}`,
        videoKey: currentKey,
        videoTitle: activeVideoSource.title,
        name: project.title,
        language: currentLang,
        trackType: currentType,
        lastSavedDirectory: activeVideoSource.fileName
          ? `/videos/${activeVideoSource.fileName}/subtitles`
          : `/transcripts/${activeVideoSource.key}`,
        lastSavedFileName: `${activeVideoSource.fileName || 'video'}.${currentLang}.srt`,
        lastSavedAt: Date.now(),
        linesCount: project.lines.length,
        lines: project.lines,
      });
    }

    refreshAssociations(currentKey, currentLang, currentType);
  }, [
    activeVideoSource,
    project.language,
    project.trackType,
    project.title,
    project.lines,
    isCurrentSubtitleAssociated,
    isCurrentSubtitleMissing,
    refreshAssociations,
  ]);

  // Handle switching language in dropdown
  const handleUpdateLanguage = useCallback(
    async (newLang: string) => {
      const currentLang = project.language || 'en';
      const currentType = project.trackType || 'Normal';
      const cleanTitle = cleanMediaTitle(project.title);

      // Detect if current lines in editor have Arabic characters
      const hasArabicChars = (lines: SubtitleLine[]) => lines.some((l) => /[\u0600-\u06FF]/.test(l.text));
      const isCurrentArabic = hasArabicChars(project.lines);

      // Ensure current Arabic lines are saved as Arabic track in database if not already
      if (isCurrentArabic && project.lines.length > 0) {
        const arTrack = findTrackInDatabase(project.title, 'ar', currentType);
        if (!arTrack) {
          saveSubtitleToDatabase({
            id: `${cleanTitle.replace(/\s+/g, '_')}_ar_${currentType}`.toLowerCase(),
            medium: 'Movie',
            title: cleanTitle,
            season: 'Feature Film',
            episode: 'Theatrical Release',
            variant: 'Standard',
            language: 'ar',
            trackType: currentType,
            isPrimary: true,
            lines: project.lines,
            lastSavedAt: Date.now(),
            sourceFileName: `${cleanTitle}.ar.srt`,
          });
        }
      }

      // 1. Pull directly from database for newLang and currentType
      let match: any = null;
      if (activeVideoSource) {
        const associated = getAssociatedSubtitlesForVideo(activeVideoSource.key);
        match = associated.find(
          (t) =>
            t.language.toLowerCase() === newLang.toLowerCase() &&
            t.trackType === currentType &&
            !t.isMissing &&
            t.lines &&
            t.lines.length > 0
        );
      }
      if (!match) {
        match = findTrackInDatabase(project.title, newLang, currentType) || findTrackInDatabase(cleanTitle, newLang, currentType);
      }

      // If found in database, INSTANTLY pull and replace all editor text!
      if (match && match.lines && match.lines.length > 0) {
        const targetTitle =
          match.name ||
          match.title ||
          `${cleanTitle} - ${getLanguageByCode(newLang).name} (${currentType})`;
        // Apply title formatting to lines across all languages!
        const formattedLines = applyTitleFormattingToLines(cleanTitle, match.lines);
        const updated: SubtitleProject = {
          ...project,
          language: newLang,
          title: targetTitle,
          lines: formattedLines,
          updatedAt: Date.now(),
        };
        replaceProject(updated);
        refreshAssociations(activeVideoSource?.key, newLang, currentType);
        apiFetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch(() => {});
        return;
      }

      // 2. If no lines exist, just update language code
      if (!project.lines || project.lines.length === 0) {
        updateLanguage(newLang);
        refreshAssociations(activeVideoSource?.key, newLang, currentType);
        return;
      }

      // 3. Not in database: automatically translate to newLang using AI with live sliding progress bar and 100% verification check!
      let sourceLines = project.lines;
      let detectedSource = isCurrentArabic ? 'ar' : currentLang;

      // Prefer English lines from database as translation source if available
      const enDbTrack = findTrackInDatabase(project.title, 'en', currentType) || findTrackInDatabase(cleanTitle, 'en', currentType);
      if (enDbTrack && enDbTrack.lines && enDbTrack.lines.length > 0 && newLang.toLowerCase() !== 'en') {
        sourceLines = enDbTrack.lines;
        detectedSource = 'en';
      }

      try {
        const translatedLines = await runAITranslationWithVerification({
          lines: sourceLines,
          targetLang: newLang,
          sourceLang: detectedSource,
          targetType: currentType,
          onProgress: (p) => setTranslationProgress(p),
        });

        if (translatedLines && translatedLines.length > 0) {
          const targetTitle = `${cleanTitle} - ${getLanguageByCode(newLang).name} (${currentType})`;
          const updatedProj: SubtitleProject = {
            ...project,
            language: newLang,
            title: targetTitle,
            lines: translatedLines,
            updatedAt: Date.now(),
          };

          replaceProject(updatedProj);

          // Parallel non-blocking background persistence so the UI renders instantly
          Promise.all([
            saveSubtitleToDatabase({
              id: `${cleanTitle.replace(/\s+/g, '_')}_${newLang}_${currentType}`.toLowerCase(),
              medium: 'Movie',
              title: cleanTitle,
              season: 'Feature Film',
              episode: 'Theatrical Release',
              variant: 'Standard',
              language: newLang,
              trackType: currentType,
              isPrimary: false,
              lines: translatedLines,
              lastSavedAt: Date.now(),
              sourceFileName: `${cleanTitle}.${newLang}.srt`,
            }),
            activeVideoSource
              ? associateSubtitleWithVideo({
                  id: `${newLang}_${currentType}`,
                  videoKey: activeVideoSource.key,
                  videoTitle: activeVideoSource.title,
                  name: targetTitle,
                  language: newLang,
                  trackType: currentType,
                  lastSavedFileName: `${activeVideoSource.fileName || cleanTitle}.${newLang}.srt`,
                  lastSavedAt: Date.now(),
                  linesCount: translatedLines.length,
                  lines: translatedLines,
                })
              : Promise.resolve(),
            saveSubtitleSession({
              fileName: `${cleanTitle}.${newLang}.srt`,
              format: 'srt',
              content: translatedLines.map((l) => `${l.lineNumber}\n${l.startTime} --> ${l.endTime}\n${l.text}\n`).join('\n'),
              linesCount: translatedLines.length,
            }),
            apiFetch('/api/project', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedProj),
            }).catch(() => {}),
          ]).catch((err) => console.warn('Background save notice:', err));

          refreshAssociations(activeVideoSource?.key, newLang, currentType);

          // After brief celebration of 100% completion, slide buttons back into place
          setTimeout(() => {
            setTranslationProgress(null);
          }, 1200);
        }
      } catch (err: any) {
        console.error('Translation process error:', err);
        setTranslationProgress((prev) =>
          prev ? { ...prev, phase: 'error', error: err.message || 'Translation failed' } : null
        );
        setTimeout(() => {
          setTranslationProgress(null);
        }, 3000);
      }
    },
    [activeVideoSource, project, replaceProject, refreshAssociations, updateLanguage]
  );

  // Redo translation for a specific language
  const handleRedoLanguage = useCallback(
    async (code: string) => {
      const cleanTitle = cleanMediaTitle(project.title);
      const currentType = project.trackType || 'Normal';
      let sourceTrack = findTrackInDatabase(project.title, 'en', currentType) || findTrackInDatabase(project.title, 'ar', currentType);
      const linesToTranslate = sourceTrack?.lines || project.lines;
      const srcLang = sourceTrack?.language || (project.lines.some((l) => /[\u0600-\u06FF]/.test(l.text)) ? 'ar' : 'en');

      try {
        const translatedLines = await runAITranslationWithVerification({
          lines: linesToTranslate,
          targetLang: code,
          sourceLang: srcLang,
          targetType: currentType,
          onProgress: (p) => setTranslationProgress(p),
        });

        if (translatedLines && translatedLines.length > 0) {
          const targetTitle = `${cleanTitle} - ${getLanguageByCode(code).name} (${currentType})`;
          await saveSubtitleToDatabase({
            id: `${cleanTitle.replace(/\s+/g, '_')}_${code}_${currentType}`.toLowerCase(),
            medium: 'Movie',
            title: cleanTitle,
            season: 'Feature Film',
            episode: 'Theatrical Release',
            variant: 'Standard',
            language: code,
            trackType: currentType,
            isPrimary: false,
            lines: translatedLines,
            lastSavedAt: Date.now(),
            sourceFileName: `${cleanTitle}.${code}.srt`,
          });

          if (project.language?.toLowerCase() === code.toLowerCase()) {
            const updated: SubtitleProject = {
              ...project,
              language: code,
              title: targetTitle,
              lines: translatedLines,
              updatedAt: Date.now(),
            };
            replaceProject(updated);
            apiFetch('/api/project', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {});
          }

          refreshAssociations(activeVideoSource?.key, code, currentType);

          setTimeout(() => {
            setTranslationProgress(null);
          }, 1200);
        }
      } catch (err: any) {
        console.warn('Redo language error:', err);
        setTranslationProgress((prev) =>
          prev ? { ...prev, phase: 'error', error: err.message || 'Redo failed' } : null
        );
        setTimeout(() => {
          setTranslationProgress(null);
        }, 3000);
      }
    },
    [project, activeVideoSource, replaceProject, refreshAssociations]
  );

  // Clear / erase language entirely from database and associations
  const handleClearLanguage = useCallback(
    async (code: string) => {
      const currentType = project.trackType || 'Normal';
      const lowerCode = code.toLowerCase();

      // 1. Erase from Media Database (client in-memory cache, localStorage, and server)
      await clearLanguageFromDatabase(project.title, code, currentType);

      // 2. Erase from all video subtitle associations in videoSubtitleManager
      if (activeVideoSource) {
        disassociateSubtitleFromVideo(activeVideoSource.key, code, currentType);
      }
      disassociateLanguageFromAllVideos(code, currentType, project.title);

      // 3. Immediately filter out this language from availableLanguages state so it is grayed out
      setAvailableLanguages((prev) => prev.filter((l) => l.toLowerCase() !== lowerCode));

      // 4. If current editor project is this language and track type, clear its lines
      if (
        project.language?.toLowerCase() === lowerCode &&
        (project.trackType || 'Normal') === currentType
      ) {
        const fallbackTrack =
          findTrackInDatabase(project.title, 'en', currentType) ||
          findTrackInDatabase(project.title, 'ar', currentType) ||
          findPrimaryTrackForProject('Movie', project.title);

        if (
          fallbackTrack &&
          fallbackTrack.language.toLowerCase() !== lowerCode &&
          fallbackTrack.lines &&
          fallbackTrack.lines.length > 0
        ) {
          const updated: SubtitleProject = {
            ...project,
            language: fallbackTrack.language,
            title: `${cleanMediaTitle(project.title)} - ${getLanguageByCode(fallbackTrack.language).name} (${currentType})`,
            lines: fallbackTrack.lines,
            updatedAt: Date.now(),
          };
          replaceProject(updated);
          apiFetch('/api/project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          }).catch(() => {});
          refreshAssociations(activeVideoSource?.key, fallbackTrack.language, currentType, lowerCode);
        } else {
          const updated: SubtitleProject = {
            ...project,
            lines: [],
            updatedAt: Date.now(),
          };
          replaceProject(updated);
          apiFetch('/api/project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          }).catch(() => {});
          refreshAssociations(activeVideoSource?.key, code, currentType, lowerCode);
        }
      } else {
        refreshAssociations(activeVideoSource?.key, project.language || 'en', currentType, lowerCode);
      }
    },
    [project, activeVideoSource, replaceProject, refreshAssociations]
  );

  // Handle switching track type in dropdown
  const handleUpdateTrackType = useCallback(
    (newType: SubtitleTrackType) => {
      const currentLang = project.language || 'en';
      const currentType = project.trackType || 'Normal';
      if (newType === currentType) return;

      let match: any = null;
      if (activeVideoSource) {
        const associated = getAssociatedSubtitlesForVideo(activeVideoSource.key);
        match = associated.find(
          (t) => t.language.toLowerCase() === currentLang.toLowerCase() && t.trackType === newType && !t.isMissing
        );
      }
      if (!match) {
        match = findTrackInDatabase(project.title, currentLang, newType);
      }

      if (match && match.lines && match.lines.length > 0) {
        const updated: SubtitleProject = {
          ...project,
          trackType: newType,
          title: match.name || match.title || project.title,
          lines: match.lines,
          updatedAt: Date.now(),
        };
        replaceProject(updated);
        if (activeVideoSource) {
          refreshAssociations(activeVideoSource.key, currentLang, newType);
        }
        setSubtitleResumeNotice(`Loaded ${newType} track.`);
        setTimeout(() => setSubtitleResumeNotice(null), 3000);
        return;
      }

      // Prompt to auto adapt / generate for this type if primary lines exist
      if (project.lines.length > 0) {
        setPendingTranslateData({
          sourceLang: currentLang,
          targetLang: currentLang,
          sourceType: currentType,
          targetType: newType,
        });
        setIsAutoTranslateOpen(true);
        return;
      }

      updateTrackType(newType);
      if (activeVideoSource) {
        refreshAssociations(activeVideoSource.key, currentLang, newType);
      }
    },
    [activeVideoSource, project, updateTrackType, refreshAssociations, replaceProject]
  );

  // Handle translation confirmation
  const handleConfirmTranslate = useCallback(
    async (options: { translatePrimary: boolean; translateLinkedCc: boolean }) => {
      if (!pendingTranslateData) return;
      const { sourceLang, targetLang, sourceType, targetType } = pendingTranslateData;
      const currentLang = project.language || 'en';
      const currentType = project.trackType || 'Normal';

      const mediaClassification = inferMediaClassification(activeVideoSource?.title || project.title);

      // Save current reference track to database as primary reference
      await saveSubtitleToDatabase({
        id: `${mediaClassification.title.replace(/\s+/g, '_')}_${mediaClassification.season}_${mediaClassification.episode}_${mediaClassification.variant}_${currentLang}_${currentType}`.toLowerCase(),
        medium: mediaClassification.medium,
        title: mediaClassification.title,
        season: mediaClassification.season,
        episode: mediaClassification.episode,
        variant: mediaClassification.variant,
        language: currentLang,
        trackType: currentType,
        isPrimary: true,
        lines: project.lines,
        format: 'srt',
        lastSavedAt: Date.now(),
        videoKey: activeVideoSource?.key,
        videoTitle: activeVideoSource?.title,
        sourceFileName: `${project.title}.${currentLang}.srt`,
      });

      // 1. Translate primary track
      let translatedPrimaryLines: SubtitleLine[] = project.lines;
      try {
        const res = await apiFetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: project.lines,
            sourceLang,
            targetLang,
            targetType,
          }),
        });
        const data = await res.json();
        if (data.translatedLines && Array.isArray(data.translatedLines)) {
          translatedPrimaryLines = data.translatedLines;
        }
      } catch (e) {
        console.warn('Translation call fallback:', e);
      }

      // 2. If translateLinkedCc is true, translate linked CC track too!
      if (options.translateLinkedCc) {
        const associated = activeVideoSource ? getAssociatedSubtitlesForVideo(activeVideoSource.key) : [];
        const linkedCc = associated.find((t) => (t.trackType === 'CC' || t.trackType === 'SDH') && !t.isMissing);
        const ccSourceLines = linkedCc?.lines || project.lines;

        try {
          const ccRes = await apiFetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lines: ccSourceLines,
              sourceLang,
              targetLang,
              targetType: 'CC',
            }),
          });
          const ccData = await ccRes.json();
          const translatedCcLines: SubtitleLine[] = ccData.translatedLines;

          if (translatedCcLines && translatedCcLines.length > 0) {
            await saveSubtitleToDatabase({
              id: `${mediaClassification.title.replace(/\s+/g, '_')}_${mediaClassification.season}_${mediaClassification.episode}_${mediaClassification.variant}_${targetLang}_CC`.toLowerCase(),
              medium: mediaClassification.medium,
              title: mediaClassification.title,
              season: mediaClassification.season,
              episode: mediaClassification.episode,
              variant: mediaClassification.variant,
              language: targetLang,
              trackType: 'CC',
              isPrimary: false,
              lines: translatedCcLines,
              format: 'srt',
              lastSavedAt: Date.now(),
              videoKey: activeVideoSource?.key,
              videoTitle: activeVideoSource?.title,
              sourceFileName: `${mediaClassification.title}.${targetLang}.cc.srt`,
            });

            if (activeVideoSource) {
              associateSubtitleWithVideo({
                id: `${targetLang}_CC`,
                videoKey: activeVideoSource.key,
                videoTitle: activeVideoSource.title,
                name: `${mediaClassification.title} - ${getLanguageByCode(targetLang).name} (CC)`,
                language: targetLang,
                trackType: 'CC',
                lastSavedFileName: `${mediaClassification.title}.${targetLang}.cc.srt`,
                lastSavedAt: Date.now(),
                linesCount: translatedCcLines.length,
                lines: translatedCcLines,
              });
            }
          }
        } catch (ccErr) {
          console.warn('CC translation error:', ccErr);
        }
      }

      // 3. Save primary translation to database
      await saveSubtitleToDatabase({
        id: `${mediaClassification.title.replace(/\s+/g, '_')}_${mediaClassification.season}_${mediaClassification.episode}_${mediaClassification.variant}_${targetLang}_${targetType}`.toLowerCase(),
        medium: mediaClassification.medium,
        title: mediaClassification.title,
        season: mediaClassification.season,
        episode: mediaClassification.episode,
        variant: mediaClassification.variant,
        language: targetLang,
        trackType: targetType,
        isPrimary: false,
        lines: translatedPrimaryLines,
        format: 'srt',
        lastSavedAt: Date.now(),
        videoKey: activeVideoSource?.key,
        videoTitle: activeVideoSource?.title,
        sourceFileName: `${mediaClassification.title}.${targetLang}.srt`,
      });

      // 4. Update current project using replaceProject so editor/text area immediately updates
      const newTitle = `${mediaClassification.title} - ${getLanguageByCode(targetLang).name} (${targetType})`;
      const updatedProject: SubtitleProject = {
        ...project,
        language: targetLang,
        trackType: targetType,
        title: newTitle,
        lines: translatedPrimaryLines,
        updatedAt: Date.now(),
      };
      replaceProject(updatedProject);

      // 5. Associate with active video
      if (activeVideoSource) {
        associateSubtitleWithVideo({
          id: `${targetLang}_${targetType}`,
          videoKey: activeVideoSource.key,
          videoTitle: activeVideoSource.title,
          name: newTitle,
          language: targetLang,
          trackType: targetType,
          lastSavedFileName: `${mediaClassification.title}.${targetLang}.srt`,
          lastSavedAt: Date.now(),
          linesCount: translatedPrimaryLines.length,
          lines: translatedPrimaryLines,
        });
        refreshAssociations(activeVideoSource.key, targetLang, targetType);
      }

      // 6. Save subtitle session for persistence
      await saveSubtitleSession({
        fileName: `${mediaClassification.title}.${targetLang}.srt`,
        format: 'srt',
        content: translatedPrimaryLines.map((l) => `${l.lineNumber}\n${l.startTime} --> ${l.endTime}\n${l.text}\n`).join('\n'),
        linesCount: translatedPrimaryLines.length,
      });

      setSubtitleResumeNotice(`Auto-translated and displayed ${getLanguageByCode(targetLang).name} subtitles.`);
      setTimeout(() => setSubtitleResumeNotice(null), 3500);
      setIsAutoTranslateOpen(false);
      setPendingTranslateData(null);
    },
    [pendingTranslateData, project, activeVideoSource, replaceProject, refreshAssociations]
  );

  // Handle selecting a track from Media Database Modal
  const handleSelectDatabaseTrack = useCallback(
    (track: DatabaseSubtitleTrack) => {
      const updated: SubtitleProject = {
        ...project,
        title: `${track.title} - ${getLanguageByCode(track.language).name} (${track.trackType})`,
        language: track.language,
        trackType: track.trackType,
        lines: track.lines || [],
        updatedAt: Date.now(),
      };
      replaceProject(updated);

      saveSubtitleSession({
        fileName: `${track.title}.${track.language}.${track.trackType.toLowerCase()}.srt`,
        format: track.format || 'srt',
        content: track.lines.map((l) => `${l.lineNumber}\n${l.startTime} --> ${l.endTime}\n${l.text}\n`).join('\n'),
        linesCount: track.lines.length,
      });

      if (activeVideoSource) {
        associateSubtitleWithVideo({
          id: `${track.language}_${track.trackType}`,
          videoKey: activeVideoSource.key,
          videoTitle: activeVideoSource.title,
          name: `${track.title} - ${getLanguageByCode(track.language).name} (${track.trackType})`,
          language: track.language,
          trackType: track.trackType,
          lastSavedFileName: `${track.title}.${track.language}.srt`,
          lastSavedAt: Date.now(),
          linesCount: track.lines.length,
          lines: track.lines,
        });
        refreshAssociations(activeVideoSource.key, track.language, track.trackType);
      }

      setSubtitleResumeNotice(`Loaded "${track.title}" [${track.language.toUpperCase()} · ${track.trackType}] (${track.lines.length} lines)`);
      setTimeout(() => setSubtitleResumeNotice(null), 3500);
    },
    [activeVideoSource, project, refreshAssociations, replaceProject]
  );

  // Pre-calculate numeric intervals for project lines (ultra-fast active line matching)
  const timedProjectLines = useMemo(() => {
    return project.lines.map((l) => ({
      line: l,
      startSec: timecodeToSeconds(l.startTime),
      endSec: timecodeToSeconds(l.endTime),
    }));
  }, [project.lines]);

  const [activePlayingLineId, setActivePlayingLineId] = useState<string | null>(null);

  // Active playing subtitle line in real time
  const activePlayingLine = useMemo(() => {
    for (let i = 0; i < timedProjectLines.length; i++) {
      const item = timedProjectLines[i];
      if (currentTime >= item.startSec && currentTime <= item.endSec) {
        return item.line;
      }
    }
    return null;
  }, [timedProjectLines, currentTime]);

  useEffect(() => {
    setActivePlayingLineId(activePlayingLine?.id ?? null);
  }, [activePlayingLine?.id]);

  // PERMANENT FIX: Whenever a language is set OR database is synced, ensure the subtitles displayed below are 100% of THAT language
  useEffect(() => {
    const checkAndSyncLanguage = () => {
      const currentLang = (project.language || 'en').toLowerCase();
      const currentType = project.trackType || 'Normal';
      const cleanTitle = cleanMediaTitle(project.title);

      // If currentLang is not English, ensure project.lines are not untranslated English lines
      if (currentLang !== 'en' && project.lines && project.lines.length > 0) {
        const sample = project.lines.slice(0, 15);
        const isEnglishSample = sample.some((l) => {
          const text = l.text.trim();
          return text && !isLineInTargetLanguage(text, currentLang);
        });

        if (isEnglishSample) {
          const allTracks = getAllDatabaseTracks();
          const match =
            findTrackInDatabase(project.title, currentLang, currentType) ||
            findTrackInDatabase(cleanTitle, currentLang, currentType) ||
            allTracks.find(
              (t) =>
                t.language.toLowerCase() === currentLang &&
                (t.trackType === currentType || t.trackType === 'Normal') &&
                t.lines &&
                t.lines.length > 0
            );

          if (match && match.lines && match.lines.length > 0) {
            const isMatchTranslated = match.lines
              .slice(0, 5)
              .every((l) => isLineInTargetLanguage(l.text, currentLang));
            if (isMatchTranslated) {
              console.log(`[LanguageGuard] Switching subtitles to match set language: ${currentLang}`);
              const updatedProj: SubtitleProject = {
                ...project,
                language: currentLang,
                title: `${cleanTitle} - ${getLanguageByCode(currentLang).name} (${currentType})`,
                lines: match.lines,
                updatedAt: Date.now(),
              };
              replaceProject(updatedProj);
              refreshAssociations(activeVideoSource?.key, currentLang, currentType);
            }
          }
        }
      }
    };

    checkAndSyncLanguage();

    if (typeof window !== 'undefined') {
      window.addEventListener('subflow:database-synced', checkAndSyncLanguage);
      return () => window.removeEventListener('subflow:database-synced', checkAndSyncLanguage);
    }
  }, [
    project.language,
    project.trackType,
    project.title,
    project.lines,
    activeVideoSource?.key,
    refreshAssociations,
    replaceProject,
  ]);

  // Save format changes (color, style, typography, shadow, outline) to TITLE across all languages
  const handleSaveTitleFormatting = useCallback(
    (updates: any) => {
      if (!project.title) return;
      saveTitleFormatting(project.title, updates);
      // Also update current project defaultSettings so new lines and non-overridden lines adopt it
      const updatedDefaults = {
        ...project.defaultSettings,
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
      };
      updateDefaults(updatedDefaults);
    },
    [project.title, project.defaultSettings, updateDefaults]
  );

  // Jump video to clicked line's timestamp
  const handleSeekToLine = useCallback(
    (line: SubtitleLine) => {
      const startSec = timecodeToSeconds(line.startTime);
      setCurrentTime(startSec);
      if (videoRef.current) {
        videoRef.current.currentTime = startSec;
      }
      if (!isVideoOpen && !isPipActive) {
        setIsVideoOpen(true);
        try { localStorage.setItem('subflow_is_video_open', 'true'); } catch {}
      }
    },
    [isVideoOpen, isPipActive]
  );

  // Toggle Video Player Accordion (from table thead 11th th icon)
  const handleToggleVideo = useCallback(() => {
    if (isPipActive && typeof document !== 'undefined' && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
      setIsPipActive(false);
      setIsVideoOpen(true);
      try { localStorage.setItem('subflow_is_video_open', 'true'); } catch {}
    } else {
      setIsVideoOpen((prev) => {
        const next = !prev;
        try { localStorage.setItem('subflow_is_video_open', String(next)); } catch {}
        return next;
      });
    }
  }, [isPipActive]);

  const handleOpenImportExport = useCallback((tab: 'export' | 'import' = 'export') => {
    setImportExportTab(tab);
    setIsImportExportOpen(true);
  }, []);

  const handleAddCharacters = useCallback(
    (newChars: Character[]) => {
      if (!newChars || newChars.length === 0) return;
      setProject((prev) => {
        const existingIds = new Set(prev.characters.map((c) => c.id));
        const existingNames = new Set(prev.characters.map((c) => c.name.toLowerCase()));
        const toAdd = newChars.filter(
          (c) => !existingIds.has(c.id) && !existingNames.has(c.name.toLowerCase())
        );
        if (toAdd.length === 0) return prev;
        return {
          ...prev,
          characters: [...prev.characters, ...toAdd],
          updatedAt: Date.now(),
        };
      });
    },
    [setProject]
  );

  const handleAddSingleCharacter = useCallback(
    (newChar: Character) => {
      const updated = [...project.characters, newChar];
      updateCharacters(updated);
      if (project.seriesId && project.seriesList) {
        const updatedSeriesList = project.seriesList.map((s) => {
          if (s.id === project.seriesId) {
            return {
              ...s,
              characters: s.characters ? [...s.characters, newChar] : [newChar],
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        updateSeriesList(updatedSeriesList);
      }
    },
    [project.characters, project.seriesId, project.seriesList, updateCharacters, updateSeriesList]
  );

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const characterSearchNames = useMemo(() => new Map(project.characters.map((char) => [char.id, char.name.toLowerCase()])), [project.characters]);
  const [flagFilterOnly, setFlagFilterOnly] = useState(false);
  const [selectedCharFilter, setSelectedCharFilter] = useState('all');

  // View Mode: Defaults to Table Grid View app-wide
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    const handleOrientationOrResize = () => {
      // Auto-adapt if user rotates phone from portrait to landscape
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape && window.innerWidth >= 640) {
        setViewMode('table');
      }
    };
    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
    };
  }, []);

  // Filter lines
  const filteredLines = useMemo(() => {
    return project.lines.filter((line) => {
      if (flagFilterOnly && !line.flag?.isFlagged) {
        return false;
      }

      if (selectedCharFilter !== 'all') {
        if (selectedCharFilter === 'unassigned' && line.characterId) {
          return false;
        }
        if (selectedCharFilter !== 'unassigned' && line.characterId !== selectedCharFilter) {
          return false;
        }
      }

      if (deferredSearchQuery.trim()) {
        const query = deferredSearchQuery.toLowerCase();
        const lineNumStr = String(line.lineNumber).padStart(6, '0');
        const textMatch = line.text.toLowerCase().includes(query);
        const timeMatch = line.startTime.includes(query) || line.endTime.includes(query);
        const lineNumMatch = lineNumStr.includes(query);
        const noteMatch = line.flag?.note?.toLowerCase().includes(query) || false;
        const codeMatch = line.flag?.code?.toLowerCase().includes(query) || false;

        const charMatch = characterSearchNames.get(line.characterId || '')?.includes(query) || false;

        if (!textMatch && !timeMatch && !lineNumMatch && !noteMatch && !codeMatch && !charMatch) {
          return false;
        }
      }

      return true;
    });
  }, [project.lines, flagFilterOnly, selectedCharFilter, deferredSearchQuery, characterSearchNames]);

  // Bulk apply character typography to existing lines
  const handleApplyCharacterStyleToLines = useCallback(
    (charId: string, style: { font: string; size: number; bold: boolean; italic: boolean }) => {
      const updatedLines = project.lines.map((l) => {
        if (l.characterId === charId) {
          return {
            ...l,
            font: style.font,
            size: style.size,
            bold: style.bold,
            italic: style.italic,
          };
        }
        return l;
      });
      reorderLines(updatedLines);
    },
    [project.lines, reorderLines]
  );

  // Single line update with cross-language line formatting sync
  const handleUpdateLine = useCallback(
    (line: SubtitleLine) => {
      updateLine(line);
      syncLineFormattingAcrossLanguages(project.title, [line]);
    },
    [project.title, updateLine]
  );

  // Bulk update multiple lines (e.g. from multi-select character assignment)
  const handleUpdateLines = useCallback(
    (updatedLines: SubtitleLine[]) => {
      const updatedMap = new Map(updatedLines.map((l) => [l.id, l]));
      const nextLines = project.lines.map((l) => updatedMap.get(l.id) || l);
      reorderLines(nextLines);
      syncLineFormattingAcrossLanguages(project.title, updatedLines);
    },
    [project.lines, project.title, reorderLines]
  );

  // Add new line at end
  const handleAddNewLine = useCallback(() => {
    const lastLine = project.lines[project.lines.length - 1];
    let nextStart = '00:00:01.000';
    let nextEnd = '00:00:03.500';

    if (lastLine) {
      const lastEndSec = timecodeToSeconds(lastLine.endTime);
      nextStart = secondsToTimecode(lastEndSec + 0.1);
      nextEnd = secondsToTimecode(lastEndSec + 2.6);
    }

    const newLine: SubtitleLine = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      lineNumber: project.lines.length + 1,
      startTime: nextStart,
      endTime: nextEnd,
      font: project.defaultSettings.font,
      size: project.defaultSettings.size,
      bold: project.defaultSettings.bold,
      italic: project.defaultSettings.italic,
      text: '',
    };

    addLine(newLine);
  }, [project.lines, project.defaultSettings, addLine]);

  // Save flag
  const handleSaveFlag = useCallback(
    (lineId: string, flag: FlagData | undefined) => {
      const line = project.lines.find((l) => l.id === lineId);
      if (line) {
        updateLine({
          ...line,
          flag,
        });
      }
    },
    [project.lines, updateLine]
  );

  // Import lines
  const handleImportLines = useCallback(
    (newLines: SubtitleLine[], mode: 'replace' | 'append', fileName?: string) => {
      let nextLines: SubtitleLine[];
      if (mode === 'replace') {
        const renumbered = newLines.map((l, i) => ({ ...l, lineNumber: i + 1 }));
        nextLines = renumbered;
      } else {
        const startNumber = project.lines.length;
        const renumberedNew = newLines.map((l, i) => ({ ...l, lineNumber: startNumber + i + 1 }));
        nextLines = [...project.lines, ...renumberedNew];
      }

      const nextTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : project.title;

      let detectedLang = project.language || 'en';
      if (fileName) {
        const langMatch = fileName.match(/\.([a-z]{2}(?:-[a-z]{2})?)\.(?:srt|vtt|sub|ass)$/i);
        if (langMatch) {
          detectedLang = langMatch[1].toLowerCase();
        }
      }

      const updatedProject: SubtitleProject = {
        ...project,
        lines: nextLines,
        language: detectedLang,
        title: mode === 'replace' && fileName ? nextTitle : project.title,
        updatedAt: Date.now(),
      };

      if (mode === 'replace') {
        replaceProject(updatedProject);
      } else {
        setProject(updatedProject);
        saveToLocalStorage(updatedProject);
      }

      // Save session for resume so reload always restores this file!
      saveSubtitleSession({
        fileName: fileName || `${nextTitle}.srt`,
        format: fileName?.split('.').pop() || 'srt',
        content: nextLines.map((l) => `${l.lineNumber}\n${l.startTime} --> ${l.endTime}\n${l.text}\n`).join('\n'),
        linesCount: nextLines.length,
      });

      // Save to organized media database
      const mediaClassification = inferMediaClassification(fileName || nextTitle);
      saveSubtitleToDatabase({
        id: `${mediaClassification.title.replace(/\s+/g, '_')}_${mediaClassification.season}_${mediaClassification.episode}_${mediaClassification.variant}_${project.language || 'en'}_${project.trackType || 'Normal'}`.toLowerCase(),
        medium: mediaClassification.medium,
        title: mediaClassification.title,
        season: mediaClassification.season,
        episode: mediaClassification.episode,
        variant: mediaClassification.variant,
        language: project.language || 'en',
        trackType: project.trackType || 'Normal',
        isPrimary: true,
        lines: nextLines,
        format: fileName?.split('.').pop() || 'srt',
        lastSavedAt: Date.now(),
        videoKey: activeVideoSource?.key,
        videoTitle: activeVideoSource?.title,
        sourceFileName: fileName || `${nextTitle}.srt`,
      });

      // Also associate with active video if present
      if (activeVideoSource && mode === 'replace') {
        associateSubtitleWithVideo({
          id: `${project.language || 'en'}_${project.trackType || 'Normal'}`,
          videoKey: activeVideoSource.key,
          videoTitle: activeVideoSource.title,
          name: nextTitle,
          language: project.language || 'en',
          trackType: project.trackType || 'Normal',
          lastSavedFileName: fileName || `${nextTitle}.srt`,
          lastSavedAt: Date.now(),
          linesCount: nextLines.length,
          lines: nextLines,
        });
        refreshAssociations(activeVideoSource.key, project.language || 'en', project.trackType || 'Normal');
      }
    },
    [project.lines, project.title, project.language, project.trackType, activeVideoSource, setProject, saveToLocalStorage, refreshAssociations]
  );

  // Automatically open the previous project on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // 1. Restore Video Session
        const idbVideo = await getVideoSession();
        const rawVideo = localStorage.getItem('subflow_last_video_source');
        let restoredVideo: VideoSourceInfo | null = null;
        let resumeTime = 0;

        if (idbVideo) {
          resumeTime = idbVideo.position || 0;
          if (idbVideo.sourceType === 'sample' && idbVideo.url) {
            restoredVideo = {
              key: idbVideo.videoKey || getVideoKey({ url: idbVideo.url, title: idbVideo.title }),
              title: idbVideo.title,
              url: idbVideo.url,
              sourceType: 'sample',
            };
          } else if ((idbVideo.sourceType === 'url' || idbVideo.sourceType === 'youtube') && idbVideo.url) {
            const ytId = extractYouTubeId(idbVideo.url);
            restoredVideo = {
              key: idbVideo.videoKey || getVideoKey({ url: idbVideo.url, title: idbVideo.title }),
              title: idbVideo.title,
              url: idbVideo.url,
              sourceType: ytId ? 'youtube' : 'url',
              youtubeId: ytId || undefined,
            };
          } else if (idbVideo.sourceType === 'local') {
            const vidFileRes = await loadLastVideoFile();
            if (vidFileRes.success && vidFileRes.file) {
              const url = URL.createObjectURL(vidFileRes.file);
              restoredVideo = {
                key: getVideoKey({ fileName: vidFileRes.file.name }),
                title: vidFileRes.file.name,
                url,
                sourceType: 'file',
                fileName: vidFileRes.file.name,
                file: vidFileRes.file,
                fileHandle: vidFileRes.session?.fileHandle,
              };
            } else {
              restoredVideo = {
                key: getVideoKey({ fileName: idbVideo.fileName || idbVideo.title }),
                title: idbVideo.title,
                url: '',
                sourceType: 'file',
                fileName: idbVideo.fileName,
              };
            }
          }
        } else if (rawVideo) {
          try {
            restoredVideo = JSON.parse(rawVideo);
          } catch {}
        }

        if (!restoredVideo && SAMPLE_VIDEOS.length > 0) {
          const defaultSample = SAMPLE_VIDEOS[0];
          restoredVideo = {
            key: getVideoKey({ url: defaultSample.url, title: defaultSample.name }),
            title: defaultSample.name,
            url: defaultSample.url,
            sourceType: 'sample',
          };
        }

        if (isMounted && restoredVideo) {
          setActiveVideoSource(restoredVideo);
          if (resumeTime > 0) {
            setCurrentTime(resumeTime);
          }
          await refreshAssociations(restoredVideo.key, project.language || 'en', project.trackType || 'Normal');
        } else if (isMounted) {
          await refreshAssociations(undefined, project.language || 'en', project.trackType || 'Normal');
        }

        // 2. Fast parallel restore (Zero-wait non-blocking hydration)
        const [serverProjRes, session] = await Promise.all([
          apiFetch('/api/project').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          getSubtitleSession().catch(() => null),
          syncDatabaseWithServer().catch(() => []),
        ]);
        let serverProj: SubtitleProject | null = serverProjRes;
        let restoredProject: SubtitleProject | null = serverProj;
        if (session && session.content && session.linesCount > 0) {
          const parsed = parseAnySubtitle(session.content, session.fileName);
          if (parsed.fullProject) {
            if (!restoredProject || (parsed.fullProject.updatedAt || 0) >= (restoredProject.updatedAt || 0)) {
              restoredProject = parsed.fullProject;
            }
          }
        }

        // PERMANENT FIX: Resolve target language and guarantee lines match THAT language!
        const targetLang = (restoredProject?.language || project.language || 'es').toLowerCase();
        const targetType = restoredProject?.trackType || project.trackType || 'Normal';
        const projectTitle = restoredProject?.title || project.title;
        const cleanTitle = cleanMediaTitle(projectTitle);

        // Find track in database for targetLang
        const matchingDbTrack =
          findTrackInDatabase(projectTitle, targetLang, targetType) ||
          findTrackInDatabase(cleanTitle, targetLang, targetType);

        if (matchingDbTrack && matchingDbTrack.lines && matchingDbTrack.lines.length > 0) {
          // Track for target language exists in database: GUARANTEE its lines are the ones displayed below!
          const targetTitle = `${cleanTitle} - ${getLanguageByCode(targetLang).name} (${targetType})`;
          // Apply any saved Title Formatting across all languages for this title!
          const formattedLines = applyTitleFormattingToLines(cleanTitle, matchingDbTrack.lines);
          const finalProj: SubtitleProject = {
            ...(restoredProject || project),
            language: targetLang,
            title: targetTitle,
            trackType: targetType,
            lines: formattedLines,
            updatedAt: Date.now(),
          };
          replaceProject(finalProj);
          if (isMounted) {
            setSubtitleResumeNotice(`Loaded "${targetTitle}" (${matchingDbTrack.lines.length} lines)`);
            setTimeout(() => {
              if (isMounted) setSubtitleResumeNotice(null);
            }, 3000);
          }
        } else if (restoredProject && restoredProject.lines && restoredProject.lines.length > 0) {
          replaceProject(restoredProject);
        }
      } catch (err) {
        console.warn('[AutoOpen] Failed to restore project:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Keep availableLanguages and trackTypes updated whenever language or trackType changes
  useEffect(() => {
    refreshAssociations(
      activeVideoSource?.key,
      project.language || 'en',
      project.trackType || 'Normal'
    );
  }, [project.language, project.trackType, activeVideoSource?.key, refreshAssociations]);

  // Open Subtitle Picker: Direct synchronous click provides instant native chooser without lag or gesture loss
  const handleOpenSubtitlePicker = useCallback(() => {
    subtitleFileInputRef.current?.click();
  }, []);

  const handleSubtitleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const content = await file.text();
      const parsed = parseAnySubtitle(content, file.name);
      if (parsed.fullProject) {
        replaceProject(parsed.fullProject);
      } else if (parsed.lines.length > 0) {
        handleImportLines(parsed.lines, 'replace', file.name);
        if (parsed.newCharacters && parsed.newCharacters.length > 0) {
          handleAddCharacters(parsed.newCharacters);
        }
      }
      await saveSubtitleSession({
        file,
        fileName: file.name,
        format: parsed.detectedFormat,
        content,
        linesCount: parsed.lines.length || parsed.fullProject?.lines?.length || 0,
      });
      setMissingSubtitleNotice(null);
      setSubtitleResumeNotice(`Loaded "${file.name}" successfully`);
      setTimeout(() => setSubtitleResumeNotice(null), 3500);
      e.target.value = '';
    },
    [replaceProject, handleImportLines, handleAddCharacters]
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] font-sans antialiased">
      {/* 1. Unified Sleek Top Bar (Row 1) */}
      <Header
        project={project}
        onUpdateTitle={updateTitle}
        onUpdateLanguage={handleUpdateLanguage}
        onRedoLanguage={handleRedoLanguage}
        onClearLanguage={handleClearLanguage}
        translationProgress={translationProgress}
        onUpdateTrackType={handleUpdateTrackType}
        isSaving={isSaving}
        isConnected={isConnected}
        lastSavedAt={lastSavedAt}
        currentUser={currentUser}
        collaborators={collaborators}
        isDark={isDark}
        currentTheme={currentTheme}
        availableThemes={availableThemesForMode}
        onToggleDarkMode={toggleDarkMode}
        onSelectTheme={selectTheme}
        onOpenUserModal={() => setIsUserLoginOpen(true)}
        onOpenSettingsModal={(tab) => {
          setSettingsTab(tab || 'series');
          setIsSettingsOpen(true);
        }}
        onSelectSeries={selectSeries}
        onOpenMediaDatabase={() => setIsMediaDatabaseOpen(true)}
        onOpenImportExportModal={handleOpenImportExport}
        isVideoOpen={isVideoOpen}
        isPipActive={isPipActive}
        onToggleVideo={handleToggleVideo}
        isAssociated={isCurrentSubtitleAssociated}
        isCurrentSubtitleMissing={isCurrentSubtitleMissing}
        onToggleAssociate={handleToggleAssociate}
        availableLanguages={availableLanguages}
        missingLanguages={missingLanguages}
        availableTrackTypes={availableTrackTypes}
        missingTrackTypes={missingTrackTypes}
        isVideoActive={!!activeVideoSource}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        flagFilterOnly={flagFilterOnly}
        onToggleFlagFilter={() => setFlagFilterOnly(!flagFilterOnly)}
        selectedCharFilter={selectedCharFilter}
        onCharFilterChange={setSelectedCharFilter}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((prev) => (prev === 'table' ? 'cards' : 'table'))}
        canUndo={canUndo}
        canRedo={canRedo}
        undoCount={undoCount}
        redoCount={redoCount}
        onUndo={undo}
        onRedo={redo}
      />

      {/* 2. Accordion Video Player Section (Accordions down between Row 1 and Row 2) */}
      <div
        className={`w-full overflow-hidden transition-all duration-300 ease-in-out border-b border-[var(--border)] shrink-0 bg-neutral-950 ${
          isVideoOpen ? 'max-h-[380px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none border-b-0'
        }`}
      >
        <VideoPlayerPreview
          lines={project.lines}
          characters={project.characters}
          defaultSettings={project.defaultSettings}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onClose={() => setIsVideoOpen(false)}
          isPipActive={isPipActive}
          onEnterPip={() => {
            setIsVideoOpen(false);
            setIsPipActive(true);
          }}
          onLeavePip={() => {
            setIsVideoOpen(true);
            setIsPipActive(false);
          }}
          videoRef={videoRef}
          currentUserId={currentUser.id}
          onVideoLoaded={handleVideoLoaded}
          activeVideoSource={activeVideoSource}
          onUpdateDefaults={updateDefaults}
          onActiveLineChange={setActivePlayingLineId}
          language={project.language || 'en'}
        />
      </div>

      {/* Missing Subtitle File Notice */}
      {missingSubtitleNotice && (
        <div className="mx-3 mt-1.5 bg-amber-950/90 border border-amber-500/50 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 animate-in fade-in shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              <span className="font-semibold text-white">Subtitle file not found at previous location: </span>
              {missingSubtitleNotice.reason}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleOpenSubtitlePicker}
              className="h-5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Locate the subtitle file on your computer"
            >
              <Upload className="w-2.5 h-2.5" />
              <span>Locate File</span>
            </button>
            <button
              type="button"
              onClick={() => setMissingSubtitleNotice(null)}
              className="h-5 w-5 rounded flex items-center justify-center text-amber-300 hover:text-white hover:bg-amber-900/60 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden Subtitle File Input */}
      <input
        ref={subtitleFileInputRef}
        type="file"
        accept=".srt,.ass,.ssa,.vtt,.sbv,.json,.csv,.tsv,.lrc,.txt,text/*"
        onChange={handleSubtitleFileInputChange}
        onClick={(e) => e.stopPropagation()}
        className="hidden"
        aria-hidden="true"
      />

      {/* 3. Subtitle View: Adaptive for Desktop, Tablet, and Mobile in Portrait & Landscape */}
      {viewMode === 'cards' ? (
        <MobileSubtitleCardView
          lines={filteredLines}
          characters={project.characters}
          defaultSettings={project.defaultSettings}
          collaborators={collaborators}
          currentUserId={currentUser.id}
          groups={project.groups || []}
          onToggleGroupCollapse={toggleGroupCollapse}
          onUpdateLine={handleUpdateLine}
          onAddLine={addLine}
          onDeleteLine={deleteLine}
          onOpenFlagModal={(line) => setFlagModalLine(line)}
          onLineFocus={setFocusedLine}
          activePlayingLineId={activePlayingLineId}
          onSeekToLine={handleSeekToLine}
          onAddCharacter={handleAddSingleCharacter}
        />
      ) : (
        <SubtitleTable
          lines={filteredLines}
          characters={project.characters}
          defaultSettings={project.defaultSettings}
          collaborators={collaborators}
          currentUserId={currentUser.id}
          onUpdateLine={handleUpdateLine}
          onUpdateLines={handleUpdateLines}
          onAddLine={addLine}
          onDeleteLine={deleteLine}
          onDeleteLines={deleteLines}
          onOpenFlagModal={(line) => setFlagModalLine(line)}
          onLineFocus={setFocusedLine}
          isVideoOpen={isVideoOpen}
          isPipActive={isPipActive}
          onToggleVideo={handleToggleVideo}
          activePlayingLineId={activePlayingLineId}
          onSeekToLine={handleSeekToLine}
          seriesId={project.seriesId}
          seriesList={project.seriesList}
          groups={project.groups || []}
          onCreateGroup={createGroup}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
          onToggleGroupCollapse={toggleGroupCollapse}
          onMoveLinesToGroup={moveLinesToGroup}
          onMoveGroup={moveGroup}
          onReorderProjectItems={reorderProjectItems}
          onAddCharacter={handleAddSingleCharacter}
          projectTitle={project.title}
          onSaveTitleFormatting={handleSaveTitleFormatting}
        />
      )}

      {/* Unified Settings Modal (Series, Characters, Typography Defaults, Language) */}
      <React.Suspense fallback={null}>
      <MountAfterFirstOpen open={isSettingsOpen}>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
        seriesList={project.seriesList || []}
        currentSeriesId={project.seriesId}
        characters={project.characters}
        defaultSettings={project.defaultSettings}
        lines={project.lines}
        currentLanguage={project.language}
        onSelectLanguage={handleUpdateLanguage}
        onSelectSeries={selectSeries}
        onSaveSeriesList={updateSeriesList}
        onSaveCharacters={updateCharacters}
        onSaveDefaults={(newDefaults) => {
          updateDefaults(newDefaults);
          if (project.title) {
            saveTitleFormatting(project.title, {
              font: newDefaults.font,
              size: newDefaults.size,
              bold: newDefaults.bold,
              italic: newDefaults.italic,
              underline: newDefaults.underline,
              strikethrough: newDefaults.strikethrough,
              superscript: newDefaults.superscript,
              subscript: newDefaults.subscript,
              color: newDefaults.color,
              shadow: newDefaults.shadow,
              outline: newDefaults.outline,
            });
          }
        }}
        onApplyStyleToLines={handleApplyCharacterStyleToLines}
      />
      </MountAfterFirstOpen>

      <MountAfterFirstOpen open={!!flagModalLine}>
      <FlagEditorModal
        isOpen={!!flagModalLine}
        line={flagModalLine}
        onClose={() => setFlagModalLine(null)}
        onSave={handleSaveFlag}
        currentUserName={currentUser.name}
      />
      </MountAfterFirstOpen>

      <MountAfterFirstOpen open={isUserLoginOpen}>
      <UserLoginModal
        isOpen={isUserLoginOpen}
        onClose={() => setIsUserLoginOpen(false)}
        currentUser={currentUser}
        onUpdateUser={setCurrentUser}
        collaborators={collaborators}
      />
      </MountAfterFirstOpen>

      <MountAfterFirstOpen open={isImportExportOpen}>
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        project={project}
        onImportLines={handleImportLines}
        onImportFullProject={replaceProject}
        onAddCharacters={handleAddCharacters}
        defaultTab={importExportTab}
      />
      </MountAfterFirstOpen>

      {/* Auto-Translate Modal */}
      {isAutoTranslateOpen && pendingTranslateData && (
        <AutoTranslateModal
          isOpen={isAutoTranslateOpen}
          onClose={() => {
            setIsAutoTranslateOpen(false);
            setPendingTranslateData(null);
          }}
          sourceLang={pendingTranslateData.sourceLang}
          targetLang={pendingTranslateData.targetLang}
          sourceType={pendingTranslateData.sourceType}
          targetType={pendingTranslateData.targetType}
          projectTitle={project.title}
          primaryLines={project.lines}
          linkedCcLines={
            activeVideoSource
              ? getAssociatedSubtitlesForVideo(activeVideoSource.key).find(
                  (t) => (t.trackType === 'CC' || t.trackType === 'SDH') && !t.isMissing
                )?.lines
              : undefined
          }
          onConfirmTranslate={handleConfirmTranslate}
          onStartBlank={() => {
            if (pendingTranslateData) {
              const currentMedia = inferMediaClassification(activeVideoSource?.title || project.title);
              const blankLines: SubtitleLine[] = [
                {
                  id: `line_${Date.now()}_1`,
                  lineNumber: 1,
                  startTime: '00:00:01,000',
                  endTime: '00:00:04,000',
                  text: '',
                },
              ];
              const updatedProject: SubtitleProject = {
                ...project,
                language: pendingTranslateData.targetLang,
                trackType: pendingTranslateData.targetType,
                title: `${currentMedia.title} - ${getLanguageByCode(pendingTranslateData.targetLang).name} (${pendingTranslateData.targetType})`,
                lines: blankLines,
                updatedAt: Date.now(),
              };
              replaceProject(updatedProject);
              if (activeVideoSource) {
                refreshAssociations(activeVideoSource.key, pendingTranslateData.targetLang, pendingTranslateData.targetType);
              }
              setSubtitleResumeNotice(`Started blank ${getLanguageByCode(pendingTranslateData.targetLang).name} subtitle track.`);
              setTimeout(() => setSubtitleResumeNotice(null), 3000);
            }
          }}
        />
      )}

      {/* Media Database Hierarchy Modal */}
      <MountAfterFirstOpen open={isMediaDatabaseOpen}>
      <MediaDatabaseModal
        isOpen={isMediaDatabaseOpen}
        onClose={() => setIsMediaDatabaseOpen(false)}
        onSelectTrack={handleSelectDatabaseTrack}
      />
      </MountAfterFirstOpen>
      </React.Suspense>
    </div>
  );
}
