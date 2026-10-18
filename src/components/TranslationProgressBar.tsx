import React from 'react';
import { Sparkles, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { getLanguageByCode } from '../utils/languages';
import { SubtitleTrackType } from '../types/subtitle';

export interface TranslationProgressState {
  active: boolean;
  targetLang: string;
  targetType: SubtitleTrackType;
  totalLines: number;
  completedLines: number;
  percent: number;
  status: 'translating' | 'completed' | 'error';
  error?: string;
}

interface TranslationProgressBarProps {
  progress: TranslationProgressState | null;
  onCancel?: () => void;
  onDismiss?: () => void;
}

export const TranslationProgressBar: React.FC<TranslationProgressBarProps> = ({
  progress,
  onCancel,
  onDismiss,
}) => {
  if (!progress || !progress.active) return null;

  const langObj = getLanguageByCode(progress.targetLang);
  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';

  return (
    <div className="w-full shrink-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)] shadow-md animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-col gap-1.5">
        {/* Top Info Row */}
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Left: Icon, Language & Status */}
          <div className="flex items-center gap-2 min-w-0">
            {isCompleted ? (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : isError ? (
              <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
              </div>
            )}

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[var(--text-main)] truncate">
                {isCompleted ? (
                  <>Translation Complete</>
                ) : isError ? (
                  <>Translation Error</>
                ) : (
                  <>
                    Translating to{' '}
                    <span className="text-[var(--accent)] font-bold">
                      {langObj.name} ({langObj.nativeName})
                    </span>
                    <span className="text-[10px] ml-1 px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] border border-[var(--border-light)] font-mono text-[var(--text-muted)]">
                      {progress.targetType}
                    </span>
                  </>
                )}
              </span>

              {!isCompleted && !isError && (
                <span className="hidden md:inline-block text-[10.5px] text-[var(--text-faint)] italic truncate">
                  — Preserving dialogue nuance, character voice, and timing
                </span>
              )}

              {isCompleted && (
                <span className="text-[11px] text-emerald-400 font-medium">
                  — All {progress.totalLines.toLocaleString()} lines successfully localized!
                </span>
              )}

              {isError && (
                <span className="text-[11px] text-red-400 truncate">
                  {progress.error || 'A problem occurred while translating'}
                </span>
              )}
            </div>
          </div>

          {/* Right: Counter, Percent & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 text-right">
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                <span className="font-bold text-[var(--text-main)]">
                  {progress.completedLines.toLocaleString()}
                </span>{' '}
                / {progress.totalLines.toLocaleString()} lines
              </span>

              <span
                className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isError
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                }`}
              >
                {progress.percent}%
              </span>
            </div>

            {!isCompleted && !isError && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-2 py-0.5 rounded text-[11px] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 border border-[var(--border-light)] transition-colors cursor-pointer"
                title="Cancel translation"
              >
                Cancel
              </button>
            )}

            {(isCompleted || isError) && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-light)] overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out rounded-full ${
              isCompleted
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : isError
                ? 'bg-red-500'
                : 'bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, progress.percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
