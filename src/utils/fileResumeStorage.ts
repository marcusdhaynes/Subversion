// IndexedDB & File System Access API storage for video & subtitle resume sessions

const DB_NAME = 'subflow_file_sessions_v1';
const DB_VERSION = 2;
export const STORE_VIDEO = 'video_session';
export const STORE_SUBTITLE = 'subtitle_session';
export const STORE_MEDIA_DB = 'media_database_store';
export const STORE_PROJECT_SNAPSHOT = 'project_snapshot_store';

export interface SavedVideoSession {
  fileName: string;
  title: string;
  sourceType: 'local' | 'url' | 'sample' | 'youtube';
  position: number;
  duration: number;
  updatedAt: number;
  url?: string;
  videoKey?: string;
  fileHandle?: FileSystemFileHandle;
  fileBlob?: Blob;
}

export interface SavedSubtitleSession {
  fileName: string;
  format: string;
  content: string;
  linesCount: number;
  updatedAt: number;
  fileHandle?: FileSystemFileHandle;
  fileBlob?: Blob;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_VIDEO)) {
        db.createObjectStore(STORE_VIDEO);
      }
      if (!db.objectStoreNames.contains(STORE_SUBTITLE)) {
        db.createObjectStore(STORE_SUBTITLE);
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA_DB)) {
        db.createObjectStore(STORE_MEDIA_DB);
      }
      if (!db.objectStoreNames.contains(STORE_PROJECT_SNAPSHOT)) {
        db.createObjectStore(STORE_PROJECT_SNAPSHOT);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save video file and handle for resume
 */
export async function saveVideoSession(data: {
  file?: File;
  fileHandle?: FileSystemFileHandle;
  title: string;
  sourceType: 'local' | 'url' | 'sample' | 'youtube';
  position: number;
  duration: number;
  url?: string;
  videoKey?: string;
}): Promise<void> {
  try {
    const db = await openDB();
    const session: SavedVideoSession = {
      fileName: data.file?.name || data.title,
      title: data.title,
      sourceType: data.sourceType,
      position: data.position,
      duration: data.duration,
      updatedAt: Date.now(),
      url: data.url,
      videoKey: data.videoKey,
      fileHandle: data.fileHandle,
      fileBlob: data.file,
    };

    const tx = db.transaction(STORE_VIDEO, 'readwrite');
    tx.objectStore(STORE_VIDEO).put(session, 'current');

    // Also mirror to localStorage metadata (without non-serializable blob/handle)
    const meta = {
      fileName: session.fileName,
      title: session.title,
      sourceType: session.sourceType,
      position: session.position,
      duration: session.duration,
      updatedAt: session.updatedAt,
      url: session.url,
      videoKey: session.videoKey,
    };
    localStorage.setItem('subflow_last_video_meta', JSON.stringify(meta));
  } catch (err) {
    console.warn('[ResumeStorage] Failed to save video session to IndexedDB:', err);
  }
}

/**
 * Update playback position in saved video session
 */
export async function updateVideoPosition(position: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_VIDEO, 'readwrite');
    const store = tx.objectStore(STORE_VIDEO);
    const req = store.get('current');
    req.onsuccess = () => {
      const session = req.result as SavedVideoSession | undefined;
      if (session) {
        session.position = Math.round(position * 10) / 10;
        session.updatedAt = Date.now();
        store.put(session, 'current');
      }
    };
  } catch {
    // ignore
  }
}

/**
 * Retrieve saved video session
 */
export async function getVideoSession(): Promise<SavedVideoSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_VIDEO, 'readonly');
      const req = tx.objectStore(STORE_VIDEO).get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    // fallback to localStorage meta
    try {
      const raw = localStorage.getItem('subflow_last_video_meta');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
}

/**
 * Attempt to load the last video file from its last location.
 * If file handle is present: queries permission & retrieves File.
 * If file was moved/deleted or permission denied: returns success: false.
 */
export async function loadLastVideoFile(): Promise<
  | { success: true; file: File; session: SavedVideoSession }
  | { success: false; reason: string; fileName: string; session?: SavedVideoSession }
> {
  const session = await getVideoSession();
  if (!session) {
    return { success: false, reason: 'No saved video session found.', fileName: 'Unknown file' };
  }

  // 1. Try File System Access API Handle (loads directly from disk from last location)
  if (session.fileHandle) {
    try {
      const handle = session.fileHandle as any;
      let perm = typeof handle.queryPermission === 'function' ? await handle.queryPermission({ mode: 'read' }) : 'granted';
      if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
        perm = await handle.requestPermission({ mode: 'read' });
      }

      if (perm === 'granted') {
        const file = await handle.getFile();
        return { success: true, file, session };
      } else {
        return {
          success: false,
          reason: 'Permission to access the file at its last location was not granted.',
          fileName: session.fileName,
          session,
        };
      }
    } catch (err: any) {
      // NotFoundError indicates file was moved, renamed, or deleted from disk
      return {
        success: false,
        reason:
          err?.name === 'NotFoundError'
            ? `The file "${session.fileName}" was not found at its previous disk location. It may have been moved, renamed, or deleted.`
            : `Could not access "${session.fileName}" at its previous location: ${err?.message || 'File missing'}`,
        fileName: session.fileName,
        session,
      };
    }
  }

  // 2. Try cached Blob if stored
  if (session.fileBlob) {
    const file = new File([session.fileBlob], session.fileName, {
      type: session.fileBlob.type || 'video/mp4',
      lastModified: session.updatedAt,
    });
    return { success: true, file, session };
  }

  return {
    success: false,
    reason: `File "${session.fileName}" could not be located at its previous location.`,
    fileName: session.fileName,
    session,
  };
}

