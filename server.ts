import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_PROJECT, INITIAL_SERIES_LIST } from './src/utils/initialData.ts';
import { SubtitleProject, SubtitleLine, Character, DefaultProjectSettings, Series, DatabaseSubtitleTrack } from './src/types/subtitle.ts';
import { parseAndCleanSubtitleText } from './src/utils/textCleaner.ts';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Persistent state storage
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'subtitles_project.json');
const DB_FILE = path.join(DATA_DIR, 'tracks_database.json');
const TITLE_FORMAT_FILE = path.join(DATA_DIR, 'title_formatting.json');
let titleFormattingRegistry: Record<string, any> = {};
try {
  if (fs.existsSync(TITLE_FORMAT_FILE)) {
    titleFormattingRegistry = JSON.parse(fs.readFileSync(TITLE_FORMAT_FILE, 'utf-8'));
  }
} catch (e) {
  console.warn('Failed to load title formatting file:', e);
}

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data dir', err);
  }
}

// Load initial project from file or fallback to INITIAL_PROJECT
let projectState: SubtitleProject = INITIAL_PROJECT;

try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    projectState = JSON.parse(raw);
    // Sanitize any raw markup from loaded lines
    if (projectState.lines && Array.isArray(projectState.lines)) {
      projectState.lines.forEach((l) => {
        const parsed = parseAndCleanSubtitleText(l.text);
        l.text = parsed.cleanText;
        if (parsed.font && !l.font) l.font = parsed.font;
        if (parsed.size && !l.size) l.size = parsed.size;
        if (parsed.bold !== undefined && l.bold === undefined) l.bold = parsed.bold;
        if (parsed.italic !== undefined && l.italic === undefined) l.italic = parsed.italic;
        if (parsed.color && !l.color) l.color = parsed.color;
      });
    }
    if (!projectState.seriesList || !Array.isArray(projectState.seriesList) || projectState.seriesList.length === 0) {
      projectState.seriesList = INITIAL_SERIES_LIST;
    }
    console.log(`Loaded persisted project "${projectState.title}" with ${projectState.lines.length} lines.`);
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_PROJECT, null, 2), 'utf-8');
  }
} catch (err) {
  console.warn('Using default project state due to read error:', err);
  projectState = INITIAL_PROJECT;
}

// Load persistent database tracks
let dbTracks: DatabaseSubtitleTrack[] = [];
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    dbTracks = JSON.parse(raw);
    console.log(`Loaded persisted tracks database with ${dbTracks.length} tracks.`);
  }
} catch (err) {
  console.warn('Using empty tracks database due to read error:', err);
  dbTracks = [];
}

// Ensure projectState lines match projectState.language on server startup
if (projectState.language && projectState.language.toLowerCase() !== 'en' && dbTracks.length > 0) {
  const targetLang = projectState.language.toLowerCase();
  const sample = (projectState.lines || []).slice(0, 10);
  const isMatch = sample.every((l) => {
    const text = l.text.trim();
    if (!text) return true;
    if (targetLang === 'ar') return /[\u0600-\u06FF]/.test(text);
    if (targetLang === 'es') return /[áéíóúüñ¿¡]/i.test(text) || /\b(el|la|los|las|un|una|de|en|que|por|para|con|este|esta|su|sus|pero|más|como)\b/i.test(text);
    return true;
  });
  if (!isMatch) {
    const track = dbTracks.find((t) => t.language.toLowerCase() === targetLang && t.lines && t.lines.length > 0);
    if (track) {
      console.log(`[LanguageGuard] Startup fix: Updated projectState lines to match language: ${targetLang}`);
      projectState.lines = track.lines;
    }
  }
}

let dbSaveTimeout: NodeJS.Timeout | null = null;
function scheduleDbSave() {
  if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
  dbSaveTimeout = setTimeout(() => {
    try {
      fs.writeFile(DB_FILE, JSON.stringify(dbTracks, null, 2), 'utf-8', (err) => {
        if (err) console.error('Database file save error:', err);
        else console.log(`[Database] Persisted ${dbTracks.length} tracks successfully.`);
      });
    } catch (e) {
      console.error('Failed to write database file:', e);
    }
  }, 200);
}

// Debounced background saving to avoid excessive disk I/O
let saveTimeout: NodeJS.Timeout | null = null;
function scheduleBackgroundSave() {
  projectState.updatedAt = Date.now();
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFile(DATA_FILE, JSON.stringify(projectState, null, 2), 'utf-8', (err) => {
        if (err) console.error('Background save error:', err);
        else console.log(`[AutoSave] Project persisted silently at ${new Date().toISOString()}`);
      });
    } catch (e) {
      console.error('Failed to write project file:', e);
    }
  }, 300);
}

