import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ThemePreset } from '../types/theme';
import { Check, Sparkles, Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  isDark: boolean;
  currentTheme: ThemePreset;
  availableThemes: ThemePreset[];
  onToggle: () => void;
  onSelectTheme: (themeId: string) => void;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  isDark,
  currentTheme,
  availableThemes,
  onToggle,
  onSelectTheme,
  className = '',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdDelayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chargeCompleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const didTriggerHoldRef = useRef(false);
  const pointerStartTimeRef = useRef(0);

  // Close menu on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const clearHold = useCallback(() => {
    if (holdDelayTimerRef.current) {
      clearTimeout(holdDelayTimerRef.current);
      holdDelayTimerRef.current = null;
    }
    if (chargeIntervalRef.current) {
      clearInterval(chargeIntervalRef.current);
      chargeIntervalRef.current = null;
    }
    if (chargeCompleteTimerRef.current) {
      clearTimeout(chargeCompleteTimerRef.current);
      chargeCompleteTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => clearHold();
  }, [clearHold]);

  // Charging time starts only after the click is actually held for a half second or so (500ms)
  const HOLD_DELAY = 500;
  // Duration to charge up to 100% and open theme options once charging starts
  const CHARGE_DURATION = 400;

  // Pointer Down: wait for half-second hold before charging starts
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary button
    if (e.button !== 0 && e.button !== -1) return;

    // If the menu is already open, tapping the toggle will close it
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }

    pointerStartTimeRef.current = Date.now();
    didTriggerHoldRef.current = false;
    clearHold();

    // The charging time for opening the theme options should ONLY start after the click is actually "held" for a half second or so
    holdDelayTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      setHoldProgress(0);
      const chargeStartTime = Date.now();

      chargeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - chargeStartTime;
        const progress = Math.min(100, (elapsed / CHARGE_DURATION) * 100);
        setHoldProgress(progress);
      }, 16);

      chargeCompleteTimerRef.current = setTimeout(() => {
        clearHold();
        didTriggerHoldRef.current = true;
        setIsMenuOpen(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(28);
        }
      }, CHARGE_DURATION);
    }, HOLD_DELAY);
  };

  // Pointer Up: instantaneous toggle on click, or opens theme options on completed hold
  const handlePointerUp = () => {
    const wasTriggeredByHold = didTriggerHoldRef.current;
    const elapsed = Date.now() - pointerStartTimeRef.current;
    clearHold();

    // If hold was triggered, do NOT toggle
    if (wasTriggeredByHold) {
      didTriggerHoldRef.current = false;
      return;
    }

    // For the light/dark toggle, it happens instantaneously on click (< 500ms)
    if (elapsed < HOLD_DELAY) {
      onToggle();
    }
  };

  const handlePointerCancel = () => {
    clearHold();
    didTriggerHoldRef.current = false;
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center select-none ${className}`}>
      {/* 
        Unified Day / Night Stylized Toggle Pill
        - Quick Click / Tap (< 320ms): Smoothly toggles Light / Dark mode
        - Press & Hold (>= 320ms): Opens crystal glassy Theme Selector popover
        - Right Click: Opens Theme Selector
      */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          clearHold();
          setIsMenuOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            if (e.shiftKey || e.altKey) {
              e.preventDefault();
              setIsMenuOpen((prev) => !prev);
            } else {
              e.preventDefault();
              onToggle();
            }
          }
        }}
        aria-label={`${isDark ? 'Dark Mode' : 'Light Mode'}. Click to toggle, hold to select theme style.`}
        aria-expanded={isMenuOpen}
        title={`${isDark ? 'Dark Mode' : 'Light Mode'} (${currentTheme.name})\n• Click to toggle mode\n• Hold to select theme style`}
        className={`relative w-[52px] h-[23px] rounded-full p-[2px] transition-all duration-100 ease-out cursor-pointer focus:outline-hidden touch-none group ${
          isHolding ? 'scale-[0.96]' : 'hover:scale-[1.03] active:scale-[0.97]'
        }`}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0b0f19 0%, #151a30 50%, #221c42 100%)'
            : 'linear-gradient(135deg, #38bdf8 0%, #60a5fa 55%, #818cf8 100%)',
          boxShadow: isDark
            ? '0 2px 8px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(0, 0, 0, 0.6), inset 0 -1px 1px rgba(255, 255, 255, 0.12)'
            : '0 2px 8px rgba(56, 189, 248, 0.35), inset 0 2px 4px rgba(0, 0, 0, 0.15), inset 0 -1px 2px rgba(255, 255, 255, 0.6)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(255, 255, 255, 0.55)',
        }}
      >
        {/* Perimeter Hold-Progress Indicator Ring */}
        {isHolding && (
          <svg className="absolute -inset-[2px] w-[56px] h-[27px] pointer-events-none z-20">
            <rect
              x="1.5"
              y="1.5"
              width="53"
              height="24"
              rx="12"
              ry="12"
              fill="none"
              stroke="var(--accent, #38bdf8)"
              strokeWidth="2"
              strokeDasharray="134"
              strokeDashoffset={134 - (134 * holdProgress) / 100}
              strokeLinecap="round"
              className="transition-all duration-75"
              style={{ filter: 'drop-shadow(0 0 3px var(--accent, #38bdf8))' }}
            />
          </svg>
        )}

        {/* ================= BACKGROUND GRAPHICS ================= */}
        {/* 1. Day Mode: Fluffy Floating Clouds & Daylight Hues */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none transition-opacity duration-300"
          style={{ opacity: isDark ? 0 : 1 }}
        >
          {/* Main layered cloud cluster (Right side) */}
          <div
            className="absolute right-[2px] bottom-[1px] flex items-end transition-transform duration-400 ease-out"
            style={{
              transform: isDark ? 'translateY(14px) scale(0.6)' : 'translateY(0) scale(1)',
            }}
          >
            {/* Cloud Puff 1 */}
            <div className="w-3 h-3 rounded-full bg-white/95 shadow-xs -mr-0.5" />
            {/* Cloud Puff 2 (Higher) */}
            <div className="w-3.5 h-3.5 rounded-full bg-white/95 shadow-xs -mr-0.5" />
            {/* Cloud Puff 3 */}
            <div className="w-2.5 h-2.5 rounded-full bg-white/90 shadow-xs" />
          </div>

          {/* Secondary translucent cloud puff (Upper Right) */}
          <div
            className="absolute right-[9px] top-[2px] flex items-center transition-transform duration-400 ease-out delay-75"
            style={{
              transform: isDark ? 'translateY(12px) scale(0.5)' : 'translateY(0) scale(1)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white/70 -mr-0.5" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/75" />
          </div>
        </div>

        {/* 2. Night Mode: Cosmic Starry Sky with Twinkling Stars & Sparkles */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none transition-opacity duration-300"
          style={{ opacity: isDark ? 1 : 0 }}
        >
          {/* 4-Point Sparkle Star (Left) */}
          <svg
            className="absolute left-[6px] top-[3px] w-2 h-2 pointer-events-none transition-all duration-400 ease-out"
            style={{
              transform: isDark ? 'scale(1) rotate(0deg)' : 'scale(0.2) rotate(-45deg)',
              filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))',
            }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 0L14.4 9.6L24 12L14.4 14.4L12 24L9.6 14.4L0 12L9.6 9.6L12 0Z"
              className="text-amber-100"
            />
          </svg>

          {/* Star Dot 1 (Upper Center) */}
          <span
            className="absolute left-[16px] top-[4px] w-[1.5px] h-[1.5px] rounded-full bg-white transition-all duration-300"
            style={{
              opacity: isDark ? 0.95 : 0,
              boxShadow: '0 0 3px #ffffff',
            }}
          />

          {/* Star Dot 2 (Lower Left) */}
          <span
            className="absolute left-[11px] bottom-[4px] w-[1.5px] h-[1.5px] rounded-full bg-blue-100 transition-all duration-300"
            style={{
              opacity: isDark ? 0.85 : 0,
            }}
          />

          {/* Star Dot 3 (Center Lower) */}
          <span
            className="absolute left-[19px] bottom-[5px] w-[1.2px] h-[1.2px] rounded-full bg-indigo-200 transition-all duration-300"
            style={{
              opacity: isDark ? 0.75 : 0,
            }}
          />
        </div>

        {/* ================= CELESTIAL KNOB (SUN / MOON) ================= */}
        <div
          className="relative w-[19px] h-[19px] rounded-full transition-transform duration-100 ease-out z-10 flex items-center justify-center shrink-0"
          style={{
            transform: isDark ? 'translateX(27px)' : 'translateX(0px)',
          }}
        >
          {/* Sun Body & Warm Halo (Visible in Light Mode) */}
          <div
            className="absolute inset-0 rounded-full transition-all duration-100 ease-out"
            style={{
              opacity: isDark ? 0 : 1,
              transform: isDark ? 'rotate(90deg) scale(0.8)' : 'rotate(0deg) scale(1)',
              background:
                'radial-gradient(circle at 35% 32%, #fffbeb 0%, #fde047 30%, #f59e0b 75%, #d97706 100%)',
              boxShadow:
                '0 0 10px rgba(251, 191, 36, 0.85), 0 0 18px rgba(245, 158, 11, 0.4), inset -1px -1px 2px rgba(180, 83, 9, 0.35), inset 1px 1px 2px rgba(255, 255, 255, 0.95)',
            }}
          />

          {/* Moon Body & Luminous Halo (Visible in Dark Mode) */}
          <div
            className="absolute inset-0 rounded-full transition-all duration-100 ease-out"
            style={{
              opacity: isDark ? 1 : 0,
              transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.8)',
              background:
                'radial-gradient(circle at 35% 32%, #ffffff 0%, #f1f5f9 32%, #cbd5e1 72%, #94a3b8 100%)',
              boxShadow:
                '0 0 10px rgba(226, 232, 240, 0.75), 0 0 18px rgba(147, 197, 253, 0.35), inset -1px -1px 2px rgba(71, 85, 105, 0.4), inset 1px 1px 2px rgba(255, 255, 255, 0.95)',
            }}
          >
            {/* Realistic Lunar Craters */}
            {/* Crater 1 (Top right) */}
            <div
              className="absolute top-[4px] right-[5px] w-[5px] h-[5px] rounded-full transition-opacity duration-300"
              style={{
                background: '#94a3b8',
                boxShadow:
                  'inset 0.5px 0.5px 1px rgba(30, 41, 59, 0.65), 0.5px 0.5px 0.5px rgba(255, 255, 255, 0.45)',
              }}
            />

            {/* Crater 2 (Bottom center-left) */}
            <div
              className="absolute bottom-[4px] left-[5px] w-[7px] h-[7px] rounded-full transition-opacity duration-300"
              style={{
                background: '#94a3b8',
                boxShadow:
                  'inset 0.5px 0.5px 1px rgba(30, 41, 59, 0.65), 0.5px 0.5px 0.5px rgba(255, 255, 255, 0.45)',
              }}
            />

            {/* Crater 3 (Bottom right tiny speck) */}
            <div
              className="absolute bottom-[6px] right-[4px] w-[3px] h-[3px] rounded-full transition-opacity duration-300"
              style={{
                background: '#94a3b8',
                boxShadow: 'inset 0.5px 0.5px 1px rgba(30, 41, 59, 0.65)',
              }}
            />
          </div>
        </div>
      </button>

      {/* 
        Glassy Crystal Clear Theme Selector Popover
        Triggered when user holds on the toggle (or right-clicks)
      */}
      {isMenuOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-76 sm:w-84 z-50 p-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl animate-in fade-in zoom-in-95 duration-150 font-sans opacity-100"
          style={{
            backgroundColor: 'var(--bg-surface)',
            boxShadow: '0 20px 45px -10px rgba(0,0,0,0.65), 0 0 25px var(--accent-glow)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 pb-2 mb-1.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-1.5">
              {isDark ? (
                <Moon className="w-3.5 h-3.5 text-blue-300" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="font-semibold text-xs text-[var(--text-main)]">
                {isDark ? 'Dark Mode Aesthetics' : 'Light Mode Aesthetics'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
              {availableThemes.length} Styles
            </span>
          </div>

          <p className="px-2 pb-2 text-[10px] text-[var(--text-muted)] leading-tight">
            Select a design style. Each theme features specifically harmonized error & flag red tones:
          </p>

          {/* Theme list */}
          <div className="space-y-1 max-h-76 overflow-y-auto pr-0.5">
            {availableThemes.map((theme) => {
              const isSelected = currentTheme.id === theme.id;
              const flagRed = theme.vars['--error-border'];

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between group cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] ring-1 ring-[var(--accent)] shadow-xs'
                      : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-xs text-[var(--text-main)] truncate">
                        {theme.name}
                      </span>
                      {isSelected && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-faint)] leading-tight line-clamp-1">
                      {theme.tagline}
                    </p>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center -space-x-1">
                        {theme.previewColors.map((color, idx) => (
                          <span
                            key={idx}
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                            style={{ backgroundColor: color }}
                            title={`Palette: ${color}`}
                          />
                        ))}
                      </div>

                      {/* Harmonized Flag Red Swatch Pill */}
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 shadow-2xs"
                        style={{
                          backgroundColor: theme.vars['--error-bg'],
                          color: flagRed,
                          border: `1px solid ${flagRed}40`,
                        }}
                        title="Harmonized Flag Error Red for this theme"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: flagRed }} />
                        Flag Red
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer with usage tip */}
          <div className="pt-2 mt-2 border-t border-[var(--border)] px-1 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--accent)]" />
              <span>Tap toggle to switch mode</span>
            </span>
            <span>Hold toggle to pick style</span>
          </div>
        </div>
      )}
    </div>
  );
};