/**
 * Save subtitle file and handle for resume
 */
export async function saveSubtitleSession(data: {
  file?: File;
  fileHandle?: FileSystemFileHandle;
  fileName: string;
  format?: string;
  content: string;
  linesCount: number;
}): Promise<void> {
  try {
    const db = await openDB();
    const session: SavedSubtitleSession = {
      fileName: data.fileName,
      format: data.format || data.fileName.split('.').pop() || 'srt',
      content: data.content,
      linesCount: data.linesCount,
      updatedAt: Date.now(),
      fileHandle: data.fileHandle,
      fileBlob: data.file,
    };

    const tx = db.transaction(STORE_SUBTITLE, 'readwrite');
    tx.objectStore(STORE_SUBTITLE).put(session, 'current');

    // Also mirror to localStorage
    const meta = {
      fileName: session.fileName,
      format: session.format,
      linesCount: session.linesCount,
      updatedAt: session.updatedAt,
    };
    localStorage.setItem('subflow_last_subtitle_meta', JSON.stringify(meta));
  } catch (err) {
    console.warn('[ResumeStorage] Failed to save subtitle session:', err);
  }
}

/**
 * Retrieve saved subtitle session
 */
export async function getSubtitleSession(): Promise<SavedSubtitleSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SUBTITLE, 'readonly');
      const req = tx.objectStore(STORE_SUBTITLE).get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Open native system file picker for subtitles with FileSystemFileHandle support
 */
export async function pickSubtitleFile(): Promise<{ file: File; handle?: FileSystemFileHandle } | null> {
  if (
    typeof window !== 'undefined' &&
    window.self === window.top &&
    'showOpenFilePicker' in window
  ) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Subtitle Files (*.srt, *.ass, *.ssa, *.vtt, *.sbv, *.json, *.csv, *.lrc, *.txt)',
            accept: {
              'text/plain': ['.srt', '.ass', '.ssa', '.vtt', '.sbv', '.json', '.csv', '.tsv', '.lrc', '.txt'],
            },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      return { file, handle };
    } catch (err: any) {
      if (err.name === 'AbortError') return null; // user cancelled
    }
  }
  return null;
}

/**
 * Attempt to load the last subtitle file from its last location.
 * Checks FileSystemFileHandle on disk first; if moved, renamed, or deleted, informs user.
 */
export async function loadLastSubtitleFile(): Promise<
  | { success: true; file?: File; content: string; fileName: string; linesCount: number; fromDisk: boolean; session: SavedSubtitleSession }
  | { success: false; reason: string; fileName: string; session?: SavedSubtitleSession }
> {
  const session = await getSubtitleSession();
  if (!session) {
    return { success: false, reason: 'No saved subtitle session found.', fileName: 'Unknown file' };
  }

  // 1. Try File System Access API Handle (reads directly from original disk location)
  if (session.fileHandle) {
    try {
      const handle = session.fileHandle as any;
      let perm = typeof handle.queryPermission === 'function' ? await handle.queryPermission({ mode: 'read' }) : 'granted';
      if (perm !== 'granted' && typeof handle.requestPermission === 'function' && typeof window !== 'undefined' && window.self === window.top) {
        try {
          perm = await handle.requestPermission({ mode: 'read' });
        } catch {
          // ignore gesture or iframe error
        }
      }

      if (perm === 'granted') {
        const file = await handle.getFile();
        const content = await file.text();
        return {
          success: true,
          file,
          content,
          fileName: file.name,
          linesCount: session.linesCount,
          fromDisk: true,
          session,
        };
      }
    } catch {
      // Disk file handle failed/moved, fall through to cached content
    }
  }

  // 2. If stored in IndexedDB content / blob
  if (session.content) {
    let file: File | undefined;
    if (session.fileBlob) {
      file = new File([session.fileBlob], session.fileName, {
        type: 'text/plain',
        lastModified: session.updatedAt,
      });
    }
    return {
      success: true,
      file,
      content: session.content,
      fileName: session.fileName,
      linesCount: session.linesCount,
      fromDisk: false,
      session,
    };
  }

  return {
    success: false,
    reason: `The subtitle file "${session.fileName}" is not available at its previous location.`,
    fileName: session.fileName,
    session,
  };
}

/**
 * Clear sessions
 */
export async function clearVideoSession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_VIDEO, 'readwrite');
    tx.objectStore(STORE_VIDEO).delete('current');
    localStorage.removeItem('subflow_last_video_meta');
  } catch {}
}

export async function clearSubtitleSession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SUBTITLE, 'readwrite');
    tx.objectStore(STORE_SUBTITLE).delete('current');
    localStorage.removeItem('subflow_last_subtitle_meta');
  } catch {}
}
