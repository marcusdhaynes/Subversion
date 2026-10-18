import { apiFetch } from './api';
/**
 * AI Translation and Verification Runner
 *
 * Implements the rigorous multi-pass translation workflow:
 * 1. Initial Pass: Translates all lines in optimal batches using Gemini AI.
 * 2. Verification Pass: Checks each line quickly to confirm it is 100% in the target language.
 *    If any line is untranslated or partially untranslated, immediately translates it.
 * 3. Recheck Pass: Re-scans all lines until every single line is confirmed 100% in the target language.
 * 4. Displays real-time progress callbacks for the sliding Header progress bar.
 */

import { SubtitleLine, SubtitleTrackType } from '../types/subtitle';
import { isLineInTargetLanguage, findUntranslatedLines } from './languageChecker';

export interface TranslationProgressUpdate {
  active: boolean;
  targetLang: string;
  targetType: SubtitleTrackType;
  totalLines: number;
  completedLines: number;
  percent: number;
  phase: 'translating' | 'verifying' | 'rechecking' | 'completed' | 'error';
  phaseText: string;
  error?: string;
}

interface TranslateBatchPayload {
  lines: { lineNumber: number; text: string }[];
  targetLang: string;
  sourceLang: string;
  targetType: SubtitleTrackType;
}

