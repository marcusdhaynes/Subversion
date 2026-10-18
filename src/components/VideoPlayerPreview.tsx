import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SubtitleLine, Character, DefaultProjectSettings } from '../types/subtitle';
import { timecodeToSeconds, secondsToTimecode } from '../utils/timecode';
import { exportToVTT } from '../utils/subtitleParser';
import { buildTextShadow } from './LightEffectsModal';
import { getLocalizedCharacterName } from '../utils/characterTranslator';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Film,
  X,
  PictureInPicture,
  Maximize,
  Minimize,
  ShieldAlert,
  FastForward,
  Rewind,
  SkipBack,
  SkipForward,
  Link,
  ChevronDown,
  History,
  Check,
  AlertCircle,
  Loader2,
  Sliders,
} from 'lucide-react';
import {
  saveVideoSession,
  getVideoSession,
  loadLastVideoFile,
  updateVideoPosition,
} from '../utils/fileResumeStorage';
import { VideoSourceInfo, getVideoKey, extractYouTubeId } from '../utils/videoSubtitleManager';

interface VideoPlayerPreviewProps {
  lines: SubtitleLine[];
  characters: Character[];
  defaultSettings: DefaultProjectSettings;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onClose: () => void;
  isPipActive: boolean;
  onEnterPip: () => void;
  onLeavePip: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentUserId?: string;
  onVideoLoaded?: (source: VideoSourceInfo) => void;
  activeVideoSource?: VideoSourceInfo | null;
  onUpdateDefaults?: (defaults: DefaultProjectSettings) => void;
  onActiveLineChange?: (lineId: string | null) => void;
  language?: string;
}

export interface SavedPlaybackSession {
  title: string;
  sourceType: 'sample' | 'url' | 'local';
  url?: string;
  fileName?: string;
  fileSize?: number;
  position: number;
  duration?: number;
  updatedAt: number;
}

const GLOBAL_PLAYBACK_KEY = 'subflow_last_playback_session';
const getUserPlaybackKey = (uid?: string) => uid ? `subflow_playback_${uid}` : GLOBAL_PLAYBACK_KEY;

