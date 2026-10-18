import { apiFetch, API_BASE_URL } from '../utils/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SubtitleProject, SubtitleLine, SubtitleGroup, Character, DefaultProjectSettings, CollaboratorUser, Series, SubtitleTrackType } from '../types/subtitle';
import { INITIAL_PROJECT } from '../utils/initialData';
import { parseAndCleanSubtitleText } from '../utils/textCleaner';

function sanitizeProject(p: SubtitleProject): SubtitleProject {
  if (!p || !p.lines || !Array.isArray(p.lines)) return p;
  const seriesList = p.seriesList && Array.isArray(p.seriesList) && p.seriesList.length > 0
    ? p.seriesList
    : INITIAL_PROJECT.seriesList;
  const seriesId = p.seriesId !== undefined ? p.seriesId : INITIAL_PROJECT.seriesId;
  const groups = Array.isArray(p.groups) ? p.groups : (INITIAL_PROJECT.groups || []);
  const language = p.language || INITIAL_PROJECT.language || 'en';
  const trackType = p.trackType || INITIAL_PROJECT.trackType || 'Normal';

  return {
    ...p,
    language,
    trackType,
    seriesList,
    seriesId,
    groups,
    lines: p.lines.map((l) => {
      // Fast path: If line text has no tags or markup, keep as-is with zero parsing overhead
      const raw = l.text || '';
      if (!raw.includes('<') && !raw.includes('{') && !raw.includes('\\')) {
        return l;
      }
      const parsed = parseAndCleanSubtitleText(raw);
      return {
        ...l,
        text: parsed.cleanText,
        font: parsed.font || l.font,
        size: parsed.size || l.size,
        bold: parsed.bold !== undefined ? parsed.bold : l.bold,
        italic: parsed.italic !== undefined ? parsed.italic : l.italic,
        color: parsed.color || l.color,
      };
    }),
  };
}

function fastCloneLines(lines: SubtitleLine[]): SubtitleLine[] {
  const len = lines.length;
  const out = new Array<SubtitleLine>(len);
  for (let i = 0; i < len; i++) {
    const l = lines[i];
    out[i] = {
      ...l,
      flag: l.flag ? { ...l.flag } : undefined,
      shadow: l.shadow ? { ...l.shadow } : undefined,
      outline: l.outline ? { ...l.outline } : undefined,
    };
  }
  return out;
}

