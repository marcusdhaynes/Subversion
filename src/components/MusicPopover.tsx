import React, { useEffect, useRef, useState } from 'react';
import { Music, X, Volume2, Sparkles, Check, Slash } from 'lucide-react';
import { useInactivityAutoClose } from '../hooks/useInactivityAutoClose';
import {
  MUSIC_SYMBOLS,
  MusicSymbol,
  MusicPlacement,
  detectMusicState,
  applyMusic,
  stripMusicSymbols,
} from '../utils/musicSymbols';

interface MusicPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { top: number; left: number };
  title?: string;
  initialText?: string;
  onApply: (symbol: MusicSymbol, placement: MusicPlacement) => void;
}

export const MusicPopover: React.FC<MusicPopoverProps> = ({
  isOpen,
  onClose,
  position,
  title = 'Music Notes',
  initialText = '',
  onApply,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const initialDetection = detectMusicState(initialText);
  const [selectedSymbol, setSelectedSymbol] = useState<MusicSymbol>(initialDetection.symbol);
  const [selectedPlacement, setSelectedPlacement] = useState<MusicPlacement>(
    initialDetection.hasMusic ? initialDetection.placement : 'both'
  );
  const [isMusicActive, setIsMusicActive] = useState<boolean>(initialDetection.hasMusic);

  // 5-second inactivity auto-close with natural smooth fade-out
  const { isClosing, progress, resetTimer } = useInactivityAutoClose({
    isOpen,
    timeoutMs: 5000,
    onClose,
    containerRef: popoverRef,
  });

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectSymbol = (sym: MusicSymbol) => {
    resetTimer();
    if (isMusicActive && selectedSymbol === sym) {
      // Toggle off: Click once on, click again off
      setIsMusicActive(false);
      setSelectedPlacement('none');
      onApply(sym, 'none');
      return;
    }
    // Toggle on or switch symbol
    setSelectedSymbol(sym);
    setIsMusicActive(true);
    const placement = selectedPlacement === 'none' ? 'both' : selectedPlacement;
    setSelectedPlacement(placement);
    onApply(sym, placement);
  };

  const handleSelectPlacement = (pl: MusicPlacement) => {
    resetTimer();
    if (isMusicActive && selectedPlacement === pl) {
      // Toggle off: Click once on, click again off
      setIsMusicActive(false);
      setSelectedPlacement('none');
      onApply(selectedSymbol, 'none');
      return;
    }
    setSelectedPlacement(pl);
    if (pl === 'none') {
      setIsMusicActive(false);
      onApply(selectedSymbol, 'none');
    } else {
      setIsMusicActive(true);
      onApply(selectedSymbol, pl);
    }
  };

  const handleToggleOff = () => {
    resetTimer();
    if (isMusicActive) {
      setIsMusicActive(false);
      setSelectedPlacement('none');
      onApply(selectedSymbol, 'none');
    } else {
      setIsMusicActive(true);
      setSelectedPlacement('both');
      onApply(selectedSymbol, 'both');
    }
  };

  const cleanSample = stripMusicSymbols(initialText) || 'Lyrics sample';
  const previewText = isMusicActive
    ? applyMusic(cleanSample, selectedSymbol, selectedPlacement)
    : cleanSample;

  // Position adjustments to stay fully on screen
  const top = position ? Math.min(position.top, window.innerHeight - 240) : 100;
  const left = position ? Math.max(10, Math.min(position.left, window.innerWidth - 250)) : 100;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${Math.max(10, top)}px`,
        left: `${left}px`,
        zIndex: 9999,
      }}
      className={`w-[230px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2.5 text-xs select-none font-sans relative overflow-hidden transition-all duration-280 ${
        isClosing
          ? 'opacity-0 scale-95 translate-y-1 pointer-events-none'
          : 'animate-in fade-in zoom-in-95 duration-100 opacity-100 scale-100'
      }`}
    >
      {/* 5-second inactivity subtle progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-light)] overflow-hidden rounded-b-xl pointer-events-none">
        <div
          className="h-full bg-[var(--accent)] opacity-40 transition-[width] duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--text-main)] truncate">
          <Music className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          <span className="truncate">{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-sm text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Row 1: Symbol Choice */}
      <div className="mb-2">
        <label className="block text-[9px] font-mono uppercase text-[var(--text-muted)] mb-1">
          Note Symbol
        </label>
        <div className="grid grid-cols-4 gap-1">
          {MUSIC_SYMBOLS.map((sym) => {
            const isSelected = isMusicActive && selectedSymbol === sym;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => handleSelectSymbol(sym)}
                aria-pressed={isSelected}
                className={`h-7 rounded flex items-center justify-center text-sm font-semibold transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs font-bold ring-1 ring-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)]'
                }`}
                title={isSelected ? `${sym} (Active — Click to toggle OFF)` : `Use ${sym} (Click to toggle ON)`}
              >
                {sym}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Placement (Both, Start, End, None) */}
      <div className="mb-2">
        <label className="block text-[9px] font-mono uppercase text-[var(--text-muted)] mb-1">
          Placement
        </label>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => handleSelectPlacement('both')}
            aria-pressed={isMusicActive && selectedPlacement === 'both'}
            className={`h-6 rounded text-[10px] font-medium transition-all cursor-pointer border px-1 truncate flex items-center justify-center ${
              isMusicActive && selectedPlacement === 'both'
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs font-bold ring-1 ring-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={
              isMusicActive && selectedPlacement === 'both'
                ? 'Both sides (Active — Click to toggle OFF)'
                : 'Place music notes on both sides'
            }
          >
            {selectedSymbol} Both {selectedSymbol}
          </button>

          <button
            type="button"
            onClick={() => handleSelectPlacement('start')}
            aria-pressed={isMusicActive && selectedPlacement === 'start'}
            className={`h-6 rounded text-[10px] font-medium transition-all cursor-pointer border px-1 truncate flex items-center justify-center ${
              isMusicActive && selectedPlacement === 'start'
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs font-bold ring-1 ring-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={
              isMusicActive && selectedPlacement === 'start'
                ? 'Start only (Active — Click to toggle OFF)'
                : 'Place music note at start only'
            }
          >
            {selectedSymbol} Start
          </button>

          <button
            type="button"
            onClick={() => handleSelectPlacement('end')}
            aria-pressed={isMusicActive && selectedPlacement === 'end'}
            className={`h-6 rounded text-[10px] font-medium transition-all cursor-pointer border px-1 truncate flex items-center justify-center ${
              isMusicActive && selectedPlacement === 'end'
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs font-bold ring-1 ring-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={
              isMusicActive && selectedPlacement === 'end'
                ? 'End only (Active — Click to toggle OFF)'
                : 'Place music note at end only'
            }
          >
            End {selectedSymbol}
          </button>
        </div>
      </div>

      {/* Row 3: Quick Preview & Remove Button */}
      <div className="pt-1.5 border-t border-[var(--border)] flex items-center justify-between gap-1.5">
        <div className="flex-1 min-w-0 font-mono text-[10px] text-[var(--text-muted)] truncate bg-[var(--bg-subtle)] px-1.5 py-1 rounded border border-[var(--border-light)]">
          {previewText}
        </div>

        <button
          type="button"
          onClick={handleToggleOff}
          className={`h-6 px-2 rounded text-[10px] font-medium transition-all cursor-pointer border flex items-center gap-1 shrink-0 ${
            !isMusicActive
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
              : 'border-[var(--border)] bg-[var(--bg-subtle)] text-rose-500 hover:bg-rose-500/10 hover:border-rose-500'
          }`}
          title={isMusicActive ? 'Remove music notes' : 'Enable music notes'}
        >
          {isMusicActive ? 'Remove' : 'Add ♪'}
        </button>
      </div>
    </div>
  );
};