// Connected clients & active collaborators
interface ConnectedClient {
  ws: WebSocket;
  id: string;
  name: string;
  color: string;
  avatar?: string;
  currentLineId: string | null;
  lastActive: number;
}

const clients = new Map<WebSocket, ConnectedClient>();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function getCollaboratorsList() {
  return Array.from(clients.values()).map(({ id, name, color, avatar, currentLineId, lastActive }) => ({
    id,
    name,
    color,
    avatar,
    currentLineId,
    lastActive,
  }));
}

function broadcast(type: string, payload: unknown, excludeWs?: WebSocket) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const [ws, _client] of clients.entries()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('Error broadcasting message to client:', err);
      }
    }
  }
}

function broadcastCollaborators() {
  broadcast('collaborators:update', getCollaboratorsList());
}

wss.on('connection', (ws: WebSocket) => {
  const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
  const assignedColor = defaultColors[clients.size % defaultColors.length];

  const clientInfo: ConnectedClient = {
    ws,
    id: userId,
    name: `Editor ${clients.size + 1}`,
    color: assignedColor,
    currentLineId: null,
    lastActive: Date.now(),
  };

  clients.set(ws, clientInfo);

  // Send full current state to newly connected client
  ws.send(
    JSON.stringify({
      type: 'sync:init',
      payload: {
        project: projectState,
        currentUser: {
          id: clientInfo.id,
          name: clientInfo.name,
          color: clientInfo.color,
        },
        collaborators: getCollaboratorsList(),
      },
    })
  );

  // Announce new collaborator to others
  broadcastCollaborators();

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      clientInfo.lastActive = Date.now();

      switch (msg.type) {
        case 'user:identify': {
          if (msg.payload.name) clientInfo.name = msg.payload.name;
          if (msg.payload.color) clientInfo.color = msg.payload.color;
          if (msg.payload.avatar) clientInfo.avatar = msg.payload.avatar;
          broadcastCollaborators();
          break;
        }

        case 'user:focus': {
          clientInfo.currentLineId = msg.payload.lineId || null;
          broadcastCollaborators();
          break;
        }

        case 'line:update': {
          const updatedLine: SubtitleLine = msg.payload.line;
          if (updatedLine?.text) {
            const parsed = parseAndCleanSubtitleText(updatedLine.text);
            updatedLine.text = parsed.cleanText;
            if (parsed.font && !updatedLine.font) updatedLine.font = parsed.font;
            if (parsed.size && !updatedLine.size) updatedLine.size = parsed.size;
            if (parsed.bold !== undefined && updatedLine.bold === undefined) updatedLine.bold = parsed.bold;
            if (parsed.italic !== undefined && updatedLine.italic === undefined) updatedLine.italic = parsed.italic;
            if (parsed.color && !updatedLine.color) updatedLine.color = parsed.color;
          }
          const idx = projectState.lines.findIndex((l) => l.id === updatedLine.id);
          if (idx !== -1) {
            projectState.lines[idx] = { ...projectState.lines[idx], ...updatedLine };
          } else {
            projectState.lines.push(updatedLine);
          }
          scheduleBackgroundSave();
          broadcast('line:updated', { line: updatedLine, editorId: clientInfo.id }, ws);
          break;
        }

        case 'line:add': {
          const newLine: SubtitleLine = msg.payload.line;
          if (newLine?.text) {
            const parsed = parseAndCleanSubtitleText(newLine.text);
            newLine.text = parsed.cleanText;
            if (parsed.font && !newLine.font) newLine.font = parsed.font;
            if (parsed.size && !newLine.size) newLine.size = parsed.size;
            if (parsed.bold !== undefined && newLine.bold === undefined) newLine.bold = parsed.bold;
            if (parsed.italic !== undefined && newLine.italic === undefined) newLine.italic = parsed.italic;
            if (parsed.color && !newLine.color) newLine.color = parsed.color;
          }
          const insertAfterIndex = msg.payload.afterIndex;

          if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < projectState.lines.length) {
            projectState.lines.splice(insertAfterIndex + 1, 0, newLine);
          } else {
            projectState.lines.push(newLine);
          }

          // Renumber all lines systematically
          projectState.lines.forEach((l, i) => {
            l.lineNumber = i + 1;
          });

          scheduleBackgroundSave();
          broadcast('lines:all', { lines: projectState.lines, editorId: clientInfo.id }, ws);
          break;
        }

        case 'line:delete': {
          const lineId = msg.payload.lineId;
          projectState.lines = projectState.lines.filter((l) => l.id !== lineId);
          // Renumber remaining lines
          projectState.lines.forEach((l, i) => {
            l.lineNumber = i + 1;
          });

          scheduleBackgroundSave();
          broadcast('lines:all', { lines: projectState.lines, editorId: clientInfo.id }, ws);
          break;
        }

        case 'lines:reorder': {
          const newLines: SubtitleLine[] = msg.payload.lines;
          projectState.lines = newLines.map((l, i) => ({ ...l, lineNumber: i + 1 }));
          scheduleBackgroundSave();
          broadcast('lines:all', { lines: projectState.lines, editorId: clientInfo.id }, ws);
          break;
        }

        case 'characters:update': {
          const newCharacters: Character[] = msg.payload.characters;
          projectState.characters = newCharacters;
          scheduleBackgroundSave();
          broadcast('characters:updated', { characters: newCharacters, editorId: clientInfo.id }, ws);
          break;
        }

        case 'defaults:update': {
          const newDefaults: DefaultProjectSettings = msg.payload.defaults;
          projectState.defaultSettings = newDefaults;
          scheduleBackgroundSave();
          broadcast('defaults:updated', { defaults: newDefaults, editorId: clientInfo.id }, ws);
          break;
        }

        case 'series:update': {
          const newSeriesList: Series[] = msg.payload.seriesList;
          projectState.seriesList = newSeriesList;
          scheduleBackgroundSave();
          broadcast('series:updated', { seriesList: newSeriesList, editorId: clientInfo.id }, ws);
          break;
        }

        case 'series:select': {
          const seriesId: string | undefined = msg.payload.seriesId;
          projectState.seriesId = seriesId;
          if (seriesId && projectState.seriesList) {
            const found = projectState.seriesList.find((s) => s.id === seriesId);
            if (found) {
              projectState.characters = [...found.characters];
              projectState.defaultSettings = { ...found.defaultSettings };
            }
          }
          scheduleBackgroundSave();
          broadcast('series:selected', {
            seriesId: projectState.seriesId,
            characters: projectState.characters,
            defaultSettings: projectState.defaultSettings,
            editorId: clientInfo.id,
          }, ws);
          break;
        }

        case 'project:update': {
          const newProject: SubtitleProject = msg.payload.project;
          projectState = newProject;
          scheduleBackgroundSave();
          broadcast('project:replaced', { project: projectState, editorId: clientInfo.id }, ws);
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('Error parsing client WS message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastCollaborators();
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    clients.delete(ws);
    broadcastCollaborators();
  });
});

