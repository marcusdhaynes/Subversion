import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Captions, ChevronDown, Check } from 'lucide-react';
import { SubtitleTrackType } from '../types/subtitle';
import { SUBTITLE_TRACK_TYPES } from '../utils/languages';

interface SubtitleTypeDropdownProps {
  trackType?: SubtitleTrackType;
  onSelectTrackType: (type: SubtitleTrackType) => void;
  availableTrackTypes?: SubtitleTrackType[];
  missingTrackTypes?: SubtitleTrackType[];
  isVideoActive?: boolean;
}

export const SubtitleTypeDropdown: React.FC<SubtitleTypeDropdownProps> = ({
  trackType = 'Normal',
  onSelectTrackType,
  availableTrackTypes = [],
  missingTrackTypes = [],
  isVideoActive = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  
  // When closed, coords are null. When opened, coords are calculated freshly from the button's exact position.
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const isOpen = menuCoords !== null;

  const currentTrack = SUBTITLE_TRACK_TYPES.find((t) => t.type === trackType) || SUBTITLE_TRACK_TYPES[0];
  const isCurrentMissing = isVideoActive && missingTrackTypes.includes(trackType);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setMenuCoords(null);
    } else {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = 270;
        let left = rect.left;
        if (left + menuWidth > window.innerWidth - 6) {
          left = Math.max(6, rect.right - menuWidth);
        }
        left = Math.max(6, left);
        setMenuCoords({
          top: Math.round(rect.bottom + 4),
          left: Math.round(left),
        });
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setMenuCoords(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuCoords(null);
      }
    };

    // Close dropdown naturally if the top row or window scrolls
    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setMenuCoords(null);
    };

    const handleResize = () => {
      setMenuCoords(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center shrink-0 font-sans">
      {/* Trigger Button (Icon Only) */}
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={handleToggle}
        className={`w-6 h-6 p-0 rounded-md border transition-colors cursor-pointer flex items-center justify-center shadow-2xs select-none ${
          isCurrentMissing
            ? 'bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--error-border)]'
            : isOpen
            ? 'bg-[var(--bg-hover)] border-[var(--accent)] text-[var(--text-main)] ring-1 ring-[var(--accent)]'
            : 'bg-[var(--bg-subtle)] border-[var(--border-light)] hover:border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
        }`}
        title={
          isCurrentMissing
            ? `[Missing from directory] Subtitle track file for "${currentTrack.label}"`
            : `Subtitle Track Type: ${currentTrack.label} (${currentTrack.description}) - Click to switch track type`
        }
        aria-label={`Select subtitle track type: ${currentTrack.label}`}
        aria-expanded={isOpen}
      >
        <Captions
          className={`w-3.5 h-3.5 shrink-0 ${
            isCurrentMissing ? 'text-[var(--error-border)]' : 'text-[var(--accent)]'
          }`}
        />
      </button>

      {/* Popover Menu - Rendered via Portal at exact button coordinates */}
      {isOpen && menuCoords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              zIndex: 9999,
            }}
            className="w-68 sm:w-72 max-w-[calc(100vw-24px)] rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2 font-sans text-xs select-none animate-in fade-in duration-75"
          >
            <div className="flex items-center justify-between px-1.5 pb-1.5 mb-1 border-b border-[var(--border)]">
              <span className="font-mono text-[9.5px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                <Captions className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Subtitle Track Type</span>
              </span>
              <span className="text-[9px] font-mono text-[var(--text-faint)]">
                Default: Normal
              </span>
            </div>

            <div className="space-y-0.5 py-0.5 max-h-72 overflow-y-auto scrollbar-thin">
              {SUBTITLE_TRACK_TYPES.map((item) => {
                const isSelected = trackType === item.type;
                const isAvailable = !isVideoActive || availableTrackTypes.includes(item.type);
                const isMissing = isVideoActive && missingTrackTypes.includes(item.type);

                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrackType(item.type);
                      setMenuCoords(null);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold ring-1 ring-[var(--accent)]'
                        : 'hover:bg-[var(--bg-hover)]'
                    } ${
                      isMissing
                        ? 'text-[var(--error-border)]'
                        : !isAvailable
                        ? 'opacity-40 text-[var(--text-faint)] hover:opacity-100 hover:text-[var(--text-main)]'
                        : 'text-[var(--text-main)]'
                    }`}
                    title={
                      isMissing
                        ? `${item.label} — Missing from the saved directory!`
                        : !isAvailable
                        ? `${item.label} — Not yet saved for this video (Click to select/create)`
                        : `${item.label} — Saved for this video`
                    }
                  >
                    <div className="min-w-0 pr-1">
                      <div
                        className={`text-[11px] font-medium ${
                          isMissing
                            ? 'line-through text-[var(--error-border)] font-bold'
                            : isSelected
                            ? 'text-[var(--text-main)]'
                            : ''
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className={`text-[9.5px] truncate mt-0.5 ${isMissing ? 'text-[var(--error-border)]/80' : 'text-[var(--text-faint)]'}`}>
                        {item.description}
                      </div>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