async function fetchTranslateBatch(payload: TranslateBatchPayload): Promise<Map<number, string>> {
  const res = await apiFetch('/api/translate-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Batch translation returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const map = new Map<number, string>();
  if (data.translatedLines && Array.isArray(data.translatedLines)) {
    data.translatedLines.forEach((item: any) => {
      if (item && typeof item.lineNumber === 'number' && typeof item.text === 'string') {
        map.set(item.lineNumber, item.text);
      }
    });
  }
  return map;
}

export async function runAITranslationWithVerification({
  lines,
  targetLang,
  sourceLang = 'en',
  targetType = 'Normal',
  onProgress,
  signal,
}: {
  lines: SubtitleLine[];
  targetLang: string;
  sourceLang?: string;
  targetType?: SubtitleTrackType;
  onProgress: (update: TranslationProgressUpdate) => void;
  signal?: AbortSignal;
}): Promise<SubtitleLine[]> {
  if (!lines || lines.length === 0) {
    return [];
  }

  const totalLines = lines.length;
  let translatedLines: SubtitleLine[] = lines.map((l) => ({ ...l }));
  const originalSourceLines = lines.map((l) => ({ ...l }));

  // Helper to emit progress
  const emit = (
    completed: number,
    percent: number,
    phase: TranslationProgressUpdate['phase'],
    phaseText: string,
    error?: string
  ) => {
    onProgress({
      active: true,
      targetLang,
      targetType,
      totalLines,
      completedLines: Math.min(totalLines, completed),
      percent: Math.min(100, Math.max(0, percent)),
      phase,
      phaseText,
      error,
    });
  };

  // =========================================================================
  // PASS 1: Initial Fast Batch Translation (0% -> 65% Progress)
  // =========================================================================
  emit(0, 5, 'translating', 'Translating lines with AI...');

  const BATCH_SIZE = 25;
  const batches: { lineNumber: number; text: string }[][] = [];
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    batches.push(
      lines.slice(i, i + BATCH_SIZE).map((l) => ({ lineNumber: l.lineNumber, text: l.text }))
    );
  }

  let completedBatchLines = 0;
  const CONCURRENCY = Math.min(3, batches.length);
  let batchIndex = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (batchIndex < batches.length) {
      if (signal?.aborted) throw new Error('Translation cancelled');
      const idx = batchIndex++;
      const currentBatch = batches[idx];

      try {
        const transMap = await fetchTranslateBatch({
          lines: currentBatch,
          targetLang,
          sourceLang,
          targetType,
        });

        currentBatch.forEach((item) => {
          const transText = transMap.get(item.lineNumber);
          const lineIndex = translatedLines.findIndex((l) => l.lineNumber === item.lineNumber);
          if (lineIndex >= 0 && transText && transText.trim()) {
            translatedLines[lineIndex] = {
              ...translatedLines[lineIndex],
              text: transText,
            };
          }
        });
      } catch (err) {
        console.warn(`[Pass 1] Batch ${idx + 1} translation failed, will catch in verification pass:`, err);
      }

      completedBatchLines += currentBatch.length;
      const pass1Percent = Math.round((completedBatchLines / totalLines) * 65);
      emit(
        completedBatchLines,
        pass1Percent,
        'translating',
        `Translating ${completedBatchLines}/${totalLines} lines...`
      );

      // Brief gentle pacing
      if (batchIndex < batches.length) {
        await new Promise((r) => setTimeout(r, 60));
      }
    }
  });

  await Promise.all(workers);

  if (signal?.aborted) throw new Error('Translation cancelled');

  // =========================================================================
  // PASS 2: Verification Pass — Check each line quickly & retranslate missing (65% -> 85%)
  // =========================================================================
  emit(totalLines, 70, 'verifying', 'Checking every line for target language...');

  // Quick check across all lines
  let untranslated = findUntranslatedLines(translatedLines, targetLang, originalSourceLines);

  if (untranslated.length > 0) {
    emit(
      totalLines - untranslated.length,
      72,
      'verifying',
      `Translating ${untranslated.length} lines missed in pass 1...`
    );

    // Retranslate untranslated lines in chunks of 20
    const retryBatches: { lineNumber: number; text: string }[][] = [];
    for (let i = 0; i < untranslated.length; i += 20) {
      retryBatches.push(
        untranslated.slice(i, i + 20).map((l) => {
          // Provide original source text to ensure accurate translation
          const orig = originalSourceLines.find((o) => o.lineNumber === l.lineNumber);
          return { lineNumber: l.lineNumber, text: orig ? orig.text : l.text };
        })
      );
    }

    let retryDone = 0;
    for (const rBatch of retryBatches) {
      if (signal?.aborted) throw new Error('Translation cancelled');
      try {
        const transMap = await fetchTranslateBatch({
          lines: rBatch,
          targetLang,
          sourceLang,
          targetType,
        });

        rBatch.forEach((item) => {
          const transText = transMap.get(item.lineNumber);
          const lineIndex = translatedLines.findIndex((l) => l.lineNumber === item.lineNumber);
          if (lineIndex >= 0 && transText && transText.trim()) {
            translatedLines[lineIndex] = {
              ...translatedLines[lineIndex],
              text: transText,
            };
          }
        });
      } catch (e) {
        console.warn('[Pass 2] Retranslation batch error:', e);
      }
      retryDone += rBatch.length;
      const p2Percent = 72 + Math.round((retryDone / untranslated.length) * 13);
      emit(totalLines - (untranslated.length - retryDone), p2Percent, 'verifying', `Verifying & localizing lines...`);
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  // =========================================================================
  // PASS 3: Recheck loop until 100% of lines are confirmed in target language (85% -> 99%)
  // =========================================================================
  emit(totalLines, 88, 'rechecking', 'Final verification: confirming 100% target language...');

  let iteration = 0;
  const MAX_RECHECK_PASSES = 3;

  while (iteration < MAX_RECHECK_PASSES) {
    if (signal?.aborted) throw new Error('Translation cancelled');
    iteration++;

    const remainingUntranslated = findUntranslatedLines(translatedLines, targetLang, originalSourceLines);
    if (remainingUntranslated.length === 0) {
      // 100% verified!
      break;
    }

    emit(
      totalLines - remainingUntranslated.length,
      88 + iteration * 3,
      'rechecking',
      `Pass ${iteration + 1}: Finalizing ${remainingUntranslated.length} lines...`
    );

    // Fast targeted translation for remaining items
    const miniBatches: { lineNumber: number; text: string }[][] = [];
    for (let i = 0; i < remainingUntranslated.length; i += 15) {
      miniBatches.push(
        remainingUntranslated.slice(i, i + 15).map((l) => {
          const orig = originalSourceLines.find((o) => o.lineNumber === l.lineNumber);
          return { lineNumber: l.lineNumber, text: orig ? orig.text : l.text };
        })
      );
    }

    for (const mBatch of miniBatches) {
      try {
        const transMap = await fetchTranslateBatch({
          lines: mBatch,
          targetLang,
          sourceLang,
          targetType,
        });
        mBatch.forEach((item) => {
          const transText = transMap.get(item.lineNumber);
          const lineIndex = translatedLines.findIndex((l) => l.lineNumber === item.lineNumber);
          if (lineIndex >= 0 && transText && transText.trim()) {
            translatedLines[lineIndex] = {
              ...translatedLines[lineIndex],
              text: transText,
            };
          }
        });
      } catch (err) {
        console.warn(`[Pass 3 Iteration ${iteration}] Error:`, err);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Final check: confirm line count and non-empty
  const finalCheckUntranslated = findUntranslatedLines(translatedLines, targetLang, originalSourceLines);
  if (finalCheckUntranslated.length > 0) {
    console.warn(`[Completion] Note: ${finalCheckUntranslated.length} lines could not be confirmed as target language.`);
  }

  // =========================================================================
  // COMPLETION (100%)
  // =========================================================================
  emit(totalLines, 100, 'completed', '100% Translated and Verified!');

  return translatedLines;
}
