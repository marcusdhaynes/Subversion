import { SubtitleLine, SubtitleProject, Character } from '../types/subtitle';
import { formatLineNumber, secondsToTimecode, timecodeToSeconds } from './timecode';
import { parseAndCleanSubtitleText, cleanSubtitleDialogue } from './textCleaner';

/**
 * Standardize any timecode representation into HH:MM:SS.mmm (e.g. 00:01:23.450)
 */
export function normalizeTimecode(raw: string): string {
  if (!raw) return '00:00:00.000';
  const clean = raw.trim().replace(',', '.');

  // Case 1: Already HH:MM:SS.mmm (e.g. "01:23:45.678" or "00:01:23.45")
  const hhmmssMatch = clean.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (hhmmssMatch) {
    const hours = hhmmssMatch[1].padStart(2, '0');
    const minutes = hhmmssMatch[2].padStart(2, '0');
    const seconds = hhmmssMatch[3].padStart(2, '0');
    let ms = (hhmmssMatch[4] || '0').slice(0, 3).padEnd(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  // Case 2: MM:SS.mmm or MM:SS.cs (e.g. "01:23.45" or "1:23.450")
  const mmssMatch = clean.match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
  if (mmssMatch) {
    const hours = '00';
    const minutes = mmssMatch[1].padStart(2, '0');
    const seconds = mmssMatch[2].padStart(2, '0');
    let ms = (mmssMatch[3] || '0').slice(0, 3).padEnd(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  // Case 3: Pure seconds float or integer (e.g. "75.45")
  const secFloat = parseFloat(clean);
  if (!isNaN(secFloat) && secFloat >= 0) {
    return secondsToTimecode(secFloat);
  }

  return '00:00:00.000';
}

/**
 * Export to SRT format (SubRip)
 */
export function exportToSRT(lines: SubtitleLine[]): string {
  return lines
    .map((line, idx) => {
      const startSrt = line.startTime.replace('.', ',');
      const endSrt = line.endTime.replace('.', ',');
      let formattedText = line.text;
      if (line.bold) formattedText = `<b>${formattedText}</b>`;
      if (line.italic) formattedText = `<i>${formattedText}</i>`;
      return `${idx + 1}\n${startSrt} --> ${endSrt}\n${formattedText}\n`;
    })
    .join('\n');
}

/**
 * Export to WebVTT format
 */
export function exportToVTT(lines: SubtitleLine[]): string {
  const header = 'WEBVTT\n\n';
  const body = lines
    .map((line, idx) => {
      const startVtt = line.startTime;
      const endVtt = line.endTime;
      const charTag = line.characterId ? `<v ${line.characterId}>` : '';
      let formattedText = line.text;
      if (line.bold) formattedText = `<b>${formattedText}</b>`;
      if (line.italic) formattedText = `<i>${formattedText}</i>`;
      // For RTL scripts (Arabic, Hebrew), wrap in Unicode RLE (\u202B) & PDF (\u202C) to preserve exact punctuation positioning
      const isRTL = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(formattedText);
      if (isRTL) {
        formattedText = `\u202B${formattedText}\u202C`;
      }
      return `${idx + 1}\n${startVtt} --> ${endVtt}\n${charTag}${formattedText}\n`;
    })
    .join('\n');
  return header + body;
}

/**
 * Export to ASS / SSA format (Advanced SubStation Alpha)
 */
export function exportToASS(lines: SubtitleLine[], characters: Character[] = [], title = 'Subflow Subtitles'): string {
  const timeToAss = (tc: string) => {
    // ASS format is H:MM:SS.cs (e.g. 0:01:23.45)
    const norm = normalizeTimecode(tc);
    const parts = norm.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const secParts = parts[2].split('.');
    const s = secParts[0];
    const cs = (secParts[1] || '00').slice(0, 2).padEnd(2, '0');
    return `${h}:${m}:${s}.${cs}`;
  };

  let ass = `[Script Info]\nTitle: ${title}\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nPlayResX: 1920\nPlayResY: 1080\n\n`;

  // Styles section
  ass += `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
  ass += `Style: Default,Arial,22,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,20,1\n`;

  characters.forEach((char) => {
    const boldVal = char.bold ? -1 : 0;
    const italicVal = char.italic ? -1 : 0;
    ass += `Style: ${char.name},${char.font || 'Arial'},${char.size || 22},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,${boldVal},${italicVal},0,0,100,100,0,0,1,2,1,2,20,20,20,1\n`;
  });

  ass += `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  lines.forEach((line) => {
    const start = timeToAss(line.startTime);
    const end = timeToAss(line.endTime);
    const char = characters.find((c) => c.id === line.characterId);
    const styleName = char ? char.name : 'Default';
    const actorName = char ? char.name : '';

    let textAss = line.text.replace(/\n/g, '\\N');
    if (line.bold) textAss = `{\\b1}${textAss}{\\b0}`;
    if (line.italic) textAss = `{\\i1}${textAss}{\\i0}`;

    ass += `Dialogue: 0,${start},${end},${styleName},${actorName},0,0,0,,${textAss}\n`;
  });

  return ass;
}

/**
 * Export to JSON format
 */
export function exportToJSON(project: SubtitleProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Export to CSV format
 */
export function exportToCSV(lines: SubtitleLine[]): string {
  const headers = ['Line', 'Start', 'End', 'Character', 'Font', 'Size', 'Bold', 'Italic', 'Text', 'Flag_Code', 'Flag_Note'];
  const rows = lines.map((l) => [
    formatLineNumber(l.lineNumber),
    l.startTime,
    l.endTime,
    l.characterId || '',
    l.font || '',
    l.size || '',
    l.bold ? 'TRUE' : 'FALSE',
    l.italic ? 'TRUE' : 'FALSE',
    `"${(l.text || '').replace(/"/g, '""')}"`,
    l.flag?.isFlagged ? l.flag.code || 'FLAGGED' : '',
    l.flag?.isFlagged ? `"${(l.flag.note || '').replace(/"/g, '""')}"` : '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Parse ASS / SSA (Advanced SubStation Alpha) format
 */
export function parseASS(content: string): { lines: Partial<SubtitleLine>[]; newCharacters: Character[] } {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const result: Partial<SubtitleLine>[] = [];
  const characterMap = new Map<string, Character>();

  let formatHeaders: string[] = [];
  let isEventsSection = false;

  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#e11d48'];
  let colorIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith(';')) continue;

    if (rawLine.startsWith('[')) {
      isEventsSection = rawLine.toLowerCase().includes('[events]');
      continue;
    }

    // Parse [V4+ Styles] / [V4 Styles] for pre-defined character styles
    if (rawLine.startsWith('Style:')) {
      const parts = rawLine.substring(6).split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        const styleName = parts[0];
        const fontName = parts[1] || 'Arial';
        const fontSize = parseInt(parts[2], 10) || 18;
        const isBold = parts[7] === '-1' || parts[7] === '1';
        const isItalic = parts[8] === '-1' || parts[8] === '1';

        if (styleName.toLowerCase() !== 'default') {
          characterMap.set(styleName, {
            id: `char_${styleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name: styleName,
            color: defaultColors[colorIdx++ % defaultColors.length],
            font: fontName,
            size: fontSize,
            bold: isBold,
            italic: isItalic,
          });
        }
      }
      continue;
    }

    if (isEventsSection) {
      if (rawLine.startsWith('Format:')) {
        formatHeaders = rawLine.substring(7).split(',').map((h) => h.trim().toLowerCase());
        continue;
      }

      if (rawLine.startsWith('Dialogue:')) {
        const rest = rawLine.substring(9).trim();

        let startIndex = formatHeaders.indexOf('start');
        let endIndex = formatHeaders.indexOf('end');
        let styleIndex = formatHeaders.indexOf('style');
        let nameIndex = formatHeaders.indexOf('name');
        let textIndex = formatHeaders.indexOf('text');

        // Fallback default ASS indices if Format header was not detected
        if (startIndex === -1) startIndex = 1;
        if (endIndex === -1) endIndex = 2;
        if (styleIndex === -1) styleIndex = 3;
        if (nameIndex === -1) nameIndex = 4;
        if (textIndex === -1) textIndex = 9;

        // Split up to textIndex
        const fields: string[] = [];
        let cur = '';
        let commaCount = 0;
        let p = 0;

        while (p < rest.length && commaCount < textIndex) {
          if (rest[p] === ',') {
            fields.push(cur.trim());
            cur = '';
            commaCount++;
          } else {
            cur += rest[p];
          }
          p++;
        }
        // Remainder is Text
        fields.push(rest.substring(p).trim());

        const startRaw = fields[startIndex] || '0:00:00.00';
        const endRaw = fields[endIndex] || '0:00:02.00';
        const styleName = fields[styleIndex] || '';
        const actorName = fields[nameIndex] || '';
        const rawDialogue = fields[fields.length - 1] || '';
        const parsed = parseAndCleanSubtitleText(rawDialogue);

        // Determine speaker name
        const speakerName = actorName.trim() || (styleName && styleName.toLowerCase() !== 'default' ? styleName : '');

        let characterId: string | undefined = undefined;
        if (speakerName) {
          if (!characterMap.has(speakerName)) {
            characterMap.set(speakerName, {
              id: `char_${speakerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              name: speakerName,
              color: defaultColors[colorIdx++ % defaultColors.length],
              font: parsed.font || 'Inter',
              size: parsed.size || 18,
              bold: false,
              italic: false,
            });
          }
          characterId = characterMap.get(speakerName)?.id;
        }

        result.push({
          id: `sub_${Date.now()}_${result.length}_${Math.random().toString(36).substring(2, 6)}`,
          lineNumber: result.length + 1,
          startTime: normalizeTimecode(startRaw),
          endTime: normalizeTimecode(endRaw),
          characterId,
          font: parsed.font,
          size: parsed.size,
          text: parsed.cleanText,
          bold: parsed.bold ?? false,
          italic: parsed.italic ?? false,
        });
      }
    }
  }

  return {
    lines: result,
    newCharacters: Array.from(characterMap.values()),
  };
}

/**
 * Parse SRT format (SubRip)
 */
export function parseSRT(content: string): Partial<SubtitleLine>[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const result: Partial<SubtitleLine>[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].trim().split('\n');
    if (lines.length < 2) continue;

    let timeIndex = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      timeIndex = 1;
    }

    const timeLine = lines[timeIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);
    const rawText = lines.slice(timeIndex + 1).join('\n');
    const parsed = parseAndCleanSubtitleText(rawText);

    result.push({
      id: `sub_${Date.now()}_${result.length}_${Math.random().toString(36).substring(2, 6)}`,
      lineNumber: result.length + 1,
      startTime: normalizeTimecode(startRaw),
      endTime: normalizeTimecode(endRaw),
      text: parsed.cleanText,
      font: parsed.font,
      size: parsed.size,
      bold: parsed.bold ?? false,
      italic: parsed.italic ?? false,
    });
  }

  return result;
}

/**
 * Parse WebVTT format
 */
export function parseVTT(content: string): { lines: Partial<SubtitleLine>[]; newCharacters: Character[] } {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const result: Partial<SubtitleLine>[] = [];
  const characterMap = new Map<string, Character>();
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  let colorIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [startRaw, endRaw] = line.split('-->').map((s) => s.trim().split(' ')[0]);
      let textLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '') {
        textLines.push(lines[j]);
        j++;
      }
      i = j;

      let fullText = textLines.join('\n');
      let characterId: string | undefined = undefined;

      // Check for voice tag <v SpeakerName>
      const voiceMatch = fullText.match(/<v\s+([^>]+)>(.*?)(?:<\/v>|$)/is);
      if (voiceMatch) {
        const speaker = voiceMatch[1].trim();
        fullText = voiceMatch[2].trim();
        if (!characterMap.has(speaker)) {
          characterMap.set(speaker, {
            id: `char_${speaker.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name: speaker,
            color: defaultColors[colorIdx++ % defaultColors.length],
            font: 'Inter',
            size: 18,
            bold: false,
            italic: false,
          });
        }
        characterId = characterMap.get(speaker)?.id;
      }

      let isBold = /<b>.*?<\/b>/is.test(fullText);
      let isItalic = /<i>.*?<\/i>/is.test(fullText);
      const parsed = parseAndCleanSubtitleText(fullText);

      result.push({
        id: `sub_${Date.now()}_${result.length}_${Math.random().toString(36).substring(2, 6)}`,
        lineNumber: result.length + 1,
        startTime: normalizeTimecode(startRaw),
        endTime: normalizeTimecode(endRaw),
        characterId,
        font: parsed.font,
        size: parsed.size,
        text: parsed.cleanText,
        bold: parsed.bold ?? isBold,
        italic: parsed.italic ?? isItalic,
      });
    }
  }

  return {
    lines: result,
    newCharacters: Array.from(characterMap.values()),
  };
}

/**
 * Parse YouTube SBV format (0:00:01.000,0:00:03.000\nText)
 */
export function parseSBV(content: string): Partial<SubtitleLine>[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const result: Partial<SubtitleLine>[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].trim().split('\n');
    if (lines.length < 2) continue;

    const timeLine = lines[0].trim();
    if (!timeLine.includes(',')) continue;

    const [startRaw, endRaw] = timeLine.split(',').map((s) => s.trim());
    if (!startRaw || !endRaw) continue;

    const text = lines.slice(1).join('\n').trim();
    const parsed = parseAndCleanSubtitleText(text);

    result.push({
      id: `sub_${Date.now()}_${result.length}_${Math.random().toString(36).substring(2, 6)}`,
      lineNumber: result.length + 1,
      startTime: normalizeTimecode(startRaw),
      endTime: normalizeTimecode(endRaw),
      text: parsed.cleanText,
      font: parsed.font,
      size: parsed.size,
      bold: parsed.bold ?? false,
      italic: parsed.italic ?? false,
    });
  }

  return result;
}

/**
 * Parse Timed Lyrics (LRC)
 */
export function parseLRC(content: string): Partial<SubtitleLine>[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const rawItems: { timeSec: number; text: string }[] = [];

  for (let line of lines) {
    line = line.trim();
    const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d+))?\](.*)$/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const frac = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalSec = min * 60 + sec + frac;
      const text = match[4].trim();
      if (text) {
        rawItems.push({ timeSec: totalSec, text });
      }
    }
  }

  rawItems.sort((a, b) => a.timeSec - b.timeSec);

  const result: Partial<SubtitleLine>[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const cur = rawItems[i];
    const next = rawItems[i + 1];
    const endSec = next ? next.timeSec : cur.timeSec + 3.0;

    result.push({
      id: `sub_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      lineNumber: i + 1,
      startTime: secondsToTimecode(cur.timeSec),
      endTime: secondsToTimecode(endSec),
      text: cur.text,
      bold: false,
      italic: false,
    });
  }

  return result;
}

/**
 * Parse CSV format
 */
export function parseCSV(content: string): Partial<SubtitleLine>[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse CSV line taking quotes into account
  const parseRow = (line: string): string[] => {
    const res: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c of line) {
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim());
    return res.map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
  };

  const header = parseRow(lines[0]).map((h) => h.toLowerCase());
  const startIdx = header.findIndex((h) => h.includes('start'));
  const endIdx = header.findIndex((h) => h.includes('end'));
  const textIdx = header.findIndex((h) => h.includes('text') || h.includes('dialogue') || h.includes('content'));

  if (startIdx === -1 || textIdx === -1) return [];

  const charIdx = header.findIndex((h) => h.includes('char') || h.includes('speaker'));
  const fontIdx = header.findIndex((h) => h.includes('font'));
  const boldIdx = header.findIndex((h) => h.includes('bold'));
  const italicIdx = header.findIndex((h) => h.includes('italic'));

  const result: Partial<SubtitleLine>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length <= textIdx) continue;

    const start = normalizeTimecode(row[startIdx]);
    const end = endIdx !== -1 && row[endIdx] ? normalizeTimecode(row[endIdx]) : secondsToTimecode(timecodeToSeconds(start) + 2.5);
    const parsed = parseAndCleanSubtitleText(row[textIdx] || '');

    result.push({
      id: `sub_${Date.now()}_${result.length}_${Math.random().toString(36).substring(2, 6)}`,
      lineNumber: result.length + 1,
      startTime: start,
      endTime: end,
      characterId: charIdx !== -1 ? row[charIdx] : undefined,
      font: (fontIdx !== -1 && row[fontIdx]) ? row[fontIdx] : parsed.font,
      size: parsed.size,
      bold: boldIdx !== -1 ? row[boldIdx].toLowerCase() === 'true' : (parsed.bold ?? false),
      italic: italicIdx !== -1 ? row[italicIdx].toLowerCase() === 'true' : (parsed.italic ?? false),
      text: parsed.cleanText,
    });
  }

  return result;
}

