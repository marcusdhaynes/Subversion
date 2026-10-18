import React, { useState } from 'react';
import { SubtitleLine, SubtitleTrackType } from '../types/subtitle';
import { Sparkles, Languages, Check, X, Loader2, ArrowRight, Layers, Database } from 'lucide-react';
import { getLanguageByCode } from '../utils/languages';

interface AutoTranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceLang: string;
  targetLang: string;
  sourceType: SubtitleTrackType;
  targetType: SubtitleTrackType;
  projectTitle: string;
  primaryLines: SubtitleLine[];
  linkedCcLines?: SubtitleLine[];
  onConfirmTranslate: (options: {
    translatePrimary: boolean;
    translateLinkedCc: boolean;
  }) => Promise<void>;
  onStartBlank: () => void;
}

export const AutoTranslateModal: React.FC<AutoTranslateModalProps> = ({
  isOpen,
  onClose,
  sourceLang,
  targetLang,
  sourceType,
  targetType,
  projectTitle,
  primaryLines,
  linkedCcLines,
  onConfirmTranslate,
  onStartBlank,
}) => {
  const [includeLinkedCc, setIncludeLinkedCc] = useState<boolean>(true);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');

  if (!isOpen) return null;

  const srcLangObj = getLanguageByCode(sourceLang);
  const tgtLangObj = getLanguageByCode(targetLang);

  const hasLinkedCc = linkedCcLines && linkedCcLines.length > 0;
  const isTypeSwitchOnly = sourceLang.toLowerCase() === targetLang.toLowerCase();

  const handleTranslate = async () => {
    setIsTranslating(true);
    setProgressStatus(`Translating ${primaryLines.length} lines to ${tgtLangObj.name}...`);
    try {
      if (hasLinkedCc && includeLinkedCc) {
        setProgressStatus(`Translating primary dialogue & linked CC track to ${tgtLangObj.name}...`);
      }
      await onConfirmTranslate({
        translatePrimary: true,
        translateLinkedCc: Boolean(hasLinkedCc && includeLinkedCc),
      });
      onClose();
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setIsTranslating(false);
      setProgressStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-main)]">
                {isTypeSwitchOnly ? 'Auto-Generate Track Type' : 'Auto-Translate Subtitles'}
              </h2>
              <p className="text-[10px] text-[var(--text-faint)] truncate max-w-[240px]">
                {projectTitle}
              </p>
            </div>
          </div>
          {!isTranslating && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Language / Type Transition Pill */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--bg-hover)] flex items-center justify-center font-mono font-bold text-[10px] text-[var(--text-main)]">
                {sourceLang.toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-[11px] text-[var(--text-main)]">{srcLangObj.name}</div>
                <div className="text-[9.5px] text-[var(--text-faint)]">{sourceType} Track</div>
              </div>
            </div>

            <div className="flex flex-col items-center px-2">
              <ArrowRight className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-[9px] font-mono text-[var(--text-faint)] uppercase">Translate</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center font-mono font-bold text-[10px]">
                {targetLang.toUpperCase()}
              </div>
              <div className="text-right">
                <div className="font-medium text-[11px] text-[var(--text-main)]">{tgtLangObj.name}</div>
                <div className="text-[9.5px] text-[var(--accent)] font-semibold">{targetType} Track</div>
              </div>
            </div>
          </div>

          {/* Description prompt */}
          <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">
            {isTypeSwitchOnly
              ? `There is a primary subtitle track in ${srcLangObj.name}. Would you like the app to auto-generate sound cues and adapt it into a ${targetType} track?`
              : `A primary subtitle file is linked for this project in ${srcLangObj.name} (${primaryLines.length} lines). Would you like to automatically translate all subtitles into ${tgtLangObj.name}?`}
          </p>

          {/* Linked CC Option if available */}
          {hasLinkedCc && !isTypeSwitchOnly && (
            <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)]/40 border border-[var(--accent)]/20 space-y-1.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLinkedCc}
                  onChange={(e) => setIncludeLinkedCc(e.target.checked)}
                  disabled={isTranslating}
                  className="mt-0.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <div className="text-[11px]">
                  <span className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-[var(--accent)]" />
                    Also translate linked CC track ({linkedCcLines?.length || 0} lines)
                  </span>
                  <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
                    Translates both Normal and Closed Captions tracks and links them together under the project in the database.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Database organization reminder */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--text-faint)] font-mono">
            <Database className="w-3 h-3 text-[var(--accent)]" />
            <span>Translations are organized and saved automatically into the Media Database.</span>
          </div>

          {/* Progress Indicator */}
          {isTranslating && (
            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--accent)]/30 flex items-center gap-2.5 text-[var(--accent)]">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium truncate">{progressStatus}</div>
                {primaryLines.length > 200 && (
                  <div className="text-[9.5px] text-[var(--text-faint)] mt-0.5">
                    Processing {primaryLines.length} lines in parallel batches with Gemini 3.1 Flash-Lite AI (~15-25s)...
                  </div>
                )}
                <div className="h-1 bg-[var(--bg-hover)] rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-subtle)] border-t border-[var(--border)] gap-2">
          <button
            type="button"
            onClick={() => {
              onStartBlank();
              onClose();
            }}
            disabled={isTranslating}
            className="px-2.5 py-1.5 text-[11px] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            Start Blank Track
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isTranslating}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="px-3.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--accent)] hover:opacity-90 text-[var(--accent-contrast)] shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Translate with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