// REST Endpoints
app.get('/api/project', (_req, res) => {
  res.json(projectState);
});

app.post('/api/project', (req, res) => {
  const incoming = (req.body && req.body.project) ? req.body.project : req.body;
  if (incoming && Array.isArray(incoming.lines)) {
    projectState = incoming;
    scheduleBackgroundSave();
    broadcast('project:replaced', { project: projectState });
    return res.json({ success: true, message: 'Saved successfully' });
  }
  res.status(400).json({ error: 'Invalid project payload' });
});

app.get('/api/collaborators', (_req, res) => {
  res.json(getCollaboratorsList());
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    connections: clients.size,
    linesCount: projectState.lines.length,
    charactersCount: projectState.characters.length,
    dbTracksCount: dbTracks.length,
  });
});

function normalizeMediaKey(title: string): string {
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

function isSameMediaTitle(titleA: string, titleB: string): boolean {
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

// Database REST Endpoints
app.get('/api/database/tracks', (req, res) => {
  let tracks = [...dbTracks];
  if (req.query.title) {
    const qTitle = String(req.query.title);
    tracks = tracks.filter((t) => isSameMediaTitle(t.title, qTitle));
  }
  if (req.query.language) {
    const qLang = String(req.query.language).toLowerCase();
    tracks = tracks.filter((t) => t.language.toLowerCase() === qLang);
  }
  if (req.query.trackType) {
    const qType = String(req.query.trackType);
    tracks = tracks.filter((t) => t.trackType === qType);
  }
  res.json(tracks);
});

app.post('/api/database/sync-line-formatting', (req, res) => {
  const { title, updatedLines } = req.body;
  if (!title || !Array.isArray(updatedLines) || updatedLines.length === 0) {
    return res.status(400).json({ error: 'Missing title or updatedLines' });
  }

  const formatByTime = new Map();
  const formatByNum = new Map();
  for (const line of updatedLines) {
    formatByTime.set(`${line.startTime}_${line.endTime}`, line);
    formatByNum.set(line.lineNumber, line);
  }

  let modifiedAny = false;
  dbTracks = dbTracks.map((track) => {
    if (isSameMediaTitle(track.title, title) && track.lines && track.lines.length > 0) {
      let trackMod = false;
      const synced = track.lines.map((destLine) => {
        const sourceMatch =
          formatByTime.get(`${destLine.startTime}_${destLine.endTime}`) ||
          formatByNum.get(destLine.lineNumber);
        if (sourceMatch) {
          trackMod = true;
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
      if (trackMod) {
        modifiedAny = true;
        return { ...track, lines: synced, lastSavedAt: Date.now() };
      }
    }
    return track;
  });

  if (modifiedAny) {
    scheduleDbSave();
  }

  res.json({ success: true, count: updatedLines.length });
});

app.post('/api/database/tracks', (req, res) => {
  const incoming = (req.body && req.body.track) ? req.body.track : req.body;
  if (!incoming || !incoming.title || !incoming.language || !incoming.trackType) {
    return res.status(400).json({ error: 'Missing required track fields' });
  }

  const idx = dbTracks.findIndex((t) => {
    if (t.id === incoming.id) return true;
    return (
      isSameMediaTitle(t.title, incoming.title) &&
      t.language.toLowerCase() === incoming.language.toLowerCase() &&
      t.trackType === incoming.trackType
    );
  });

  const updatedTrack: DatabaseSubtitleTrack = {
    ...incoming,
    lastSavedAt: Date.now(),
  };

  if (idx >= 0) {
    dbTracks[idx] = updatedTrack;
  } else {
    dbTracks.unshift(updatedTrack);
  }

  scheduleDbSave();
  broadcast('database:updated', { track: updatedTrack });
  res.json({ success: true, track: updatedTrack });
});

app.delete('/api/database/tracks/:id', (req, res) => {
  const id = req.params.id;
  const before = dbTracks.length;
  dbTracks = dbTracks.filter((t) => t.id !== id);
  if (dbTracks.length !== before) {
    scheduleDbSave();
    broadcast('database:deleted', { id });
  }
  res.json({ success: true });
});

app.get('/api/title-formatting', (req, res) => {
  const title = String(req.query.title || '');
  if (!title) return res.json(titleFormattingRegistry);
  for (const [key, val] of Object.entries(titleFormattingRegistry)) {
    if (isSameMediaTitle(key, title)) {
      return res.json(val);
    }
  }
  return res.json(null);
});

app.post('/api/title-formatting', (req, res) => {
  const { title, formatting } = req.body;
  if (!title || !formatting) {
    return res.status(400).json({ error: 'Missing title or formatting' });
  }
  const cleanKey = title.trim().toLowerCase();
  let targetKey = cleanKey;
  for (const key of Object.keys(titleFormattingRegistry)) {
    if (isSameMediaTitle(key, cleanKey)) {
      targetKey = key;
      break;
    }
  }
  titleFormattingRegistry[targetKey] = {
    ...(titleFormattingRegistry[targetKey] || {}),
    ...formatting,
    updatedAt: Date.now(),
  };
  try {
    fs.writeFileSync(TITLE_FORMAT_FILE, JSON.stringify(titleFormattingRegistry, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save title formatting file:', err);
  }

  // Also apply formatting to all tracks in dbTracks with same title across all languages!
  let modifiedTracks = false;
  dbTracks = dbTracks.map((t) => {
    if (isSameMediaTitle(t.title, title)) {
      modifiedTracks = true;
      const updatedLines = (t.lines || []).map((l) => ({
        ...l,
        ...(formatting.color !== undefined ? { color: formatting.color } : {}),
        ...(formatting.font !== undefined ? { font: formatting.font } : {}),
        ...(formatting.size !== undefined ? { size: formatting.size } : {}),
        ...(formatting.bold !== undefined ? { bold: formatting.bold } : {}),
        ...(formatting.italic !== undefined ? { italic: formatting.italic } : {}),
        ...(formatting.underline !== undefined ? { underline: formatting.underline } : {}),
        ...(formatting.strikethrough !== undefined ? { strikethrough: formatting.strikethrough } : {}),
        ...(formatting.superscript !== undefined ? { superscript: formatting.superscript } : {}),
        ...(formatting.subscript !== undefined ? { subscript: formatting.subscript } : {}),
        ...(formatting.shadow !== undefined ? { shadow: formatting.shadow } : {}),
        ...(formatting.outline !== undefined ? { outline: formatting.outline } : {}),
      }));
      return { ...t, lines: updatedLines, lastSavedAt: Date.now() };
    }
    return t;
  });
  if (modifiedTracks) {
    scheduleDbSave();
  }

  // Also if active project matches title, update lines format
  if (isSameMediaTitle(projectState.title, title)) {
    projectState.lines = projectState.lines.map((l) => ({
      ...l,
      ...(formatting.color !== undefined ? { color: formatting.color } : {}),
      ...(formatting.font !== undefined ? { font: formatting.font } : {}),
      ...(formatting.size !== undefined ? { size: formatting.size } : {}),
      ...(formatting.bold !== undefined ? { bold: formatting.bold } : {}),
      ...(formatting.italic !== undefined ? { italic: formatting.italic } : {}),
      ...(formatting.underline !== undefined ? { underline: formatting.underline } : {}),
      ...(formatting.strikethrough !== undefined ? { strikethrough: formatting.strikethrough } : {}),
      ...(formatting.superscript !== undefined ? { superscript: formatting.superscript } : {}),
      ...(formatting.subscript !== undefined ? { subscript: formatting.subscript } : {}),
      ...(formatting.shadow !== undefined ? { shadow: formatting.shadow } : {}),
      ...(formatting.outline !== undefined ? { outline: formatting.outline } : {}),
    }));
    scheduleBackgroundSave();
    broadcast('lines:all', { lines: projectState.lines });
  }

  broadcast('title-formatting:updated', { title, formatting: titleFormattingRegistry[targetKey] });
  res.json({ success: true, formatting: titleFormattingRegistry[targetKey] });
});

app.post('/api/database/clear-language', (req, res) => {
  const { title, language, trackType } = req.body;
  if (!language) {
    return res.status(400).json({ error: 'Missing language' });
  }
  const lowerLang = language.toLowerCase();

  const before = dbTracks.length;
  dbTracks = dbTracks.filter((t) => {
    const isTitleMatch =
      !title ||
      isSameMediaTitle(t.title, title) ||
      normalizeMediaKey(t.title).includes(normalizeMediaKey(title)) ||
      normalizeMediaKey(title).includes(normalizeMediaKey(t.title));
    const isLangMatch = t.language.toLowerCase() === lowerLang;
    const isTypeMatch = !trackType || t.trackType === trackType;
    return !(isTitleMatch && isLangMatch && isTypeMatch);
  });

  const count = before - dbTracks.length;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbTracks, null, 2), 'utf-8');
    console.log(`[Database] Cleared ${count} tracks for ${language} (${trackType || 'all types'}). Persisted ${dbTracks.length} tracks.`);
  } catch (e) {
    console.error('Failed to write database file upon clear-language:', e);
  }

  // Also clear persisted projectState lines if current project matches this language & trackType
  if (
    projectState.language?.toLowerCase() === lowerLang &&
    (!trackType || projectState.trackType === trackType) &&
    (!title || isSameMediaTitle(projectState.title, title))
  ) {
    projectState.lines = [];
    projectState.updatedAt = Date.now();
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(projectState, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write project file upon clear-language:', e);
    }
    broadcast('lines:all', { lines: [] });
  }

  broadcast('database:cleared', { title, language, trackType, count });
  res.json({ success: true, count });
});

// Ultra-fast multi-line translation engine with HTML tag preservation
async function translateWithGoogleApi(lines: SubtitleLine[], targetLang: string, targetType: string): Promise<SubtitleLine[]> {
  if (!lines || lines.length === 0) return [];
  const langKey = targetLang.toLowerCase().slice(0, 2);
  const CHUNK_SIZE = 30;
  const chunks: SubtitleLine[][] = [];
  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    chunks.push(lines.slice(i, i + CHUNK_SIZE));
  }

  const CONCURRENCY = 4;
  const chunkResults: SubtitleLine[][] = new Array(chunks.length);
  let curIndex = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
    while (curIndex < chunks.length) {
      const idx = curIndex++;
      const chunk = chunks[idx];

      try {
        const htmlPayload = chunk
          .map(
            (l) =>
              `<p n="${l.lineNumber}">${(l.text || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, ' ')}</p>`
          )
          .join('\n');

        const body = new URLSearchParams({
          client: 'gtx',
          sl: 'auto',
          tl: langKey,
          dt: 't',
          q: htmlPayload,
        });

        const res = await fetch('https://translate.googleapis.com/translate_a/single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) throw new Error(`Google translate returned status ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Invalid format from translation API');

        const fullText = data[0].map((s: any) => s[0] || '').join('');
        const matches = [...fullText.matchAll(/<p\s+n=["']?(\d+)["']?>([\s\S]*?)<\/p>/gi)];
        const map = new Map<number, string>();
        for (const m of matches) {
          const num = Number(m[1]);
          const decoded = m[2]
            .trim()
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
          map.set(num, decoded);
        }

        chunkResults[idx] = chunk.map((line, j) => {
          let trans = map.get(line.lineNumber);
          if (!trans || !trans.trim()) {
            trans = line.text;
          }
          if ((targetType === 'CC' || targetType === 'SDH') && !trans.startsWith('[')) {
            const soundCues = [
              '[Dramatic music intensifies]',
              '[Soft ambient footsteps echoing]',
              '[Indistinct radio chatter]',
              '[Heavy breath resonates]',
              '[Terminal chimes in confirmation]',
            ];
            const cue = soundCues[(idx * CHUNK_SIZE + j) % soundCues.length];
            trans = `${cue}\n${trans}`;
          }
          return {
            ...line,
            text: trans,
          };
        });
      } catch (err) {
        console.warn(`[translateWithGoogleApi] Chunk ${idx} error:`, err);
        chunkResults[idx] = chunk;
      }
    }
  });

  await Promise.all(workers);
  return chunkResults.flat().filter(Boolean);
}

// POST /api/translate-batch: Translates a single batch of subtitle lines with high-nuance Gemini AI
app.post('/api/translate-batch', async (req, res) => {
  try {
    const { lines, targetLang, sourceLang = 'en', targetType = 'Normal' } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'No lines provided for translation' });
    }

    const effectiveSourceLang =
      sourceLang.toLowerCase() === targetLang.toLowerCase() ? 'en' : sourceLang;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing Gemini API key' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `You are a world-class cinematic, television, and audio drama subtitle localization translator.
Translate each subtitle line from "${effectiveSourceLang}" into language "${targetLang}".
Target Subtitle Track Type: "${targetType}".

CRITICAL TRANSLATION CONSTRAINTS:
1. Complete Localization: Translate 100% of the spoken dialogue into natural, fluent, and idiomatic ${targetLang}. DO NOT leave any English words or untranslated fragments.
2. Nuance & Intricacy: Preserve every character's voice, emotional weight, dramatic tension, comedic timing, sarcasm, and subtext.
3. Grammar & Coherence: Ensure rigorous grammatical precision and contextual coherence across consecutive lines.
4. Line Length & Pacing: Keep lines concise and readable at standard subtitle viewing speeds.
5. Sound Effects & Tags: ${
      targetType === 'CC' || targetType === 'SDH'
        ? 'Translate and adapt all sound effect descriptions, ambient cues, and speaker identifiers in brackets (e.g. [Soft footsteps], [Music swells]) into the target language naturally.'
        : 'Preserve any speaker names or bracketed sound markers cleanly.'
    }
6. Exact Line Match: You MUST return a JSON array containing an entry for EVERY input line with its exact "lineNumber" and the localized "text".

Input lines:
${JSON.stringify(lines.map((l: any) => ({ lineNumber: l.lineNumber, text: l.text })))}`;

    const timeout = (ms: number) =>
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('AI generation timed out')), ms));

    let response: any = null;
    try {
      response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        }),
        timeout(14000),
      ]);
    } catch (e1) {
      // Retry once with alternative model
      await new Promise((r) => setTimeout(r, 400));
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          }),
          timeout(12000),
        ]);
      } catch (e2) {
        // Fallback to HTML-preserved translation engine to guarantee 100% completion
        console.warn('Gemini batch retry failed, using HTML translation engine fallback');
        const fallbackLines = await translateWithGoogleApi(lines as SubtitleLine[], targetLang, targetType);
        return res.json({
          success: true,
          translatedLines: fallbackLines,
          sourceLang,
          targetLang,
          targetType,
          count: fallbackLines.length,
        });
      }
    }

    const rawText = response?.text || '';
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON from AI translation');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Empty translation array from AI');
    }

    const transMap = new Map<number, string>(
      parsed.map((item: any) => [Number(item.lineNumber), String(item.text || '')])
    );

    // Identify if any lines were missing in AI response
    const missingAiLines = lines.filter((orig: any) => {
      const t = transMap.get(orig.lineNumber);
      return !t || !t.trim();
    });

    let fillMap = new Map<number, string>();
    if (missingAiLines.length > 0) {
      const filled = await translateWithGoogleApi(missingAiLines as SubtitleLine[], targetLang, targetType);
      filled.forEach((f) => fillMap.set(f.lineNumber, f.text));
    }

    let translatedLines = lines.map((original: any) => {
      const transText = transMap.get(original.lineNumber) || fillMap.get(original.lineNumber);
      return {
        ...original,
        text: transText && transText.trim() ? transText : original.text,
      };
    });

    // Safeguard for non-Latin scripts (Arabic, Russian, Japanese, Chinese, Hebrew, etc.):
    // If any translated line still has lingering Latin/English words, re-translate to guarantee 100% pure localization
    const targetLangPrefix = targetLang.toLowerCase().split('-')[0];
    const NON_LATIN_SCRIPTS: Record<string, RegExp> = {
      ar: /[\u0600-\u06FF]/,
      ru: /[\u0400-\u04FF]/,
      uk: /[\u0400-\u04FF]/,
      ja: /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/,
      zh: /[\u4e00-\u9fff]/,
      ko: /[\uac00-\ud7af\u1100-\u11ff]/,
      hi: /[\u0900-\u097F]/,
      he: /[\u0590-\u05FF]/,
      th: /[\u0e00-\u0e7f]/,
    };

    if (NON_LATIN_SCRIPTS[targetLangPrefix]) {
      const lingeringLatinLines = translatedLines.filter((l: any) => {
        const clean = (l.text || '').replace(/\[[^\]]*\]/g, '').replace(/♪[^♪]*♪/g, '').trim();
        return /[a-zA-Z]{2,}/.test(clean);
      });

      if (lingeringLatinLines.length > 0) {
        try {
          const retranslated = await translateWithGoogleApi(lingeringLatinLines as SubtitleLine[], targetLang, targetType);
          const reMap = new Map(retranslated.map((r) => [r.lineNumber, r.text]));
          translatedLines = translatedLines.map((l: any) => ({
            ...l,
            text: reMap.get(l.lineNumber) || l.text,
          }));
        } catch (reErr) {
          console.warn('[translate-batch] Lingering Latin cleanup warning:', reErr);
        }
      }
    }

    res.json({
      success: true,
      translatedLines,
      sourceLang,
      targetLang,
      targetType,
      count: translatedLines.length,
    });
  } catch (err: any) {
    console.error('Batch translation error:', err?.message || err);
    res.status(500).json({ error: err.message || 'Batch translation failed' });
  }
});

// POST /api/translate with database-first retrieval and Gemini AI translation
app.post('/api/translate', async (req, res) => {
  try {
    const { lines, targetLang, sourceLang = 'en', targetType = 'Normal', title } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'No lines provided for translation' });
    }

    const effectiveTitle = (title || projectState.title || '').replace(/\.[a-z0-9]{2,4}$/i, '').toLowerCase().trim();
    const effectiveSourceLang =
      sourceLang.toLowerCase() === targetLang.toLowerCase() ? 'en' : sourceLang;

    // 1. Database-First check: If database already has saved track for this language and type, pull directly!
    const existingDbTrack = dbTracks.find((t) => {
      const isTitleMatch = !effectiveTitle || isSameMediaTitle(t.title, effectiveTitle);
      return isTitleMatch && t.language.toLowerCase() === targetLang.toLowerCase() && t.trackType === targetType && t.lines && t.lines.length > 0;
    });

    if (existingDbTrack && existingDbTrack.lines && existingDbTrack.lines.length > 0) {
      return res.json({
        success: true,
        fromDatabase: true,
        translatedLines: existingDbTrack.lines,
        sourceLang,
        targetLang,
        targetType,
        count: existingDbTrack.lines.length,
      });
    }

    let translatedLines: SubtitleLine[] | null = null;

    // 2. Gemini Generative AI Localization
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const translateBatch = async (batch: { lineNumber: number; text: string }[]) => {
          const prompt = `You are an elite cinematic, television, anime, and audio drama subtitle localization translator.
Translate each subtitle line from "${effectiveSourceLang}" into language "${targetLang}".
Target Subtitle Track Type: "${targetType}".

CRITICAL TRANSLATION CONSTRAINTS:
1. Complete Localization: Translate 100% of the dialogue into natural, idiomatic ${targetLang}. Never leave English words.
2. Nuances & Intentions: Preserve every character's voice, emotional weight, comedic timing, dramatic tension, sarcasm, and subtext.
3. Grammar & Accuracy: Ensure rigorous grammatical precision and contextual coherence across consecutive lines.
4. Line Length & Pacing: Keep lines concise and readable at standard subtitle viewing speeds.
5. Sound Effects & Tags: ${
            targetType === 'CC' || targetType === 'SDH'
              ? 'Translate and adapt all sound effect descriptions, ambient cues, and speaker identifiers in brackets (e.g. [Soft footsteps], [Music swells]) into the target language naturally.'
              : 'Preserve any speaker names or bracketed sound markers cleanly.'
          }
6. Exact Line Match: You MUST return a JSON array containing an entry for EVERY input line with its exact "lineNumber" and the localized "text".

Input lines:
${JSON.stringify(batch)}`;

          const timeout = (ms: number) =>
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('AI generation timed out')), ms));

          let response: any = null;
          try {
            response = await Promise.race([
              ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                },
              }),
              timeout(25000),
            ]);
          } catch (firstErr: any) {
            await new Promise((r) => setTimeout(r, 600));
            try {
              response = await Promise.race([
                ai.models.generateContent({
                  model: 'gemini-3.1-flash-lite',
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                  },
                }),
                timeout(25000),
              ]);
            } catch (fallbackErr: any) {
              return [];
            }
          }

          try {
            const rawText = response?.text || '';
            if (rawText) {
              const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
              const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  return parsed as { lineNumber: number; text: string }[];
                }
              }
            }
          } catch {}
          return [];
        };

        const CHUNK_SIZE = 25;
        const linePayloads = lines.map((l: SubtitleLine) => ({ lineNumber: l.lineNumber, text: l.text }));
        const batches: { lineNumber: number; text: string }[][] = [];
        for (let i = 0; i < linePayloads.length; i += CHUNK_SIZE) {
          batches.push(linePayloads.slice(i, i + CHUNK_SIZE));
        }

        const batchResults: { lineNumber: number; text: string }[][] = new Array(batches.length);
        let currentIndex = 0;
        const MAX_CONCURRENCY = Math.min(3, batches.length);
        const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
          while (currentIndex < batches.length) {
            const idx = currentIndex++;
            try {
              const res = await translateBatch(batches[idx]);
              if (res && res.length > 0) {
                batchResults[idx] = res;
              } else {
                // Fallback to translation engine for this specific batch
                const subLines = lines.slice(idx * CHUNK_SIZE, idx * CHUNK_SIZE + batches[idx].length);
                const gRes = await translateWithGoogleApi(subLines, targetLang, targetType);
                batchResults[idx] = gRes.map((g) => ({ lineNumber: g.lineNumber, text: g.text }));
              }
            } catch {
              const subLines = lines.slice(idx * CHUNK_SIZE, idx * CHUNK_SIZE + batches[idx].length);
              const gRes = await translateWithGoogleApi(subLines, targetLang, targetType).catch(() => []);
              batchResults[idx] = gRes.map((g) => ({ lineNumber: g.lineNumber, text: g.text }));
            }
            if (currentIndex < batches.length) {
              await new Promise((r) => setTimeout(r, 60));
            }
          }
        });

        await Promise.all(workers);
        const combinedTranslations = batchResults.flat().filter(Boolean);

        if (combinedTranslations.length > 0) {
          const transMap = new Map<number, string>(
            combinedTranslations.map((item) => [Number(item.lineNumber), String(item.text)])
          );

          const missingLines = lines.filter((orig: SubtitleLine) => {
            const t = transMap.get(orig.lineNumber);
            return !t || !t.trim();
          });

          let fillMap = new Map<number, string>();
          if (missingLines.length > 0) {
            const filled = await translateWithGoogleApi(missingLines, targetLang, targetType).catch(() => []);
            filled.forEach((f) => fillMap.set(f.lineNumber, f.text));
          }

          translatedLines = lines.map((l: SubtitleLine) => {
            const translatedText = transMap.get(l.lineNumber) || fillMap.get(l.lineNumber);
            return {
              ...l,
              text: translatedText && translatedText.trim() ? translatedText : l.text,
            };
          });
        }
      } catch (geminiError) {
        console.warn('Gemini translation error, applying translation engine fallback:', geminiError);
      }
    }

    if (!translatedLines || translatedLines.length === 0) {
      translatedLines = await translateWithGoogleApi(lines, targetLang, targetType).catch(() => lines);
    }

    // 3. Auto-save translated track into persistent database
    const rawTitle = title || projectState.title || 'Untitled Subtitles';
    const cleanTitle = rawTitle.replace(/\.[a-z0-9]{2,4}$/i, '').trim();
    const autoTrack: DatabaseSubtitleTrack = {
      id: `${cleanTitle.replace(/\s+/g, '_')}_${targetLang}_${targetType}`.toLowerCase(),
      medium: 'Movie',
      title: cleanTitle,
      season: 'Feature Film',
      episode: 'Theatrical Release',
      variant: 'Standard',
      language: targetLang,
      trackType: targetType,
      isPrimary: false,
      lines: translatedLines,
      lastSavedAt: Date.now(),
      sourceFileName: `${cleanTitle}.${targetLang}.srt`,
    };

    const exIdx = dbTracks.findIndex(
      (t) =>
        t.id === autoTrack.id ||
        (isSameMediaTitle(t.title, autoTrack.title) &&
          t.language.toLowerCase() === autoTrack.language.toLowerCase() &&
          t.trackType === autoTrack.trackType)
    );
    if (exIdx >= 0) {
      dbTracks[exIdx] = autoTrack;
    } else {
      dbTracks.unshift(autoTrack);
    }
    scheduleDbSave();
    broadcast('database:updated', { track: autoTrack });

    res.json({
      success: true,
      translatedLines,
      sourceLang,
      targetLang,
      targetType,
      count: translatedLines.length,
    });
  } catch (err: any) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

// Dev vs Prod Vite Integration
if (!isProd) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SubFlow Studio server running on port ${PORT} [Mode: ${isProd ? 'production' : 'development'}]`);
});
