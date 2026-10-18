import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Languages, ChevronDown, Check, Sliders, Search, X, RotateCcw, Trash2, Star } from 'lucide-react';
import { ALL_LANGUAGES, COMMON_SUBTITLE_LANGUAGES, getLanguageByCode, Language } from '../utils/languages';
import { LanguageListDisplayMode } from '../types/subtitle';

interface LanguageDropdownProps {
  language?: string;
  onSelectLanguage: (code: string) => void;
  onRedoLanguage?: (code: string) => void;
  onClearLanguage?: (code: string) => void;
  displayMode?: LanguageListDisplayMode;
  onOpenSettings?: () => void;
  availableLanguages?: string[];
  missingLanguages?: string[];
  isVideoActive?: boolean;
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  language = 'en',
  onSelectLanguage,
  onRedoLanguage,
  onClearLanguage,
  displayMode = 'native',
  onOpenSettings,
  availableLanguages = [],
  missingLanguages = [],
  isVideoActive = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Click and hold timer state
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldTriggeredRef = useRef<boolean>(false);
  const [choiceLang, setChoiceLang] = useState<Language | null>(null);

  // Search filter inside the open dropdown
  const [searchQuery, setSearchQuery] = useState('');
  
  // When closed, coords are null. When opened, coords are calculated freshly from the button's exact position.
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const isOpen = menuCoords !== null;

