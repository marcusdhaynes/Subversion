/**
 * Timecode formatting and calculation utilities for SubFlow Studio
 */

export function padZero(num: number, size = 2): string {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}

export function formatLineNumber(num: number): string {
  return padZero(num, 4);
}

export function formatFolderLineNumber(num: number): string {
  const n = Math.max(1, Math.floor(isNaN(num) ? 1 : num));
  return String(n).padStart(2, '0').slice(-2);
}

/**
 * Converts milliseconds or seconds to HH:MM:SS.mmm format
 */
export function secondsToTimecode(totalSeconds: number, separator = '.'): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((totalSeconds % 1) * 1000);

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}${separator}${padZero(millis, 3)}`;
}

/**
 * Parses HH:MM:SS.mmm, HH:MM:SS,mmm, or MM:SS.mmm into total seconds
 */
export function timecodeToSeconds(tc: string): number {
  if (!tc || typeof tc !== 'string') return 0;
  const clean = tc.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else {
    return parseFloat(clean) || 0;
  }
}

/**
 * Normalizes input timecode to HH:MM:SS.mmm
 */
export function normalizeTimecode(input: string): string {
  const sec = timecodeToSeconds(input);
  return secondsToTimecode(sec);
}

/**
 * Calculate duration between start and end
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = timecodeToSeconds(startTime);
  const end = timecodeToSeconds(endTime);
  return Math.max(0, end - start);
}

/**
 * Calculate Characters Per Second (CPS)
 */
export function calculateCps(text: string, startTime: string, endTime: string): number {
  const duration = calculateDuration(startTime, endTime);
  if (duration <= 0.1) return 0;
  // Strip tags if any and trim
  const cleanLen = text.trim().length;
  return Number((cleanLen / duration).toFixed(1));
}

/**
 * Check if timecodes overlap between line A and line B
 */
export function hasOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = timecodeToSeconds(startA);
  const eA = timecodeToSeconds(endA);
  const sB = timecodeToSeconds(startB);
  const eB = timecodeToSeconds(endB);
  return sA < eB && sB < eA;
}