export interface UseRealtimeSyncReturn {
  project: SubtitleProject;
  setProject: React.Dispatch<React.SetStateAction<SubtitleProject>>;
  currentUser: { id: string; name: string; color: string; avatar?: string };
  setCurrentUser: (user: { id: string; name: string; color: string; avatar?: string }) => void;
  collaborators: CollaboratorUser[];
  isConnected: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  updateTitle: (title: string) => void;
  updateLanguage: (language: string) => void;
  updateTrackType: (trackType: SubtitleTrackType) => void;
  updateLine: (line: SubtitleLine) => void;
  addLine: (line: SubtitleLine, afterIndex?: number) => void;
  deleteLine: (lineId: string) => void;
  deleteLines: (lineIds: string[]) => void;
  reorderLines: (lines: SubtitleLine[]) => void;
  updateCharacters: (characters: Character[]) => void;
  updateDefaults: (defaults: DefaultProjectSettings) => void;
  selectSeries: (seriesId: string | undefined) => void;
  updateSeriesList: (seriesList: Series[]) => void;
  replaceProject: (newProject: SubtitleProject) => void;
  setFocusedLine: (lineId: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  undo: () => void;
  redo: () => void;
  createGroup: (name: string, lineIds: string[], parentGroupId?: string | null) => SubtitleGroup;
  updateGroup: (group: SubtitleGroup, applyStylesToLines?: boolean) => void;
  deleteGroup: (groupId: string, deleteLines?: boolean) => void;
  toggleGroupCollapse: (groupId: string) => void;
  moveLinesToGroup: (lineIds: string[], targetGroupId: string | null) => void;
  moveGroup: (groupId: string, targetParentGroupId: string | null) => void;
  reorderProjectItems: (newLines: SubtitleLine[], newGroups: SubtitleGroup[]) => void;
  saveToLocalStorage: (p: SubtitleProject) => void;
}

const LAST_PROJECT_KEY = 'subflow_last_project_v1';
const LOCAL_STORAGE_KEY = 'subflow_project_cache';
const LOCAL_USER_KEY = 'subflow_user_profile';

export function useRealtimeSync(): UseRealtimeSyncReturn {
  const [project, setProject] = useState<SubtitleProject>(() => {
    try {
      const lastProject = localStorage.getItem(LAST_PROJECT_KEY);
      if (lastProject) {
        const parsed = JSON.parse(lastProject);
        if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
          return sanitizeProject(parsed);
        }
      }
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
          return sanitizeProject(parsed);
        }
      }
    } catch {
      // fallback
    }
    return sanitizeProject(INITIAL_PROJECT);
  });

  const [currentUser, setCurrentUserState] = useState<{ id: string; name: string; color: string; avatar?: string }>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_USER_KEY);
      if (cached) return JSON.parse(cached);
    } catch {
      // fallback
    }
    const randId = `usr_${Math.random().toString(36).substring(2, 7)}`;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return {
      id: randId,
      name: `Editor ${Math.floor(Math.random() * 90 + 10)}`,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  const [collaborators, setCollaborators] = useState<CollaboratorUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(Date.now());

  // 100-step Undo / Redo History Stack (Lightweight & Effective)
  interface HistorySnapshot {
    lines: SubtitleLine[];
    title: string;
    seriesId?: string;
  }
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const [, setHistoryVersion] = useState(0);

  const typingSnapshotRef = useRef<{ lineId: string; snapshot: HistorySnapshot } | null>(null);
  const typingDebounceRef = useRef<number | null>(null);

  const pushCompletedSnapshot = useCallback((prev: SubtitleProject) => {
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
      typingSnapshotRef.current = null;
    }
    const snapshot: HistorySnapshot = {
      lines: fastCloneLines(prev.lines),
      title: prev.title,
      seriesId: prev.seriesId,
    };
    undoStackRef.current = [...undoStackRef.current.slice(-99), snapshot];
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  // Persist to local storage immediately
  const pendingSaveRef = useRef<SubtitleProject | null>(null);

  const saveToLocalStorage = useCallback((p: SubtitleProject) => {
    pendingSaveRef.current = p;
    try {
      localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(p));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(p));
    } catch {
      // quota or private browsing
    }
  }, []);

  // Flush to localStorage immediately on page hide or tab close
  useEffect(() => {
    const handleFlush = () => {
      if (pendingSaveRef.current) {
        try {
          localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(pendingSaveRef.current));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pendingSaveRef.current));
        } catch {
          // fallback
        }
      }
    };
    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
    };
  }, []);

  const setCurrentUser = useCallback((user: { id: string; name: string; color: string; avatar?: string }) => {
    setCurrentUserState(user);
    try {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } catch {
      // fallback
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'user:identify',
          payload: user,
        })
      );
    }
  }, []);

  // Send message helper with throttled saving indicator
  const savingDebounceRef = useRef<number | null>(null);
  const sendMessage = useCallback((type: string, payload: unknown) => {
    setLastSavedAt(Date.now());
    setIsSaving(true);
    if (savingDebounceRef.current) clearTimeout(savingDebounceRef.current);
    savingDebounceRef.current = window.setTimeout(() => {
      setIsSaving(false);
      savingDebounceRef.current = null;
    }, 500);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type, payload }));
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
      }
    }
  }, []);

  // WebSocket Connection
  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = API_BASE_URL ? API_BASE_URL.replace(/^http/, 'ws') : `${protocol}//${window.location.host}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          setIsConnected(true);
          // Send user identification
          ws.send(
            JSON.stringify({
              type: 'user:identify',
              payload: currentUser,
            })
          );
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case 'sync:init': {
                if (data.payload?.project) {
                  const serverProject = sanitizeProject(data.payload.project);
                  const currentLocal = projectRef.current;

                  // Check if server is sending the initial uncustomized template
                  const isServerInitial = serverProject.id === 'proj_default_01' || serverProject.title.includes('Project Aurora');
                  const hasLocalProject = currentLocal && currentLocal.lines && currentLocal.lines.length > 0;
                  const isLocalCustomized = hasLocalProject && (
                    !currentLocal.title.includes('Project Aurora') ||
                    currentLocal.language !== (serverProject.language || 'en') ||
                    currentLocal.trackType !== (serverProject.trackType || 'Normal') ||
                    currentLocal.lines.length !== serverProject.lines.length ||
                    (currentLocal.updatedAt || 0) > (serverProject.updatedAt || 0) ||
                    currentLocal.lines.some((l, idx) => l.text !== serverProject.lines[idx]?.text)
                  );

                  if (hasLocalProject && (isLocalCustomized || isServerInitial)) {
                    // Keep client's actual project and sync to server!
                    saveToLocalStorage(currentLocal);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'project:update', payload: { project: currentLocal } }));
                    }
                  } else {
                    setProject(serverProject);
                    saveToLocalStorage(serverProject);
                  }
                }
                if (data.payload?.collaborators) {
                  setCollaborators(data.payload.collaborators);
                }
                break;
              }

              case 'collaborators:update': {
                if (data.payload) {
                  setCollaborators(data.payload);
                }
                break;
              }

              case 'line:updated': {
                const { line } = data.payload;
                setProject((prev) => {
                  const idx = prev.lines.findIndex((l) => l.id === line.id);
                  if (idx === -1) return prev;
                  const newLines = [...prev.lines];
                  newLines[idx] = { ...newLines[idx], ...line };
                  const nextState = { ...prev, lines: newLines, updatedAt: Date.now() };
                  saveToLocalStorage(nextState);
                  return nextState;
                });
                break;
              }

              case 'lines:all': {
                const { lines } = data.payload;
                setProject((prev) => {
                  const nextState = { ...prev, lines, updatedAt: Date.now() };
                  saveToLocalStorage(nextState);
                  return nextState;
                });
                break;
              }

              case 'characters:updated': {
                const { characters } = data.payload;
                setProject((prev) => {
                  const nextState = { ...prev, characters, updatedAt: Date.now() };
                  saveToLocalStorage(nextState);
                  return nextState;
                });
                break;
              }

              case 'defaults:updated': {
                const { defaults } = data.payload;
                setProject((prev) => {
                  const nextState = { ...prev, defaultSettings: defaults, updatedAt: Date.now() };
                  saveToLocalStorage(nextState);
                  return nextState;
                });
                break;
              }

              case 'series:updated': {
                const { seriesList } = data.payload;
                setProject((prev) => {
                  const nextState = { ...prev, seriesList, updatedAt: Date.now() };
                  saveToLocalStorage(nextState);
                  return nextState;
                });
                break;
              }

              case 'series:selected': {
                const { seriesId, characters, defaultSettings } = data.payload;
                setProject((prev) => {
                  const nextState = {
                    ...prev,
                    seriesId,
                    characters: characters || prev.characters,
                    defaultSettings: defaultSettings || prev.defaultSettings,
                    updatedAt: Date.now(),
                  };
                  saveToLocalStorage(nextState);
                  return nextState;
                });
                break;
              }

              case 'project:replaced': {
                const { project: newProj } = data.payload;
                setProject(newProj);
                saveToLocalStorage(newProj);
                break;
              }

              case 'database:cleared': {
                const { language, trackType } = data.payload || {};
                if (language) {
                  const lowerLang = language.toLowerCase();
                  setProject((prev) => {
                    const isMatch =
                      prev.language?.toLowerCase() === lowerLang &&
                      (!trackType || prev.trackType === trackType);
                    if (isMatch) {
                      const nextState = { ...prev, lines: [], updatedAt: Date.now() };
                      saveToLocalStorage(nextState);
                      return nextState;
                    }
                    return prev;
                  });
                }
                break;
              }

              default:
                break;
            }
          } catch (err) {
            console.error('Error handling WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          setIsConnected(false);
          // Try reconnecting in 2s
          reconnectTimerRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          if (unmounted) return;
          setIsConnected(false);
          ws.close();
        };
      } catch (e) {
        console.error('WebSocket connection failed:', e);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentUser, saveToLocalStorage]);

  // Mutations with Undo History Recording
  const updateLine = useCallback(
    (line: SubtitleLine) => {
      setProject((prev) => {
        const existingLine = prev.lines.find((l) => l.id === line.id);
        const isOnlyTextChange =
          existingLine &&
          existingLine.text !== line.text &&
          existingLine.startTime === line.startTime &&
          existingLine.endTime === line.endTime &&
          existingLine.characterId === line.characterId &&
          existingLine.font === line.font &&
          existingLine.size === line.size &&
          existingLine.color === line.color &&
          existingLine.bold === line.bold &&
          existingLine.italic === line.italic;

        if (isOnlyTextChange) {
          // Group continuous typing into a single completed change
          if (!typingSnapshotRef.current || typingSnapshotRef.current.lineId !== line.id) {
            typingSnapshotRef.current = {
              lineId: line.id,
              snapshot: {
                lines: fastCloneLines(prev.lines),
                title: prev.title,
                seriesId: prev.seriesId,
              },
            };
          }
          if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
          typingDebounceRef.current = window.setTimeout(() => {
            if (typingSnapshotRef.current) {
              undoStackRef.current = [...undoStackRef.current.slice(-99), typingSnapshotRef.current.snapshot];
              redoStackRef.current = [];
              setHistoryVersion((v) => v + 1);
              typingSnapshotRef.current = null;
            }
          }, 600);
        } else {
          // Completed discrete change (e.g. style, timing, flag, character)
          pushCompletedSnapshot(prev);
        }

        const idx = prev.lines.findIndex((l) => l.id === line.id);
        const newLines = [...prev.lines];
        if (idx !== -1) {
          newLines[idx] = line;
        } else {
          newLines.push(line);
        }
        const updated = { ...prev, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('line:update', { line });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const addLine = useCallback(
    (line: SubtitleLine, afterIndex?: number) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const newLines = [...prev.lines];
        if (typeof afterIndex === 'number' && afterIndex >= 0 && afterIndex < newLines.length) {
          newLines.splice(afterIndex + 1, 0, line);
        } else {
          newLines.push(line);
        }
        newLines.forEach((l, i) => {
          l.lineNumber = i + 1;
        });
        const updated = { ...prev, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('line:add', { line, afterIndex });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const deleteLine = useCallback(
    (lineId: string) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const newLines = prev.lines.filter((l) => l.id !== lineId);
        newLines.forEach((l, i) => {
          l.lineNumber = i + 1;
        });
        const updated = { ...prev, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('line:delete', { lineId });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const deleteLines = useCallback(
    (lineIds: string[]) => {
      if (!lineIds || lineIds.length === 0) return;
      const idSet = new Set(lineIds);
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const newLines = prev.lines.filter((l) => !idSet.has(l.id));
        newLines.forEach((l, i) => {
          l.lineNumber = i + 1;
        });
        const updated = { ...prev, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('lines:delete', { lineIds });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const reorderLines = useCallback(
    (lines: SubtitleLine[]) => {
      const renumbered = lines.map((l, i) => ({ ...l, lineNumber: i + 1 }));
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const updated = { ...prev, lines: renumbered, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('lines:reorder', { lines: renumbered });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const updateTitle = useCallback(
    (title: string) => {
      setProject((prev) => {
        if (prev.title === title) return prev;
        pushCompletedSnapshot(prev);
        const updated = { ...prev, title, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const updateLanguage = useCallback(
    (language: string) => {
      setProject((prev) => {
        if (prev.language === language) return prev;
        pushCompletedSnapshot(prev);
        const updated = { ...prev, language, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const updateTrackType = useCallback(
    (trackType: SubtitleTrackType) => {
      setProject((prev) => {
        if (prev.trackType === trackType) return prev;
        pushCompletedSnapshot(prev);
        const updated = { ...prev, trackType, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const updateCharacters = useCallback(
    (characters: Character[]) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const updated = { ...prev, characters, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('characters:update', { characters });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const updateDefaults = useCallback(
    (defaults: DefaultProjectSettings) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const updated = { ...prev, defaultSettings: defaults, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('defaults:update', { defaults });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const selectSeries = useCallback(
    (seriesId: string | undefined) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const seriesList = prev.seriesList || INITIAL_PROJECT.seriesList || [];
        let newChars = prev.characters;
        let newDefaults = prev.defaultSettings;

        if (seriesId) {
          const found = seriesList.find((s) => s.id === seriesId);
          if (found) {
            newChars = [...found.characters];
            newDefaults = { ...found.defaultSettings };
          }
        }

        const updated: SubtitleProject = {
          ...prev,
          seriesId,
          characters: newChars,
          defaultSettings: newDefaults,
          updatedAt: Date.now(),
        };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('series:select', { seriesId });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const updateSeriesList = useCallback(
    (seriesList: Series[]) => {
      setProject((prev) => {
        const updated = { ...prev, seriesList, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        return updated;
      });
      sendMessage('series:update', { seriesList });
    },
    [sendMessage, saveToLocalStorage]
  );

  const replaceProject = useCallback(
    (newProject: SubtitleProject) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const sanitized = sanitizeProject(newProject);
        saveToLocalStorage(sanitized);
        sendMessage('project:update', { project: sanitized });
        // Immediate server-side persistent save via REST
        try {
          apiFetch('/api/project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
          }).catch(() => {});
        } catch {}
        return sanitized;
      });
    },
    [sendMessage, saveToLocalStorage, pushCompletedSnapshot]
  );

  const setFocusedLine = useCallback(
    (lineId: string | null) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'user:focus',
            payload: { lineId },
          })
        );
      }
    },
    []
  );

  // Undo (up to 100 times)
  const undo = useCallback(() => {
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
      typingSnapshotRef.current = null;
    }
    if (undoStackRef.current.length === 0) return;
    const target = undoStackRef.current.pop()!;
    setProject((prev) => {
      const currentSnapshot: HistorySnapshot = {
        lines: fastCloneLines(prev.lines),
        title: prev.title,
        seriesId: prev.seriesId,
      };
      redoStackRef.current = [...redoStackRef.current.slice(-99), currentSnapshot];
      setHistoryVersion((v) => v + 1);

      const updated = {
        ...prev,
        lines: target.lines,
        title: target.title,
        seriesId: target.seriesId,
        updatedAt: Date.now(),
      };
      saveToLocalStorage(updated);
      sendMessage('project:update', { project: updated });
      return updated;
    });
  }, [saveToLocalStorage, sendMessage]);

  // Redo (up to 100 times)
  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const target = redoStackRef.current.pop()!;
    setProject((prev) => {
      const currentSnapshot: HistorySnapshot = {
        lines: fastCloneLines(prev.lines),
        title: prev.title,
        seriesId: prev.seriesId,
      };
      undoStackRef.current = [...undoStackRef.current.slice(-99), currentSnapshot];
      setHistoryVersion((v) => v + 1);

      const updated = {
        ...prev,
        lines: target.lines,
        title: target.title,
        seriesId: target.seriesId,
        updatedAt: Date.now(),
      };
      saveToLocalStorage(updated);
      sendMessage('project:update', { project: updated });
      return updated;
    });
  }, [saveToLocalStorage, sendMessage]);

  const createGroup = useCallback(
    (name: string, lineIds: string[], parentGroupId: string | null = null): SubtitleGroup => {
      const newGroup: SubtitleGroup = {
        id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim() || 'New Folder',
        parentGroupId: parentGroupId || null,
        collapsed: false,
      };

      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const curGroups = Array.isArray(prev.groups) ? [...prev.groups] : [];
        curGroups.push(newGroup);

        const idSet = new Set(lineIds);
        const newLines = prev.lines.map((line) => {
          if (idSet.has(line.id)) {
            return { ...line, groupId: newGroup.id };
          }
          return line;
        });

        const updated = { ...prev, groups: curGroups, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });

      return newGroup;
    },
    [pushCompletedSnapshot, saveToLocalStorage, sendMessage]
  );

  const updateGroup = useCallback(
    (group: SubtitleGroup, applyStylesToLines = true) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const curGroups = (prev.groups || []).map((g) => (g.id === group.id ? group : g));

        let newLines = prev.lines;
        if (applyStylesToLines) {
          // Find all descendant group IDs (if sub-groups exist)
          const allMemberGroupIds = new Set<string>([group.id]);
          let added = true;
          while (added) {
            added = false;
            curGroups.forEach((g) => {
              if (g.parentGroupId && allMemberGroupIds.has(g.parentGroupId) && !allMemberGroupIds.has(g.id)) {
                allMemberGroupIds.add(g.id);
                added = true;
              }
            });
          }

          newLines = prev.lines.map((line) => {
            if (line.groupId && allMemberGroupIds.has(line.groupId)) {
              return {
                ...line,
                characterId: group.characterId !== undefined ? group.characterId : line.characterId,
                font: group.font !== undefined ? group.font : line.font,
                size: group.size !== undefined ? group.size : line.size,
                bold: group.bold !== undefined ? group.bold : line.bold,
                italic: group.italic !== undefined ? group.italic : line.italic,
                underline: group.underline !== undefined ? group.underline : line.underline,
                strikethrough: group.strikethrough !== undefined ? group.strikethrough : line.strikethrough,
                superscript: group.superscript !== undefined ? group.superscript : line.superscript,
                subscript: group.subscript !== undefined ? group.subscript : line.subscript,
                color: group.color !== undefined ? group.color : line.color,
                shadow: group.shadow !== undefined ? group.shadow : line.shadow,
                outline: group.outline !== undefined ? group.outline : line.outline,
                hasMusicSymbols: group.hasMusicSymbols !== undefined ? group.hasMusicSymbols : line.hasMusicSymbols,
              };
            }
            return line;
          });
        }

        const updated = { ...prev, groups: curGroups, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [pushCompletedSnapshot, saveToLocalStorage, sendMessage]
  );

  const deleteGroup = useCallback(
    (groupId: string, deleteLines = false) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        // Find group and all descendant subgroups
        const groupsToDelete = new Set<string>([groupId]);
        let added = true;
        while (added) {
          added = false;
          (prev.groups || []).forEach((g) => {
            if (g.parentGroupId && groupsToDelete.has(g.parentGroupId) && !groupsToDelete.has(g.id)) {
              groupsToDelete.add(g.id);
              added = true;
            }
          });
        }

        const newGroups = (prev.groups || []).filter((g) => !groupsToDelete.has(g.id));

        let newLines: SubtitleLine[];
        if (deleteLines) {
          newLines = prev.lines.filter((l) => !l.groupId || !groupsToDelete.has(l.groupId));
          newLines.forEach((l, i) => {
            l.lineNumber = i + 1;
          });
        } else {
          // Ungroup
          newLines = prev.lines.map((l) => {
            if (l.groupId && groupsToDelete.has(l.groupId)) {
              return { ...l, groupId: null };
            }
            return l;
          });
        }

        const updated = { ...prev, groups: newGroups, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [pushCompletedSnapshot, saveToLocalStorage, sendMessage]
  );

  const toggleGroupCollapse = useCallback(
    (groupId: string) => {
      setProject((prev) => {
        const newGroups = (prev.groups || []).map((g) =>
          g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
        );
        const updated = { ...prev, groups: newGroups, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [saveToLocalStorage, sendMessage]
  );

  const moveLinesToGroup = useCallback(
    (lineIds: string[], targetGroupId: string | null) => {
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const idSet = new Set(lineIds);
        const newLines = prev.lines.map((l) =>
          idSet.has(l.id) ? { ...l, groupId: targetGroupId } : l
        );
        const updated = { ...prev, lines: newLines, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [pushCompletedSnapshot, saveToLocalStorage, sendMessage]
  );

  const moveGroup = useCallback(
    (groupId: string, targetParentGroupId: string | null) => {
      setProject((prev) => {
        if (groupId === targetParentGroupId) return prev;
        pushCompletedSnapshot(prev);
        const newGroups = (prev.groups || []).map((g) =>
          g.id === groupId ? { ...g, parentGroupId: targetParentGroupId } : g
        );
        const updated = { ...prev, groups: newGroups, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [pushCompletedSnapshot, saveToLocalStorage, sendMessage]
  );

  const reorderProjectItems = useCallback(
    (newLines: SubtitleLine[], newGroups: SubtitleGroup[]) => {
      const renumbered = newLines.map((l, i) => ({ ...l, lineNumber: i + 1 }));
      setProject((prev) => {
        pushCompletedSnapshot(prev);
        const updated = { ...prev, lines: renumbered, groups: newGroups, updatedAt: Date.now() };
        saveToLocalStorage(updated);
        sendMessage('project:update', { project: updated });
        return updated;
      });
    },
    [pushCompletedSnapshot, saveToLocalStorage, sendMessage]
  );

  // Global keyboard shortcuts for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const activeTag = document.activeElement?.tagName?.toLowerCase();
      // Allow native text undo if inside an active text/textarea field
      if (activeTag === 'input' || activeTag === 'textarea') {
        return;
      }

      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    project,
    setProject,
    currentUser,
    setCurrentUser,
    collaborators,
    isConnected,
    isSaving,
    lastSavedAt,
    updateTitle,
    updateLanguage,
    updateTrackType,
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
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undoCount: undoStackRef.current.length,
    redoCount: redoStackRef.current.length,
    undo,
    redo,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleGroupCollapse,
    moveLinesToGroup,
    moveGroup,
    reorderProjectItems,
    saveToLocalStorage,
  };
}