  // Favorite languages persistence (persists across language changes, unmounts, and reloads)
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('subflow_fav_languages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c) => String(c).toLowerCase());
        }
      }
    } catch {}
    return ['en', 'es', 'ar', 'fr', 'de', 'ja'];
  });

  // Re-sync favorites whenever dropdown opens or storage changes
  useEffect(() => {
    const syncFavs = () => {
      try {
        const saved = localStorage.getItem('subflow_fav_languages');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFavoriteCodes(parsed.map((c) => String(c).toLowerCase()));
          }
        }
      } catch {}
    };
    if (isOpen) {
      syncFavs();
    }
    window.addEventListener('storage', syncFavs);
    return () => window.removeEventListener('storage', syncFavs);
  }, [isOpen]);

  const toggleFavorite = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    e.preventDefault();
    const lower = code.toLowerCase();
    setFavoriteCodes((prev) => {
      const next = prev.includes(lower)
        ? prev.filter((c) => c !== lower)
        : [...prev, lower];
      try {
        localStorage.setItem('subflow_fav_languages', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const favoriteLanguagesList = useMemo(() => {
    return favoriteCodes
      .map((code) => ALL_LANGUAGES.find((l) => l.code.toLowerCase() === code))
      .filter((l): l is Language => !!l)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [favoriteCodes]);

  const currentLang = useMemo(() => getLanguageByCode(language), [language]);

  const isCurrentMissing = useMemo(() => {
    return isVideoActive && missingLanguages.includes(language.toLowerCase());
  }, [isVideoActive, missingLanguages, language]);

  // Filtered languages when search query is entered
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return ALL_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setMenuCoords(null);
      setSearchQuery('');
    } else {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = 240;
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

  const startHold = (lang: Language) => {
    isHoldTriggeredRef.current = false;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      isHoldTriggeredRef.current = true;
      setChoiceLang(lang);
    }, 450);
  };

  const endHold = (e: React.MouseEvent | React.TouchEvent, lang: Language) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!isHoldTriggeredRef.current) {
      e.stopPropagation();
      onSelectLanguage(lang.code);
      setMenuCoords(null);
      setSearchQuery('');
    }
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, lang: Language) => {
    e.preventDefault();
    e.stopPropagation();
    cancelHold();
    isHoldTriggeredRef.current = true;
    setChoiceLang(lang);
  };

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close dropdown on outside click, Escape, or when scrolling anything outside the dropdown
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
        setSearchQuery('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (choiceLang) {
          setChoiceLang(null);
        } else if (searchQuery) {
          setSearchQuery('');
        } else {
          setMenuCoords(null);
        }
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setMenuCoords(null);
      setSearchQuery('');
    };

    const handleResize = () => {
      setMenuCoords(null);
      setSearchQuery('');
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
  }, [isOpen, searchQuery, choiceLang]);

  // When opening dropdown without searching, always start at top (scrollTop = 0) so the Favorites section is always immediately visible
  useEffect(() => {
    if (isOpen && !searchQuery && listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [isOpen, searchQuery]);

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
            ? `[Missing from directory] Subtitle language: ${currentLang.name}`
            : `Language: ${currentLang.name} (${currentLang.nativeName}) [${currentLang.code.toUpperCase()}] - Click to switch, click & hold for options`
        }
        aria-label={`Subtitle language: ${currentLang.name}`}
        aria-expanded={isOpen}
      >
        <Languages
          className={`w-3.5 h-3.5 shrink-0 ${
            isCurrentMissing ? 'text-[var(--error-border)]' : 'text-[var(--accent)]'
          }`}
        />
      </button>

      {/* Language Popover Menu - Rendered via Portal at exact button coordinates */}
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
            className="w-max min-w-[220px] max-w-[300px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-1.5 font-sans text-xs select-none animate-in fade-in duration-75"
          >
            {/* Header */}
            <div className="pb-1 mb-1 border-b border-[var(--border)] px-1 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                <Languages className="w-3 h-3 text-[var(--accent)]" />
                <span>Subtitle Language</span>
              </span>
              <span className="text-[8.5px] text-[var(--text-faint)] italic">
                Hold for options
              </span>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuCoords(null);
                    setSearchQuery('');
                    onOpenSettings();
                  }}
                  className="text-[9.5px] text-[var(--accent)] hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                  title="Configure language settings"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>Settings</span>
                </button>
              )}
            </div>

            {/* Search Input inside the open dropdown */}
            <div className="px-0.5 pb-1 mb-0.5">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-light)] focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all">
                <Search className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search languages..."
                  className="w-full text-[10.5px] bg-transparent outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Languages Scrollable List */}
            <div
              ref={listContainerRef}
              className="max-h-64 overflow-y-auto space-y-0.5 py-0.5 scrollbar-thin pr-0.5"
            >
              {filteredLanguages ? (
                // Filtered search results
                filteredLanguages.length > 0 ? (
                  <>
                    <div className="px-2 py-0.5 text-[8.5px] font-mono font-semibold uppercase tracking-wider text-[var(--text-faint)] bg-[var(--bg-app)] rounded mb-0.5">
                      Matches ({filteredLanguages.length})
                    </div>
                    {filteredLanguages.map((lang) => renderLanguageItem(lang))}
                  </>
                ) : (
                  <div className="py-4 text-center text-[10.5px] text-[var(--text-faint)]">
                    No languages found
                  </div>
                )
              ) : (
                // Default list when not searching
                <>
                  {/* Favorites Section */}
                  {favoriteLanguagesList.length > 0 && (
                    <>
                      <div className="px-2 py-0.5 text-[8.5px] font-mono font-semibold uppercase tracking-wider text-amber-400/90 bg-[var(--bg-app)] rounded mb-0.5 flex items-center gap-1.5">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span>Favorites</span>
                      </div>
                      {favoriteLanguagesList.map((lang) => renderLanguageItem(lang, true))}
                    </>
                  )}

                  {/* Common Subtitle Languages Section */}
                  <div className="px-2 pt-1.5 pb-0.5 text-[8.5px] font-mono font-semibold uppercase tracking-wider text-[var(--text-faint)] border-t border-[var(--border)] mt-1.5 bg-[var(--bg-app)] rounded mb-0.5">
                    Common Subtitle Languages
                  </div>
                  {COMMON_SUBTITLE_LANGUAGES.map((lang) => renderLanguageItem(lang))}

                  {/* All Subtitle Languages Section */}
                  <div className="px-2 pt-1.5 pb-0.5 text-[8.5px] font-mono font-semibold uppercase tracking-wider text-[var(--text-faint)] border-t border-[var(--border)] mt-1.5 bg-[var(--bg-app)] rounded mb-0.5">
                    All Subtitle Languages (A–Z)
                  </div>
                  {ALL_LANGUAGES.map((lang) => renderLanguageItem(lang))}
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Click and Hold Choice Modal / Action Dialog */}
      {choiceLang &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-100"
            onClick={() => setChoiceLang(null)}
          >
            <div
              className="relative w-full max-w-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden font-sans p-4 space-y-3.5 animate-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center font-bold text-xs">
                    {choiceLang.code.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-main)]">
                      {choiceLang.name}
                    </h3>
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {choiceLang.nativeName}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChoiceLang(null)}
                  className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Choose an action for <span className="font-semibold text-[var(--text-main)]">{choiceLang.name}</span> subtitles:
              </p>

              {/* Action Choices */}
              <div className="space-y-2">
                {/* Redo translation choice */}
                <button
                  type="button"
                  onClick={() => {
                    const code = choiceLang.code;
                    setChoiceLang(null);
                    setMenuCoords(null);
                    onRedoLanguage?.(code);
                  }}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] flex items-center gap-3 transition-colors text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] group-hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent)] shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)]">
                      Redo Translation
                    </div>
                    <div className="text-[10px] text-[var(--text-faint)]">
                      Re-translate lines from source and save to database
                    </div>
                  </div>
                </button>

                {/* Clear / Erase choice */}
                <button
                  type="button"
                  onClick={() => {
                    const code = choiceLang.code;
                    setChoiceLang(null);
                    setMenuCoords(null);
                    onClearLanguage?.(code);
                  }}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] hover:border-red-500/50 hover:bg-red-500/10 flex items-center gap-3 transition-colors text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] group-hover:bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold text-[var(--text-main)] group-hover:text-red-400">
                      Clear / Erase Language Entirely
                    </div>
                    <div className="text-[10px] text-[var(--text-faint)]">
                      Erase all saved subtitles for this language from database
                    </div>
                  </div>
                </button>
              </div>

              {/* Footer Cancel */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setChoiceLang(null)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[10.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  function renderLanguageItem(lang: Language, isFavSection = false) {
    const isSelected = language.toLowerCase() === lang.code.toLowerCase();
    const isAvailable = availableLanguages.map((c) => c.toLowerCase()).includes(lang.code.toLowerCase());
    const isMissing = isVideoActive && missingLanguages.includes(lang.code.toLowerCase());
    const isFav = favoriteCodes.includes(lang.code.toLowerCase());
    const leftText = displayMode === 'native' ? lang.nativeName : lang.name;
    const rightText = displayMode === 'native' ? lang.name : lang.nativeName;
    return (
      <div
        key={`${isFavSection ? 'fav-' : ''}${lang.code}-${lang.name}`}
        ref={isSelected && !isFavSection ? selectedItemRef : undefined}
        onMouseDown={(e) => {
          if (e.button === 0) startHold(lang);
        }}
        onMouseUp={(e) => {
          if (e.button === 0) endHold(e, lang);
        }}
        onMouseLeave={cancelHold}
        onTouchStart={() => startHold(lang)}
        onTouchEnd={(e) => endHold(e, lang)}
        onTouchCancel={cancelHold}
        onContextMenu={(e) => handleContextMenu(e, lang)}
        className={`w-full text-left px-2 py-0.5 h-6 sm:h-6.5 rounded-md flex items-center justify-between gap-2 transition-colors select-none cursor-pointer text-[11px] group/lang ${
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
            ? `Subtitles for ${lang.name} are missing from the saved directory! (Click and hold for options)`
            : !isAvailable
            ? `${lang.name} — Not yet saved in database for this media (Click to translate/create, hold for options)`
            : `${lang.name} (${lang.nativeName}) · Saved in database (Click to switch, hold for options)`
        }
      >
        {/* Left: Native Name (or primary display) with red strike-through if missing */}
        <span className={`truncate flex-1 ${isMissing ? 'line-through font-bold text-[var(--error-border)]' : ''}`}>
          {leftText}
        </span>
        {/* Right: English Translation + Star Favorite button + Checkmark */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span className={`text-[10px] tracking-tight ${isMissing ? 'text-[var(--error-border)]' : 'text-[var(--text-faint)]'}`}>
            {rightText}
          </span>
          {isSelected && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
          {/* Favorite Star Button (to the right of languages) */}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => toggleFavorite(e, lang.code)}
            className={`p-0.5 rounded transition-colors cursor-pointer hover:bg-neutral-800/50 ${
              isFav
                ? 'text-amber-400 opacity-100'
                : 'text-neutral-500 opacity-0 group-hover/lang:opacity-100 hover:text-amber-400'
            }`}
            title={isFav ? `Remove ${lang.name} from favorites` : `Add ${lang.name} to favorites`}
            aria-label={isFav ? `Remove ${lang.name} from favorites` : `Add ${lang.name} to favorites`}
          >
            <Star
              className={`w-3 h-3 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-neutral-400'}`}
            />
          </button>
        </div>
      </div>
    );
  }
};