export const SAMPLE_VIDEOS = [
  {
    name: 'Tears of Steel (Sci-Fi)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    name: 'Big Buck Bunny (Animation)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    name: 'Sintel (Fantasy CGI)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    name: 'Elephants Dream (Demo)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
];

export const VideoPlayerPreview: React.FC<VideoPlayerPreviewProps> = ({
  lines,
  characters,
  defaultSettings,
  currentTime,
  onTimeUpdate,
  isPlaying,
  setIsPlaying,
  onClose,
  isPipActive,
  onEnterPip,
  onLeavePip,
  videoRef,
  currentUserId,
  onVideoLoaded,
  activeVideoSource,
  onUpdateDefaults,
  onActiveLineChange,
  language = 'en',
}) => {
  const [duration, setDuration] = useState(60);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoSrc, setVideoSrc] = useState<string>(activeVideoSource?.url || SAMPLE_VIDEOS[0].url);
  const [videoTitle, setVideoTitle] = useState<string>(activeVideoSource?.title || SAMPLE_VIDEOS[0].name);
  const [sourceType, setSourceType] = useState<'sample' | 'url' | 'local'>(
    activeVideoSource?.sourceType === 'file' ? 'local' : activeVideoSource?.sourceType === 'sample' ? 'sample' : 'url'
  );
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [timelineHoverTime, setTimelineHoverTime] = useState<number | null>(null);
  const [timelineHoverPos, setTimelineHoverPos] = useState<number>(0);

  // Fullscreen & Controls state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isSkipMenuOpen, setIsSkipMenuOpen] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Direct DOM Scrubber & Timecode references for zero-lag 60fps responsiveness
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const scrubberHeadRef = useRef<HTMLDivElement | null>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const lastActiveLineIdRef = useRef<string | null>(null);
  const [activeLine, setActiveLine] = useState<SubtitleLine | null>(null);
  const [preloadedNextLine, setPreloadedNextLine] = useState<SubtitleLine | null>(null);
  const [deLoadingLine, setDeLoadingLine] = useState<SubtitleLine | null>(null);
  const deLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Resume prompt state
  const [pendingResume, setPendingResume] = useState<SavedPlaybackSession | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [missingFileNotice, setMissingFileNotice] = useState<{
    fileName: string;
    reason: string;
    savedPosition: number;
  } | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trackRef = useRef<HTMLTrackElement | null>(null);
  const lastSavedPositionRef = useRef<number>(0);

  // Sync with activeVideoSource if updated externally
  useEffect(() => {
    if (activeVideoSource && activeVideoSource.url && activeVideoSource.url !== videoSrc) {
      setVideoSrc(activeVideoSource.url);
      setVideoTitle(activeVideoSource.title);
      setSourceType(activeVideoSource.sourceType === 'file' ? 'local' : activeVideoSource.sourceType === 'sample' ? 'sample' : 'url');
    }
  }, [activeVideoSource]);

  // Check and automatically resume last video on mount
  useEffect(() => {
    let isMounted = true;
    async function checkResume() {
      try {
        const idbSession = await getVideoSession();
        if (idbSession && isMounted) {
          const pos = idbSession.position || 0;
          if (idbSession.sourceType === 'sample' && idbSession.url) {
            setVideoSrc(idbSession.url);
            setVideoTitle(idbSession.title);
            setSourceType('sample');
            if (pos > 0 && videoRef.current) {
              videoRef.current.currentTime = pos;
              onTimeUpdate(pos);
            }
            onVideoLoaded?.({
              key: idbSession.videoKey || getVideoKey({ url: idbSession.url, title: idbSession.title }),
              title: idbSession.title,
              url: idbSession.url,
              sourceType: 'sample',
            });
            return;
          } else if ((idbSession.sourceType === 'url' || idbSession.sourceType === 'youtube') && idbSession.url) {
            const ytId = extractYouTubeId(idbSession.url);
            setVideoSrc(idbSession.url);
            setVideoTitle(idbSession.title);
            setSourceType('url');
            if (pos > 0 && videoRef.current) {
              videoRef.current.currentTime = pos;
              onTimeUpdate(pos);
            }
            onVideoLoaded?.({
              key: idbSession.videoKey || getVideoKey({ url: idbSession.url, title: idbSession.title }),
              title: idbSession.title,
              url: idbSession.url,
              sourceType: ytId ? 'youtube' : 'url',
              youtubeId: ytId || undefined,
            });
            return;
          } else if (idbSession.sourceType === 'local') {
            const res = await loadLastVideoFile();
            if (res.success && res.file) {
              const url = URL.createObjectURL(res.file);
              setVideoSrc(url);
              setVideoTitle(res.file.name);
              setSourceType('local');
              if (pos > 0 && videoRef.current) {
                videoRef.current.currentTime = pos;
                onTimeUpdate(pos);
              }
              onVideoLoaded?.({
                key: getVideoKey({ fileName: res.file.name }),
                title: res.file.name,
                url,
                sourceType: 'file',
                fileName: res.file.name,
                file: res.file,
                fileHandle: res.session?.fileHandle,
              });
              return;
            } else {
              // Local file info registered for subtitle associations
              onVideoLoaded?.({
                key: getVideoKey({ fileName: idbSession.fileName || idbSession.title }),
                title: idbSession.title || idbSession.fileName || 'Video',
                url: '',
                sourceType: 'file',
                fileName: idbSession.fileName,
              });
              return;
            }
          }
        }

        // If no saved video session, register the default sample video with onVideoLoaded
        if (isMounted) {
          const sample = SAMPLE_VIDEOS[0];
          onVideoLoaded?.({
            key: getVideoKey({ url: sample.url, title: sample.name }),
            title: sample.name,
            url: sample.url,
            sourceType: 'sample',
          });
        }
      } catch (err) {
        console.warn('[VideoPreview] checkResume failed:', err);
      }
    }
    checkResume();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist playback session locally and on account
  const savePlayback = useCallback(
    (time: number, titleToSave = videoTitle, srcType = sourceType, srcUrl = videoSrc) => {
      if (time <= 1) return;
      if (Math.abs(time - lastSavedPositionRef.current) < 1) return;
      lastSavedPositionRef.current = time;

      const session: SavedPlaybackSession = {
        title: titleToSave,
        sourceType: srcType,
        url: srcType !== 'local' ? srcUrl : undefined,
        fileName: srcType === 'local' ? titleToSave : undefined,
        position: Math.round(time * 10) / 10,
        duration,
        updatedAt: Date.now(),
      };

      try {
        localStorage.setItem(GLOBAL_PLAYBACK_KEY, JSON.stringify(session));
        if (currentUserId) {
          localStorage.setItem(getUserPlaybackKey(currentUserId), JSON.stringify(session));
        }
      } catch {
        // quota
      }
    },
    [videoTitle, sourceType, videoSrc, duration, currentUserId]
  );

  // Generate WebVTT blob for native tracks (e.g. inside browser native PiP)
  const vttTrackUrl = useMemo(() => {
    try {
      const vtt = exportToVTT(lines);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }, [lines]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (vttTrackUrl) {
        URL.revokeObjectURL(vttTrackUrl);
      }
    };
  }, [vttTrackUrl]);

  // Pre-calculated numeric intervals for ultra-fast matching (0ms latency, zero string allocations)
  const timedLines = useMemo(() => {
    return lines
      .map((l) => ({
        line: l,
        startSec: timecodeToSeconds(l.startTime),
        endSec: timecodeToSeconds(l.endTime),
      }))
      .sort((a, b) => a.startSec - b.startSec);
  }, [lines]);

  // Pre-calculated timeline cue markers (calculated ONCE when lines or duration changes)
  const timelineMarkers = useMemo(() => {
    if (duration <= 0 || lines.length === 0) return null;
    return lines.map((l) => {
      const startSec = timecodeToSeconds(l.startTime);
      const leftPercent = Math.min(100, Math.max(0, (startSec / duration) * 100));
      const isFlagged = l.flag?.isFlagged;
      return (
        <div
          key={l.id}
          className="absolute top-1 w-[2px] h-2.5 rounded-full pointer-events-none"
          style={{
            left: `${leftPercent}%`,
            backgroundColor: isFlagged ? '#ef4444' : '#38bdf8',
            opacity: isFlagged ? 0.95 : 0.45,
          }}
          title={`Line ${l.lineNumber}: ${l.text}`}
        />
      );
    });
  }, [lines, duration]);

  // Frame-Exact Subtitle Activation: Subtitle line is visible IF AND ONLY IF startSec <= time <= endSec
  // De-loads IMMEDIATELY when video clock reaches endSec; displays IMMEDIATELY when startSec arrives
  const findActiveLineAtTime = useCallback(
    (time: number): SubtitleLine | null => {
      if (timedLines.length === 0) return null;
      let low = 0;
      let high = timedLines.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const item = timedLines[mid];
        if (time < item.startSec) {
          high = mid - 1;
        } else if (time > item.endSec) {
          low = mid + 1;
        } else {
          return item.line;
        }
      }
      return null;
    },
    [timedLines]
  );

  // Fullscreen change & user activity listeners
  useEffect(() => {
    const handleFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        setIsControlsVisible(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleUserActivity = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (document.fullscreenElement && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying]);

  const lastEmittedTimeRef = useRef<number>(-1);

  // Hardware-accelerated direct DOM updater for timeline indicators (0ms delay, 0 React re-renders)
  const updateDomTimeline = useCallback(
    (time: number) => {
      if (progressBarRef.current && duration > 0) {
        progressBarRef.current.style.width = `${Math.min(100, Math.max(0, (time / duration) * 100))}%`;
      }
      if (scrubberHeadRef.current && duration > 0) {
        scrubberHeadRef.current.style.left = `${Math.min(100, Math.max(0, (time / duration) * 100))}%`;
      }
      if (currentTimeTextRef.current) {
        currentTimeTextRef.current.textContent = secondsToTimecode(time);
      }
    },
    [duration]
  );

  // User-initiated seek handler (timeline clicks, skip, prev/next line)
  const applyUserSeek = useCallback(
    (targetTime: number) => {
      const clampedTime = Math.max(0, Math.min(duration || 0, targetTime));
      if (videoRef.current) {
        videoRef.current.currentTime = clampedTime;
      }
      updateDomTimeline(clampedTime);
      const foundLine = findActiveLineAtTime(clampedTime);
      lastActiveLineIdRef.current = foundLine?.id ?? null;
      setActiveLine(foundLine);
      onActiveLineChange?.(foundLine?.id ?? null);
      lastEmittedTimeRef.current = clampedTime;
      onTimeUpdate(clampedTime);
      savePlayback(clampedTime);
    },
    [duration, findActiveLineAtTime, onActiveLineChange, onTimeUpdate, savePlayback, updateDomTimeline]
  );

  // Sync external currentTime changes (e.g. user explicitly clicked a table row to seek, or restored project)
  // When video is actively playing, video hardware is master clock; NEVER touch video.currentTime from React state ripples
  useEffect(() => {
    if (isPlaying) {
      // While actively playing, video element is self-clocked. Never seek videoRef from state updates.
      return;
    }
    if (Math.abs(currentTime - lastEmittedTimeRef.current) < 0.1) {
      return;
    }
    lastEmittedTimeRef.current = currentTime;
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.15) {
      videoRef.current.currentTime = currentTime;
    }
    updateDomTimeline(currentTime);
    const foundLine = findActiveLineAtTime(currentTime);
    if (foundLine?.id !== lastActiveLineIdRef.current) {
      lastActiveLineIdRef.current = foundLine?.id ?? null;
      setActiveLine(foundLine);
      onActiveLineChange?.(foundLine?.id ?? null);
    }
  }, [currentTime, isPlaying, findActiveLineAtTime, onActiveLineChange, updateDomTimeline]);

  // RequestAnimationFrame loop locked to video refresh rate with zero React re-renders during line playback
  useEffect(() => {
    let animId: number;
    let lastThrottledSave = 0;

    const tick = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const cur = videoRef.current.currentTime;

        // 1. Direct hardware-accelerated DOM update for progress bar and time text
        updateDomTimeline(cur);

        // 2. Frame-accurate active subtitle lookup directly on video clock
        const newLine = findActiveLineAtTime(cur);

        if (newLine?.id !== lastActiveLineIdRef.current) {
          lastActiveLineIdRef.current = newLine?.id ?? null;
          setActiveLine(newLine);
          onActiveLineChange?.(newLine?.id ?? null);
          lastEmittedTimeRef.current = cur;
        }

        // 4. Throttled save playback position every 3 seconds
        const now = performance.now();
        if (now - lastThrottledSave > 3000) {
          lastThrottledSave = now;
          savePlayback(cur);
        }
      }
      if (isPlaying) {
        animId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(tick);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, findActiveLineAtTime, onActiveLineChange, onTimeUpdate, savePlayback, updateDomTimeline, videoRef]);

  // Always use the real-time activeLine tracked directly from the video player clock
  const primaryActiveLine = isPlaying
    ? activeLine
    : activeLine || (videoRef.current ? findActiveLineAtTime(videoRef.current.currentTime) : findActiveLineAtTime(currentTime));

  const activeCharacter = primaryActiveLine?.characterId
    ? characters.find((c) => c.id === primaryActiveLine.characterId)
    : null;

  // Listen to native Picture-in-Picture events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPip = () => {
      onEnterPip();
    };

    const handleLeavePip = () => {
      onLeavePip();
    };

    video.addEventListener('enterpictureinpicture', handleEnterPip);
    video.addEventListener('leavepictureinpicture', handleLeavePip);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPip);
      video.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, [videoRef, onEnterPip, onLeavePip]);

  // Synchronize playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, videoRef]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      const cur = videoRef.current.currentTime;
      lastEmittedTimeRef.current = cur;
      onTimeUpdate(cur);
      savePlayback(cur);
    }
  }, [onTimeUpdate, savePlayback, setIsPlaying, videoRef]);

  // Native video time update handler for video time updates, paused scrubbing, or native PiP
  const handleNativeTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    updateDomTimeline(cur);
    const newLine = findActiveLineAtTime(cur);
    if (newLine?.id !== lastActiveLineIdRef.current) {
      lastActiveLineIdRef.current = newLine?.id ?? null;
      setActiveLine(newLine);
      onActiveLineChange?.(newLine?.id ?? null);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      if (!isNaN(d) && d > 0) {
        setDuration(d);
        updateDomTimeline(videoRef.current.currentTime);
      }
    }
  };

  // Seek on timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    applyUserSeek(targetTime);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setTimelineHoverTime(ratio * duration);
    setTimelineHoverPos(e.clientX - rect.left);
  };

  const handleTimelineMouseLeave = () => {
    setTimelineHoverTime(null);
  };

  // Skip relative seconds
  const handleSkip = useCallback(
    (seconds: number) => {
      if (!videoRef.current) return;
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      applyUserSeek(newTime);
    },
    [duration, applyUserSeek, videoRef]
  );

  // Previous Line control
  const handlePreviousLine = useCallback(() => {
    if (!videoRef.current || timedLines.length === 0) return;
    const cur = videoRef.current.currentTime;
    let targetTime = 0;
    let activeIdx = -1;
    for (let i = 0; i < timedLines.length; i++) {
      if (cur >= timedLines[i].startSec && cur <= timedLines[i].endSec) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx !== -1) {
      if (cur - timedLines[activeIdx].startSec > 0.4) {
        targetTime = timedLines[activeIdx].startSec;
      } else if (activeIdx > 0) {
        targetTime = timedLines[activeIdx - 1].startSec;
      } else {
        targetTime = 0;
      }
    } else {
      let lastBefore = -1;
      for (let i = timedLines.length - 1; i >= 0; i--) {
        if (timedLines[i].startSec < cur) {
          lastBefore = i;
          break;
        }
      }
      if (lastBefore !== -1) {
        targetTime = timedLines[lastBefore].startSec;
      } else {
        targetTime = 0;
      }
    }
    applyUserSeek(targetTime);
  }, [timedLines, applyUserSeek, videoRef]);

  // Next Line control
  const handleNextLine = useCallback(() => {
    if (!videoRef.current || timedLines.length === 0) return;
    const cur = videoRef.current.currentTime;
    const nextItem = timedLines.find((item) => item.startSec > cur + 0.05);
    if (nextItem) {
      applyUserSeek(nextItem.startSec);
    }
  }, [timedLines, applyUserSeek, videoRef]);

  const rewindSeconds = defaultSettings.rewindSeconds ?? 10;
  const fastForwardSeconds = defaultSettings.fastForwardSeconds ?? 10;

  const handleRewind = useCallback(() => {
    handleSkip(-rewindSeconds);
  }, [handleSkip, rewindSeconds]);

  const handleFastForward = useCallback(() => {
    handleSkip(fastForwardSeconds);
  }, [handleSkip, fastForwardSeconds]);

  // Fullscreen toggle with cross-browser support
  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleRewind();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleFastForward();
      } else if (e.key === '[' || e.key === 'k') {
        e.preventDefault();
        handlePreviousLine();
      } else if (e.key === ']' || e.key === 'l') {
        e.preventDefault();
        handleNextLine();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleRewind, handleFastForward, handlePreviousLine, handleNextLine, handleFullscreen]);

  // Picture-in-Picture Toggle
  const handleTogglePip = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP request failed:', err);
    }
  };

  // Load video from file with session persistence
  const loadVideoFromFile = async (file: File, handle?: FileSystemFileHandle) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoTitle(file.name);
    setSourceType('local');
    setMissingFileNotice(null);

    // Persist to IndexedDB with FileSystemFileHandle so it can be resumed directly from last location
    await saveVideoSession({
      file,
      fileHandle: handle,
      title: file.name,
      sourceType: 'local',
      position: 0,
      duration: duration || 60,
    });

    onVideoLoaded?.({
      key: getVideoKey({ fileName: file.name }),
      title: file.name,
      url,
      sourceType: 'file',
      fileName: file.name,
      file,
      fileHandle: handle,
    });

    // Check if we have a saved resume position for this exact file
    const userKey = getUserPlaybackKey(currentUserId);
    const rawUser = localStorage.getItem(userKey);
    const rawGlobal = localStorage.getItem(GLOBAL_PLAYBACK_KEY);
    const raw = rawUser || rawGlobal;
    let resumeTime = 0;
    if (raw) {
      try {
        const session: SavedPlaybackSession = JSON.parse(raw);
        if (session && (session.fileName === file.name || session.title === file.name)) {
          resumeTime = session.position;
        }
      } catch {}
    }

    if (missingFileNotice?.savedPosition) {
      resumeTime = missingFileNotice.savedPosition;
    }

    if (videoRef.current) {
      videoRef.current.load();
      if (resumeTime > 1) {
        videoRef.current.currentTime = resumeTime;
        onTimeUpdate(resumeTime);
        setResumeNotice(`Resumed "${file.name}" at ${secondsToTimecode(resumeTime)}`);
        setTimeout(() => setResumeNotice(null), 3500);
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    setPendingResume(null);
  };

  // Open native system file picker with FileSystemFileHandle support
  const handleOpenVideoPicker = async () => {
    if (typeof window !== 'undefined' && window.self === window.top && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Video & Audio Files',
              accept: {
                'video/*': ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v'],
                'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
              },
            },
          ],
        });
        const file = await handle.getFile();
        await loadVideoFromFile(file, handle);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled
      }
    }
    fileInputRef.current?.click();
  };

  // File Upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadVideoFromFile(file);
    }
    e.target.value = '';
  };

  // Resume playback from last file and location
  const handleResumePlayback = async () => {
    if (!pendingResume) return;

    if (pendingResume.sourceType === 'local') {
      setIsResuming(true);
      try {
        // 1. Attempt to already load the last file from its last location
        const result = await loadLastVideoFile();
        if (result.success) {
          const file = result.file;
          const url = URL.createObjectURL(file);
          setVideoSrc(url);
          setVideoTitle(file.name);
          setSourceType('local');
          setMissingFileNotice(null);

          if (videoRef.current) {
            videoRef.current.load();
            videoRef.current.currentTime = pendingResume.position;
            onTimeUpdate(pendingResume.position);
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
          setPendingResume(null);
          setResumeNotice(
            `Resumed "${file.name}" at ${secondsToTimecode(pendingResume.position)} directly from last location`
          );
          setTimeout(() => setResumeNotice(null), 4000);
          return;
        } else {
          // 2. If it is not there for whatever reason, inform them and let them locate/select it in the window like it does now!
          setMissingFileNotice({
            fileName: pendingResume.title,
            reason: result.reason,
            savedPosition: pendingResume.position,
          });
          // Automatically open the file window so they can locate it
          await handleOpenVideoPicker();
        }
      } catch (err: any) {
        setMissingFileNotice({
          fileName: pendingResume.title,
          reason: 'Could not access file from disk: ' + (err?.message || 'Access error'),
          savedPosition: pendingResume.position,
        });
        await handleOpenVideoPicker();
      } finally {
        setIsResuming(false);
      }
    } else if (pendingResume.url) {
      setVideoSrc(pendingResume.url);
      setVideoTitle(pendingResume.title);
      setSourceType(pendingResume.sourceType);
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.currentTime = pendingResume.position;
        onTimeUpdate(pendingResume.position);
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      setPendingResume(null);
      setResumeNotice(`Resumed "${pendingResume.title}" at ${secondsToTimecode(pendingResume.position)}`);
      setTimeout(() => setResumeNotice(null), 3500);
    }
  };

  // Custom URL Load
  const handleLoadCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      const newUrl = urlInput.trim();
      const ytId = extractYouTubeId(newUrl);
      const title = ytId ? `YouTube Video (${ytId})` : 'Custom Media URL';
      const key = getVideoKey({ url: newUrl, title });
      setVideoSrc(newUrl);
      setVideoTitle(title);
      setSourceType('url');
      setIsUrlModalOpen(false);
      setPendingResume(null);
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      saveVideoSession({
        title,
        sourceType: ytId ? 'youtube' : 'url',
        url: newUrl,
        position: 0,
        duration: duration || 60,
        videoKey: key,
      });
      onVideoLoaded?.({
        key,
        title,
        url: newUrl,
        sourceType: ytId ? 'youtube' : 'url',
        youtubeId: ytId || undefined,
      });
    }
  };

  // Change sample video
  const handleSelectSample = (sample: { name: string; url: string }) => {
    const key = getVideoKey({ url: sample.url, title: sample.name });
    setVideoSrc(sample.url);
    setVideoTitle(sample.name);
    setSourceType('sample');
    setPendingResume(null);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    saveVideoSession({
      title: sample.name,
      sourceType: 'sample',
      url: sample.url,
      position: 0,
      duration: duration || 60,
      videoKey: key,
    });
    onVideoLoaded?.({
      key,
      title: sample.name,
      url: sample.url,
      sourceType: 'sample',
    });
  };

  // Volume & Mute
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  // Active subtitle typography
  const effectiveFont =
    primaryActiveLine?.font || activeCharacter?.font || defaultSettings.font || 'Inter';
  const rawSize =
    primaryActiveLine?.size || activeCharacter?.size || defaultSettings.size || 18;
  const effectiveSize = Math.max(14, Math.min(rawSize, 28));
  const isBold =
    primaryActiveLine?.bold !== undefined
      ? primaryActiveLine.bold
      : (activeCharacter?.bold ?? defaultSettings.bold);
  const isItalic =
    primaryActiveLine?.italic !== undefined
      ? primaryActiveLine.italic
      : (activeCharacter?.italic ?? defaultSettings.italic);
  const charColor = activeCharacter?.color || '#3b82f6';
  const effectiveTextColor = primaryActiveLine?.color || '#ffffff';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      className={`w-full bg-neutral-950 text-neutral-100 flex flex-col select-none relative ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen max-w-none max-h-none overflow-hidden bg-black'
          : 'min-h-[260px]'
      }`}
    >
      {/* Top Bar inside Accordion: Video Title, Source Switcher, Controls */}
      <div className="h-7.5 px-3 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-[11px] text-neutral-200 truncate">
            {videoTitle}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 shrink-0 hidden sm:inline">
            {lines.length} cues
          </span>
          {isPipActive && (
            <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
              <PictureInPicture className="w-2.5 h-2.5" />
              <span>PiP Active</span>
            </span>
          )}
        </div>

        {/* Top Actions: Load File, Load URL, Close */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Load Local File */}
          <button
            type="button"
            onClick={handleOpenVideoPicker}
            className="h-5.5 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
            title="Upload or locate any local video file (MP4, WebM, MKV, MOV, AVI, etc.)"
          >
            <Upload className="w-2.5 h-2.5 text-blue-400" />
            <span className="hidden sm:inline">Load Video</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Custom URL Input Button */}
          <button
            type="button"
            onClick={() => setIsUrlModalOpen(!isUrlModalOpen)}
            className="h-5.5 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
            title="Paste online video URL"
          >
            <Link className="w-2.5 h-2.5 text-neutral-400" />
            <span className="hidden md:inline">URL</span>
          </button>

          <span className="text-neutral-700 mx-0.5">|</span>

          {/* Pop-Out Picture-in-Picture Button */}
          <button
            type="button"
            onClick={handleTogglePip}
            className="h-5.5 px-2 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 border border-blue-500/30 text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
            title="Pop-out Picture-in-Picture (collapses this section; restores when PiP closes)"
          >
            <PictureInPicture className="w-3 h-3 text-blue-400" />
            <span className="hidden xs:inline">Pop-Out (PiP)</span>
          </button>

          {/* Close Accordion */}
          <button
            type="button"
            onClick={onClose}
            className="h-5.5 w-5.5 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer ml-0.5"
            title="Collapse video player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Missing File Informative Notice */}
      {missingFileNotice && (
        <div className="bg-amber-950/90 border-b border-amber-500/50 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              <span className="font-semibold text-white">File not found at previous location: </span>
              {missingFileNotice.reason}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleOpenVideoPicker}
              className="h-5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Locate the video file on your computer"
            >
              <Upload className="w-2.5 h-2.5" />
              <span>Locate File</span>
            </button>
            <button
              type="button"
              onClick={() => setMissingFileNotice(null)}
              className="h-5 px-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white text-[10px] cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Temporary Resume Feedback Notice */}
      {resumeNotice && (
        <div className="bg-emerald-950/85 border-b border-emerald-500/40 px-3 py-1 flex items-center gap-1.5 text-[10.5px] text-emerald-300 font-mono animate-in fade-in">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>{resumeNotice}</span>
        </div>
      )}

      {/* URL Popover Modal */}
      {isUrlModalOpen && (
        <form
          onSubmit={handleLoadCustomUrl}
          className="px-3 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2 animate-in fade-in slide-in-from-top-1"
        >
          <input
            type="url"
            autoFocus
            placeholder="Paste direct video URL (e.g. https://.../video.mp4)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 h-6.5 px-2 text-xs bg-neutral-950 border border-neutral-700 rounded text-neutral-200 outline-hidden focus:border-blue-500 font-mono"
          />
          <button
            type="submit"
            className="h-6.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            Load
          </button>
          <button
            type="button"
            onClick={() => setIsUrlModalOpen(false)}
            className="h-6.5 px-2 text-neutral-400 hover:text-neutral-200 text-xs"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Main Video Screen with Live Subtitles Overlay */}
      <div
        className={`relative flex-1 flex items-center justify-center bg-black overflow-hidden group ${
          isFullscreen ? 'w-full h-full min-h-0 max-h-none' : 'min-h-[170px] max-h-[220px]'
        }`}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          onTimeUpdate={handleNativeTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          muted={isMuted}
          playsInline
          className={`w-full h-full object-contain cursor-pointer ${
            isFullscreen ? 'max-h-none' : 'max-h-[220px]'
          }`}
          onClick={togglePlay}
          onDoubleClick={handleFullscreen}
        >
          {vttTrackUrl && (
            <track
              ref={trackRef}
              kind="subtitles"
              label="Synchronized Subtitles"
              src={vttTrackUrl}
            />
          )}
        </video>

        {/* Real-time Exact Subtitle Display Overlay (De-loads precisely at endTime, loads precisely at startTime) */}
        {primaryActiveLine && (
          <div
            className={`absolute inset-x-4 ${
              isFullscreen ? 'bottom-20 z-30' : 'bottom-3 z-20'
            } flex flex-col items-center pointer-events-none`}
            style={{ willChange: 'contents' }}
          >
            {/* Flagged Status Banner */}
            {primaryActiveLine.flag?.isFlagged && (
              <div
                className={`mb-1.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-red-600/95 text-white ${
                  isFullscreen ? 'text-xs' : 'text-[10px]'
                } font-mono font-bold shadow-lg border border-red-400/50`}
              >
                <ShieldAlert className={`${isFullscreen ? 'w-4 h-4' : 'w-3 h-3'} text-white`} />
                <span>
                  FLAGGED: {primaryActiveLine.flag.code || 'REVIEW'}
                  {primaryActiveLine.flag.note ? ` — ${primaryActiveLine.flag.note}` : ''}
                </span>
              </div>
            )}

            {/* Subtitle Dialogue Container */}
            <div
              className={`px-4 py-1.5 rounded-lg max-w-[92%] text-center ${
                isFullscreen
                  ? 'bg-black/85 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.85)] border border-white/10'
                  : primaryActiveLine.flag?.isFlagged
                  ? 'bg-red-950/85 border border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.45)]'
                  : 'bg-black/75 shadow-2xl backdrop-blur-[2px]'
              }`}
            >
              {/* Speaker Pill (Localized in the selected language) */}
              {activeCharacter && (
                <span
                  className={`font-bold mr-2 uppercase tracking-wide ${
                    isFullscreen ? 'text-sm' : 'text-[11px]'
                  } inline-block px-1.5 py-0.5 rounded-sm`}
                  style={{
                    color: charColor,
                    backgroundColor: `${charColor}20`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {getLocalizedCharacterName(activeCharacter.name, language)}:
                </span>
              )}

              {/* Subtitle Text with exact typography & Bidirectional RTL Arabic support */}
              {(() => {
                const isRTLText = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿֐-׿]/.test(primaryActiveLine.text);
                return (
                  <span
                    dir="auto"
                    className="select-none inline leading-snug"
                    style={{
                      direction: isRTLText ? 'rtl' : 'ltr',
                      unicodeBidi: 'plaintext',
                      textAlign: isRTLText ? 'right' : 'center',
                      color: effectiveTextColor,
                      fontFamily: effectiveFont,
                      fontSize: isFullscreen
                        ? `${Math.max(effectiveSize * 1.5, 26)}px`
                        : `${effectiveSize}px`,
                      fontWeight: isBold ? 'bold' : 'normal',
                      fontStyle: isItalic ? 'italic' : 'normal',
                      textDecoration:
                        primaryActiveLine.underline && primaryActiveLine.strikethrough
                          ? 'underline line-through'
                          : primaryActiveLine.underline
                          ? 'underline'
                          : primaryActiveLine.strikethrough
                          ? 'line-through'
                          : 'none',
                      verticalAlign: primaryActiveLine.superscript
                        ? 'super'
                        : primaryActiveLine.subscript
                        ? 'sub'
                        : 'baseline',
                      lineHeight: 1.35,
                      textShadow:
                        buildTextShadow(primaryActiveLine.shadow, primaryActiveLine.outline) ||
                        '0 2px 4px rgba(0,0,0,0.98), 0 0 8px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                    }}
                  >
                    {primaryActiveLine.text}
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Scrubber Timeline with Subtitle Cue Markers */}
      <div
        className={`relative h-4.5 bg-neutral-900 border-t border-neutral-800 cursor-pointer select-none group/timeline ${
          isFullscreen && !isControlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } transition-opacity duration-300`}
        onClick={handleTimelineClick}
        onMouseMove={handleTimelineMouseMove}
        onMouseLeave={handleTimelineMouseLeave}
        title="Click to seek on timeline"
      >
        {/* Background Track */}
        <div className="absolute inset-x-0 top-1.5 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          {/* Played Progress Bar */}
          <div
            ref={progressBarRef}
            className="h-full bg-blue-500 relative"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Subtitle Cue Markers along Timeline (memoized for instant performance) */}
        {timelineMarkers}

        {/* Current Scrubber Head */}
        <div
          ref={scrubberHeadRef}
          className="absolute top-0.5 w-3.5 h-3.5 -ml-1.5 rounded-full bg-white shadow-md border-2 border-blue-500 pointer-events-none transition-transform group-hover/timeline:scale-110"
          style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />

        {/* Hover Time Preview Tooltip */}
        {timelineHoverTime !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[10px] font-mono text-neutral-200 pointer-events-none shadow-lg z-30"
            style={{ left: `${timelineHoverPos}px` }}
          >
            {secondsToTimecode(timelineHoverTime)}
          </div>
        )}
      </div>

      {/* Bottom Media Controls Bar */}
      <div
        className={`h-9 px-3 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between gap-2 text-xs ${
          isFullscreen
            ? `absolute bottom-0 inset-x-0 z-40 bg-neutral-950/90 backdrop-blur-md border-t border-neutral-800/80 transition-opacity duration-300 ${
                isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`
            : ''
        }`}
      >
        {/* Playback Controls Left: Previous Line, Rewind, Play/Pause, Fast-Forward, Next Line */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* 1. Previous Line */}
          <button
            type="button"
            onClick={handlePreviousLine}
            className="w-7 h-7 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Previous Subtitle Line ( [ key )"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* 2. Rewind (10s default, changeable in settings) */}
          <button
            type="button"
            onClick={handleRewind}
            className="h-7 px-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title={`Rewind ${rewindSeconds}s (Left Arrow)`}
          >
            <Rewind className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono font-bold text-neutral-400">{rewindSeconds}s</span>
          </button>

          {/* 3. Play / Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* 4. Fast-Forward (10s default, changeable in settings) */}
          <button
            type="button"
            onClick={handleFastForward}
            className="h-7 px-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title={`Fast-forward ${fastForwardSeconds}s (Right Arrow)`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono font-bold text-neutral-400">{fastForwardSeconds}s</span>
          </button>

          {/* 5. Next Line */}
          <button
            type="button"
            onClick={handleNextLine}
            className="w-7 h-7 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Next Subtitle Line ( ] key )"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Quick Skip Duration Config Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSkipMenuOpen(!isSkipMenuOpen)}
              className="w-6 h-6 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 flex items-center justify-center cursor-pointer transition-colors"
              title="Configure Rewind / Fast-Forward skip seconds"
            >
              <Sliders className="w-3 h-3" />
            </button>
            {isSkipMenuOpen && (
              <div className="absolute left-0 bottom-full mb-1.5 w-44 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-2.5 z-50 text-[11px] animate-in fade-in">
                <div className="font-bold text-neutral-200 mb-2 flex items-center justify-between">
                  <span>Skip Settings</span>
                  <button
                    type="button"
                    onClick={() => setIsSkipMenuOpen(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Rewind: {rewindSeconds}s</label>
                    <div className="flex gap-1">
                      {[5, 10, 15, 30].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            onUpdateDefaults?.({ ...defaultSettings, rewindSeconds: s });
                          }}
                          className={`flex-1 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                            rewindSeconds === s
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Fast-Forward: {fastForwardSeconds}s</label>
                    <div className="flex gap-1">
                      {[5, 10, 15, 30].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            onUpdateDefaults?.({ ...defaultSettings, fastForwardSeconds: s });
                          }}
                          className={`flex-1 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                            fastForwardSeconds === s
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timecode Readout */}
          <div className="font-mono text-[11px] text-neutral-300 ml-1 flex items-center gap-1">
            <span ref={currentTimeTextRef} className="text-blue-400 font-semibold">
              {secondsToTimecode(currentTime)}
            </span>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-400">{secondsToTimecode(duration)}</span>
          </div>
        </div>

        {/* Center: Active Subtitle Preview Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 max-w-sm truncate text-[11px] font-mono text-neutral-400">
          {primaryActiveLine ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-neutral-300 font-bold">Line {primaryActiveLine.lineNumber}:</span>
              <span className="truncate italic">"{primaryActiveLine.text}"</span>
            </>
          ) : (
            <span className="text-neutral-600 italic">No subtitle active at current timecode</span>
          )}
        </div>

        {/* Right Controls: Volume, Playback Rate, Pop-out, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Volume Control */}
          <div className="flex items-center gap-1 text-neutral-400 hover:text-white">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 sm:w-16 h-1 bg-neutral-800 accent-blue-500 rounded-lg cursor-pointer hidden xs:inline"
              title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="h-6 px-1 rounded bg-neutral-800 text-[10.5px] font-mono text-neutral-300 border border-neutral-700 outline-hidden cursor-pointer"
            title="Playback Speed"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>

          {/* PiP Button */}
          <button
            type="button"
            onClick={handleTogglePip}
            className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              isPipActive
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Pop-out Picture-in-Picture"
          >
            <PictureInPicture className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={handleFullscreen}
            className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              isFullscreen
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc or F)' : 'Enter Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