/**
 * Universal Subtitle Parser:
 * Automatically inspects content, headers, and extensions, and parses ANY subtitle format:
 * SRT, ASS/SSA, WebVTT, SBV, JSON, CSV/TSV, LRC, TTML/XML, or Plain Timestamps.
 */
export function parseAnySubtitle(
  content: string,
  filename?: string
): {
  lines: SubtitleLine[];
  newCharacters?: Character[];
  fullProject?: SubtitleProject;
  detectedFormat: string;
} {
  const trimmed = content.trim();
  const ext = filename ? filename.split('.').pop()?.toLowerCase() : '';

  // 1. Full Subflow JSON or raw SubtitleProject JSON
  if (trimmed.startsWith('{') && (trimmed.includes('"lines"') || trimmed.includes('"title"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.lines && Array.isArray(parsed.lines)) {
        return {
          lines: parsed.lines,
          newCharacters: parsed.characters || [],
          fullProject: parsed,
          detectedFormat: 'JSON Project',
        };
      }
    } catch {
      // Fall through if invalid JSON
    }
  }

  // 2. ASS / SSA format
  if (
    ext === 'ass' ||
    ext === 'ssa' ||
    trimmed.includes('[Script Info]') ||
    trimmed.includes('[V4+ Styles]') ||
    trimmed.includes('[V4 Styles]') ||
    (trimmed.includes('[Events]') && trimmed.includes('Dialogue:'))
  ) {
    const { lines: partialLines, newCharacters } = parseASS(trimmed);
    if (partialLines.length > 0) {
      const lines: SubtitleLine[] = partialLines.map((p, i) => ({
        id: p.id || `sub_${Date.now()}_${i}`,
        lineNumber: i + 1,
        startTime: p.startTime || '00:00:00.000',
        endTime: p.endTime || '00:00:02.000',
        characterId: p.characterId,
        font: p.font,
        size: p.size,
        bold: p.bold ?? false,
        italic: p.italic ?? false,
        text: p.text || '',
      }));
      return { lines, newCharacters, detectedFormat: 'ASS / SSA' };
    }
  }

  // 3. WebVTT format
  if (ext === 'vtt' || trimmed.startsWith('WEBVTT') || trimmed.includes('WEBVTT\n')) {
    const { lines: partialLines, newCharacters } = parseVTT(trimmed);
    if (partialLines.length > 0) {
      const lines: SubtitleLine[] = partialLines.map((p, i) => ({
        id: p.id || `sub_${Date.now()}_${i}`,
        lineNumber: i + 1,
        startTime: p.startTime || '00:00:00.000',
        endTime: p.endTime || '00:00:02.000',
        characterId: p.characterId,
        bold: p.bold ?? false,
        italic: p.italic ?? false,
        text: p.text || '',
      }));
      return { lines, newCharacters, detectedFormat: 'WebVTT' };
    }
  }

  // 4. YouTube SBV format
  if (ext === 'sbv' || /^\d{1,2}:\d{2}:\d{2}\.\d+,\d{1,2}:\d{2}:\d{2}\.\d+/m.test(trimmed)) {
    const partialLines = parseSBV(trimmed);
    if (partialLines.length > 0) {
      const lines: SubtitleLine[] = partialLines.map((p, i) => ({
        id: p.id || `sub_${Date.now()}_${i}`,
        lineNumber: i + 1,
        startTime: p.startTime || '00:00:00.000',
        endTime: p.endTime || '00:00:02.000',
        bold: false,
        italic: false,
        text: p.text || '',
      }));
      return { lines, detectedFormat: 'YouTube SBV' };
    }
  }

  // 5. LRC Lyrics
  if (ext === 'lrc' || /^\[\d{2}:\d{2}\.\d{2,3}\]/m.test(trimmed)) {
    const partialLines = parseLRC(trimmed);
    if (partialLines.length > 0) {
      const lines: SubtitleLine[] = partialLines.map((p, i) => ({
        id: p.id || `sub_${Date.now()}_${i}`,
        lineNumber: i + 1,
        startTime: p.startTime || '00:00:00.000',
        endTime: p.endTime || '00:00:02.000',
        bold: false,
        italic: false,
        text: p.text || '',
      }));
      return { lines, detectedFormat: 'LRC Lyrics' };
    }
  }

  // 6. CSV / TSV
  if (ext === 'csv' || ext === 'tsv' || (trimmed.includes(',') && trimmed.toLowerCase().includes('start') && trimmed.toLowerCase().includes('text'))) {
    const partialLines = parseCSV(trimmed);
    if (partialLines.length > 0) {
      const lines: SubtitleLine[] = partialLines.map((p, i) => ({
        id: p.id || `sub_${Date.now()}_${i}`,
        lineNumber: i + 1,
        startTime: p.startTime || '00:00:00.000',
        endTime: p.endTime || '00:00:02.000',
        characterId: p.characterId,
        font: p.font,
        size: p.size,
        bold: p.bold ?? false,
        italic: p.italic ?? false,
        text: p.text || '',
      }));
      return { lines, detectedFormat: 'CSV Spreadsheet' };
    }
  }

  // 7. SRT format (Standard SubRip or loose timecode format)
  const parsedSrt = parseSRT(trimmed);
  if (parsedSrt.length > 0) {
    const lines: SubtitleLine[] = parsedSrt.map((p, i) => ({
      id: p.id || `sub_${Date.now()}_${i}`,
      lineNumber: i + 1,
      startTime: p.startTime || '00:00:00.000',
      endTime: p.endTime || '00:00:02.000',
      bold: p.bold ?? false,
      italic: p.italic ?? false,
      text: p.text || '',
    }));
    return { lines, detectedFormat: 'SRT (SubRip)' };
  }

  // 8. Universal Fallback: regex scan for any timestamp pairs (HH:MM:SS - HH:MM:SS or HH:MM:SS --> HH:MM:SS)
  const fallbackRegex = /(\d{1,2}:\d{2}:\d{2}[\.,]?\d*)\s*(?:-->|-|to)\s*(\d{1,2}:\d{2}:\d{2}[\.,]?\d*)/g;
  let match: RegExpExecArray | null;
  const fallbackLines: SubtitleLine[] = [];
  const allLines = trimmed.split('\n');

  for (let i = 0; i < allLines.length; i++) {
    const l = allLines[i].trim();
    fallbackRegex.lastIndex = 0;
    match = fallbackRegex.exec(l);
    if (match) {
      const start = normalizeTimecode(match[1]);
      const end = normalizeTimecode(match[2]);
      let dialogue = l.replace(match[0], '').trim();
      // If dialogue is empty on same line, look ahead
      if (!dialogue && i + 1 < allLines.length && !fallbackRegex.test(allLines[i + 1])) {
        dialogue = allLines[i + 1].trim();
        i++;
      }

      fallbackLines.push({
        id: `sub_${Date.now()}_${fallbackLines.length}_${Math.random().toString(36).substring(2, 6)}`,
        lineNumber: fallbackLines.length + 1,
        startTime: start,
        endTime: end,
        bold: false,
        italic: false,
        text: dialogue || 'Untitled dialogue',
      });
    }
  }

  if (fallbackLines.length > 0) {
    return { lines: fallbackLines, detectedFormat: 'Auto-detected Timestamps' };
  }

  throw new Error(
    'Unable to recognize subtitle format. Supported formats: SRT, ASS, SSA, WebVTT, YouTube SBV, JSON, CSV, LRC, and timestamped text.'
  );
}
