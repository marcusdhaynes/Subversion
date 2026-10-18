import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SubtitleProject, Character, CollaboratorUser, Series, SubtitleTrackType } from '../types/subtitle';
import { ThemePreset } from '../types/theme';
import { ThemeToggle } from './ThemeToggle';
import { LanguageDropdown } from './LanguageDropdown';
import { SubtitleTypeDropdown } from './SubtitleTypeDropdown';
import {
  User,
  Users,
  Sliders,
  Download,
  Upload,
  Plus,
  Search,
  AlertTriangle,
  X,
  LayoutGrid,
  List,
  Menu,
  Tv,
  ChevronDown,
  Check,
  Undo2,
  Redo2,
  Video,
  Languages,
  Link,
  Unlink,
  Database,
  Sparkles,
} from 'lucide-react';
import { secondsToTimecode, timecodeToSeconds } from '../utils/timecode';
import { getLanguageByCode } from '../utils/languages';
import { TranslationProgressUpdate } from '../utils/aiTranslationRunner';

interface HeaderProps {
  project: SubtitleProject;
  onUpdateTitle: (title: string) => void;
  onUpdateLanguage?: (language: string) => void;
  onRedoLanguage?: (code: string) => void;
  onClearLanguage?: (code: string) => void;
  translationProgress?: TranslationProgressUpdate | null;
  onUpdateTrackType?: (trackType: SubtitleTrackType) => void;
  isSaving: boolean;
  isConnected: boolean;
  lastSavedAt: number | null;
  currentUser: { id: string; name: string; color: string; avatar?: string };
  collaborators: CollaboratorUser[];
  isDark: boolean;
  currentTheme: ThemePreset;
  availableThemes: ThemePreset[];
  onToggleDarkMode: () => void;
  onSelectTheme: (themeId: string) => void;
  onOpenUserModal: () => void;
  onOpenSettingsModal: (tab?: 'series' | 'characters' | 'typography' | 'language') => void;
  onSelectSeries: (seriesId: string | undefined) => void;
  onOpenMediaDatabase?: () => void;
  onOpenImportExportModal: (tab?: 'export' | 'import') => void;
  onAddNewLine?: () => void;
  // Video Player Controls (Moved to where the + button was in top row)
  isVideoOpen?: boolean;
  isPipActive?: boolean;
  onToggleVideo?: () => void;
  // Video Subtitle Association Controls
  isAssociated?: boolean;
  isCurrentSubtitleMissing?: boolean;
  onToggleAssociate?: () => void;
  availableLanguages?: string[];
  missingLanguages?: string[];
  availableTrackTypes?: SubtitleTrackType[];
  missingTrackTypes?: SubtitleTrackType[];
  isVideoActive?: boolean;
  // Search & Filter (Merged from FilterBar)
  searchQuery: string;
  onSearchChange: (query: string) => void;
  flagFilterOnly: boolean;
  onToggleFlagFilter: () => void;
  selectedCharFilter: string;
  onCharFilterChange: (charId: string) => void;
  viewMode?: 'table' | 'cards';
  onToggleViewMode?: () => void;
  // Undo / Redo
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  onUpdateTitle,
  onUpdateLanguage,
  onRedoLanguage,
  onClearLanguage,
  translationProgress = null,
  onUpdateTrackType,
  isSaving,
  isConnected,
  currentUser,
  collaborators,
  isDark,
  currentTheme,
  availableThemes,
  onToggleDarkMode,
  onSelectTheme,
  onOpenUserModal,
  onOpenSettingsModal,
  onSelectSeries,
  onOpenMediaDatabase,
  onOpenImportExportModal,
  onAddNewLine,
  isVideoOpen = false,
  isPipActive = false,
  onToggleVideo,
  isAssociated = false,
  isCurrentSubtitleMissing = false,
  onToggleAssociate,
  availableLanguages = [],
  missingLanguages = [],
  availableTrackTypes = [],
  missingTrackTypes = [],
  isVideoActive = false,
  searchQuery,
  onSearchChange,
  flagFilterOnly,
  onToggleFlagFilter,
  selectedCharFilter,
  onCharFilterChange,
  viewMode = 'table',
  onToggleViewMode,
  canUndo = false,
  canRedo = false,
  undoCount = 0,
  redoCount = 0,
  onUndo,
  onRedo,
}) => {
  const [titleInput, setTitleInput] = useState(project.title);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const seriesDropdownRef = useRef<HTMLDivElement | null>(null);
  const seriesMenuRef = useRef<HTMLDivElement | null>(null);
  const charDropdownRef = useRef<HTMLDivElement | null>(null);
  const charMenuRef = useRef<HTMLDivElement | null>(null);

  const [seriesMenuCoords, setSeriesMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [charMenuCoords, setCharMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const isSeriesDropdownOpen = seriesMenuCoords !== null;
  const isCharDropdownOpen = charMenuCoords !== null;

  const setIsSeriesDropdownOpen = (open: boolean) => {
    if (!open) setSeriesMenuCoords(null);
  };

  const setIsCharDropdownOpen = (open: boolean) => {
    if (!open) setCharMenuCoords(null);
  };

  const handleToggleSeries = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSeriesDropdownOpen) {
      setSeriesMenuCoords(null);
    } else {
      if (seriesDropdownRef.current) {
        const rect = seriesDropdownRef.current.getBoundingClientRect();
        const left = Math.max(6, Math.min(rect.left, window.innerWidth - 276));
        setSeriesMenuCoords({ top: Math.round(rect.bottom + 4), left: Math.round(left) });
      }
    }
  };

  const handleToggleChar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCharDropdownOpen) {
      setCharMenuCoords(null);
    } else {
      if (charDropdownRef.current) {
        const rect = charDropdownRef.current.getBoundingClientRect();
        const left = Math.max(6, Math.min(rect.left - 40, window.innerWidth - 250));
        setCharMenuCoords({ top: Math.round(rect.bottom + 4), left: Math.round(left) });
      }
    }
  };

  // Sync title input with project
  useEffect(() => {
    setTitleInput(project.title);
  }, [project.title]);

  // Close series & character dropdowns on click outside, escape, or external scroll
  useEffect(() => {
    if (!isSeriesDropdownOpen && !isCharDropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        seriesDropdownRef.current &&
        !seriesDropdownRef.current.contains(target) &&
        (!seriesMenuRef.current || !seriesMenuRef.current.contains(target))
      ) {
        setSeriesMenuCoords(null);
      }
      if (
        charDropdownRef.current &&
        !charDropdownRef.current.contains(target) &&
        (!charMenuRef.current || !charMenuRef.current.contains(target))
      ) {
        setCharMenuCoords(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSeriesMenuCoords(null);
        setCharMenuCoords(null);
      }
    };

    // Close on external scroll naturally
    const handleScroll = (e: Event) => {
      const target = e.target as Node;
      if (seriesMenuRef.current && seriesMenuRef.current.contains(target)) return;
      if (charMenuRef.current && charMenuRef.current.contains(target)) return;
      setSeriesMenuCoords(null);
      setCharMenuCoords(null);
    };

    const handleResize = () => {
      setSeriesMenuCoords(null);
      setCharMenuCoords(null);
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
  }, [isSeriesDropdownOpen, isCharDropdownOpen]);

  const seriesList = project.seriesList || [];
  const currentSeries = seriesList.find((s) => s.id === project.seriesId);
  const selectedChar = project.characters.find((c) => c.id === selectedCharFilter);

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    }
  };

  const flaggedCount = project.lines.filter((l) => l.flag?.isFlagged).length;
  const maxEndSeconds = project.lines.reduce((max, l) => {
    const s = timecodeToSeconds(l.endTime);
    return s > max ? s : max;
  }, 0);

  return (
    <header className="relative h-8.5 sm:h-9 px-2 sm:px-3 bg-[var(--bg-surface)] flex items-center justify-between gap-2 sm:gap-3 select-none shrink-0 text-xs z-30 border-b border-[var(--border)] overflow-x-auto overflow-y-visible scrollbar-none">
      {/* ================= LEFT GROUP: TITLE & SERIES DROPDOWN + LANGUAGE + TRACK TYPE ================= */}
      <div className="flex items-center min-w-0 shrink-0 z-20 gap-1.5 sm:gap-2">
        {/* Project Name Box with connected Series Dropdown */}
        <div className="flex items-center w-full min-w-[120px] max-w-[190px] xs:max-w-[230px] sm:max-w-[290px] md:max-w-[350px]">
          {/* Left part: Name input with single light (auto-save status indicator) */}
          <div className="flex items-center gap-1 sm:gap-1.5 h-6 px-1.5 rounded-l-md bg-[var(--bg-subtle)] border border-r-0 border-[var(--border-light)] hover:border-[var(--border)] focus-within:border-[var(--accent)] transition-all flex-1 min-w-0">
            {/* The Only Light (Live auto-save indicator) */}
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                isSaving
                  ? 'bg-amber-500 animate-ping'
                  : isConnected
                  ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]'
                  : 'bg-neutral-400'
              }`}
              title={isSaving ? 'Saving changes...' : 'All changes saved locally'}
            />
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={() => {
                if (titleInput.trim() && titleInput.trim() !== project.title) {
                  onUpdateTitle(titleInput.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              placeholder="Untitled Subtitles"
              className={`w-full text-[10.5px] bg-transparent outline-hidden font-medium placeholder:text-[var(--text-faint)] truncate ${
                isCurrentSubtitleMissing
                  ? 'text-[var(--error-border)] line-through font-bold'
                  : 'text-[var(--text-main)]'
              }`}
              title={
                isCurrentSubtitleMissing
                  ? `[MISSING FROM DIRECTORY] Subtitle file missing from saved directory: ${titleInput}`
                  : `File Name: ${titleInput || 'Untitled Subtitles'} (Click to rename)`
              }
              aria-label="Subtitle file name"
            />
          </div>

          {/* Right part: Connected Series Dropdown (Icon Only) */}
          <div ref={seriesDropdownRef} className="relative inline-flex items-center shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleSeries}
              className={`w-6 h-6 px-0 rounded-r-md border border-[var(--border-light)] flex items-center justify-center transition-colors cursor-pointer font-sans shadow-2xs ${
                currentSeries
                  ? 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border)]'
              }`}
              title={
                currentSeries
                  ? `Series / Project: ${currentSeries.name} (Click to change)`
                  : 'Assign this file to a Series / Project'
              }
              aria-label="Assign to Series or Project"
            >
              <Tv
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: currentSeries ? currentSeries.color : 'inherit' }}
              />
            </button>

          {/* Series Popover Dropdown */}
          {isSeriesDropdownOpen && seriesMenuCoords &&
            createPortal(
              <div
                ref={seriesMenuRef}
                style={{
                  position: 'fixed',
                  top: `${seriesMenuCoords.top}px`,
                  left: `${seriesMenuCoords.left}px`,
                  zIndex: 9999,
                }}
                className="w-68 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2 font-sans text-xs select-none animate-in fade-in duration-75"
              >
                <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-[var(--border)]">
                  <span className="font-mono text-[9.5px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                    <Tv className="w-3 h-3 text-[var(--accent)]" />
                    <span>Assign Series</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSeriesDropdownOpen(false);
                      onOpenSettingsModal('series');
                    }}
                    className="text-[10px] text-[var(--accent)] hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>New Series</span>
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
                  {/* Unassigned / Standalone Option */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSeries(undefined);
                      setIsSeriesDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      !currentSeries
                        ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[var(--text-faint)] shrink-0" />
                      <span className="truncate text-[11px]">No Series (Standalone File)</span>
                    </div>
                    {!currentSeries && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                  </button>

                  {/* Series List */}
                  {seriesList.map((s) => {
                    const isSelected = s.id === project.seriesId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectSeries(s.id);
                          setIsSeriesDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold ring-1 ring-[var(--accent)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: s.color }}
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate text-[var(--text-main)]">
                              {s.name}
                            </div>
                            <div className="text-[9px] font-mono text-[var(--text-faint)] truncate">
                              {s.characters?.length || 0} characters · {s.defaultSettings?.font || 'Inter'}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 mt-1 border-t border-[var(--border)] space-y-0.5">
                  {onOpenMediaDatabase && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSeriesDropdownOpen(false);
                        onOpenMediaDatabase();
                      }}
                      className="w-full py-1 text-center text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-hover)] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Database className="w-3 h-3 text-[var(--accent)]" />
                      <span>Browse Media Database Hierarchy</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSeriesDropdownOpen(false);
                      onOpenSettingsModal('series');
                    }}
                    className="w-full py-1 text-center text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3 h-3 text-[var(--accent)]" />
                    <span>Manage Series & Characters in Settings</span>
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* 1st Dropdown: Language (Icon Only) */}
      <LanguageDropdown
        language={project.language || 'en'}
        onSelectLanguage={(code) => onUpdateLanguage?.(code)}
        onRedoLanguage={(code) => onRedoLanguage?.(code)}
        onClearLanguage={(code) => onClearLanguage?.(code)}
        displayMode={project.defaultSettings?.languageListDisplay || 'native'}
        onOpenSettings={() => onOpenSettingsModal('language')}
        availableLanguages={availableLanguages}
        missingLanguages={missingLanguages}
        isVideoActive={isVideoActive}
      />

      {/* Target Language & AI Translation Progress Bar (Smoothly expands and slides Subtitle & Server buttons to the right) */}
      <div
        className={`transition-all duration-300 ease-in-out flex items-center overflow-hidden shrink-0 ${
          translationProgress?.active
            ? 'max-w-[270px] opacity-100 ml-1 sm:ml-1.5'
            : 'max-w-0 opacity-0 ml-0 pointer-events-none'
        }`}
      >
        {translationProgress && (
          <div className="flex items-center gap-2 h-6 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-light)] shadow-2xs whitespace-nowrap min-w-[210px] max-w-[260px]">
            {/* Target Language Badge */}
            <div className="flex items-center gap-1 shrink-0">
              {translationProgress.phase === 'completed' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Sparkles className="w-3 h-3 text-[var(--accent)] animate-spin shrink-0" style={{ animationDuration: '3s' }} />
              )}
              <span className="text-[10.5px] font-bold text-[var(--accent)] font-mono">
                {getLanguageByCode(translationProgress.targetLang).name}
              </span>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="flex-1 flex flex-col justify-center min-w-[85px] gap-0.5">
              <div className="flex items-center justify-between text-[9px] font-mono leading-none">
                <span className="text-[var(--text-faint)] truncate max-w-[75px]" title={translationProgress.phaseText}>
                  {translationProgress.phase === 'completed'
                    ? '100% Verified'
                    : translationProgress.phase === 'verifying'
                    ? 'Checking...'
                    : translationProgress.phase === 'rechecking'
                    ? 'Rechecking...'
                    : `${translationProgress.completedLines}/${translationProgress.totalLines}`}
                </span>
                <span className={`font-bold ml-1 ${translationProgress.phase === 'completed' ? 'text-emerald-400' : 'text-[var(--text-main)]'}`}>
                  {translationProgress.percent}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden border border-[var(--border-light)]/50">
                <div
                  className={`h-full transition-all duration-200 rounded-full ${
                    translationProgress.phase === 'completed'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : 'bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, translationProgress.percent))}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtitle & Server Buttons (Smoothly slide as the progress bar expands/collapses) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 transition-transform duration-300 ease-in-out">
        {/* 2nd Dropdown: Subtitle Track Type (Icon Only) */}
        <SubtitleTypeDropdown
          trackType={project.trackType || 'Normal'}
          onSelectTrackType={(type) => onUpdateTrackType?.(type)}
          availableTrackTypes={availableTrackTypes}
          missingTrackTypes={missingTrackTypes}
          isVideoActive={isVideoActive}
        />

        {/* 3rd Button: Media Database Hierarchy Browser (Server button) */}
        {onOpenMediaDatabase && (
          <button
            type="button"
            onClick={onOpenMediaDatabase}
            className="w-6 h-6 p-0 rounded-md border border-[var(--border-light)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] hover:border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
            title="Open Media Subtitle Database / Server Tracks"
            aria-label="Open Media Subtitle Database"
          >
            <Database className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      </div>

      {/* Subtle section divider between Title/Series and Search */}
      <div className="h-3.5 w-px bg-[var(--border)] shrink-0 mx-1 sm:mx-1.5 opacity-60" aria-hidden="true" />

      {/* ================= CENTER GROUP: SEARCH & FILTERS (CENTERED WITH FLEX SPACE TO PREVENT OVERLAP) ================= */}
      <div className="flex-1 flex items-center justify-center min-w-[140px] px-1 sm:px-2 z-10">
        {/* Search Input Box with connected Character Filter */}
        <div className="flex items-center w-full min-w-[120px] max-w-[210px] xs:max-w-[250px] sm:max-w-[290px] shadow-2xs">
          {/* Left part: Search input */}
          <div className="flex items-center gap-1 h-6 px-1.5 rounded-l-md bg-[var(--bg-subtle)] border border-r-0 border-[var(--border-light)] hover:border-[var(--border)] focus-within:border-[var(--accent)] transition-all flex-1 min-w-0">
            <Search className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full text-[10.5px] bg-transparent outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)] truncate"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Right part: Connected Character Filter Dropdown */}
          <div ref={charDropdownRef} className="relative inline-flex items-center shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleChar}
              className={`h-6 rounded-r-md border border-[var(--border-light)] flex items-center justify-center transition-colors cursor-pointer font-sans ${
                selectedChar
                  ? 'px-1.5 sm:px-2 gap-1 sm:gap-1.5 bg-[var(--bg-subtle)] text-[var(--text-main)] border-[var(--border)] hover:border-[var(--accent)] shadow-2xs'
                  : selectedCharFilter === 'unassigned'
                  ? 'px-1.5 sm:px-2 gap-1 sm:gap-1.5 bg-[var(--bg-subtle)] text-[var(--text-main)] border-[var(--border)] hover:border-[var(--accent)] shadow-2xs'
                  : 'w-6 px-0 bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border)]'
              }`}
              title={
                selectedChar
                  ? `Filter: ${selectedChar.name} (Click to change)`
                  : selectedCharFilter === 'unassigned'
                  ? 'Filter: Unassigned (Narrator)'
                  : 'Filter by character'
              }
            >
              <Users
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: selectedChar ? selectedChar.color : 'inherit' }}
              />
              {selectedChar && (
                <>
                  <span className="text-[10px] font-semibold tracking-tight truncate max-w-[45px] xs:max-w-[70px] sm:max-w-[90px]">
                    {selectedChar.name}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onCharFilterChange('all');
                    }}
                    className="p-0.5 hover:text-rose-500 rounded transition-colors"
                    title="Clear character filter"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                </>
              )}
              {!selectedChar && selectedCharFilter === 'unassigned' && (
                <>
                  <span className="text-[10px] font-semibold tracking-tight truncate max-w-[45px] xs:max-w-[70px] sm:max-w-[90px]">
                    Narrator
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onCharFilterChange('all');
                    }}
                    className="p-0.5 hover:text-rose-500 rounded transition-colors"
                    title="Clear character filter"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                </>
              )}
            </button>

            {/* Character Dropdown Popover */}
            {isCharDropdownOpen && charMenuCoords &&
              createPortal(
                <div
                  ref={charMenuRef}
                  style={{
                    position: 'fixed',
                    top: `${charMenuCoords.top}px`,
                    left: `${charMenuCoords.left}px`,
                    zIndex: 9999,
                  }}
                  className="w-60 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2 font-sans text-xs select-none animate-in fade-in duration-75"
                >
                  <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-[var(--border)]">
                    <span className="font-mono text-[9.5px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-[var(--accent)]" />
                      <span>Filter by Character</span>
                    </span>
                    {selectedCharFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          onCharFilterChange('all');
                          setIsCharDropdownOpen(false);
                        }}
                        className="text-[10px] text-[var(--accent)] hover:underline font-medium cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
                    {/* All Characters */}
                    <button
                      type="button"
                      onClick={() => {
                        onCharFilterChange('all');
                        setIsCharDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        selectedCharFilter === 'all'
                          ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[var(--text-faint)] shrink-0" />
                        <span className="truncate text-[11px]">All Characters</span>
                      </div>
                      {selectedCharFilter === 'all' && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                    </button>

                    {/* Unassigned / Narrator */}
                    <button
                      type="button"
                      onClick={() => {
                        onCharFilterChange('unassigned');
                        setIsCharDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        selectedCharFilter === 'unassigned'
                          ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 shrink-0" />
                        <span className="truncate text-[11px]">Unassigned (Narrator)</span>
                      </div>
                      {selectedCharFilter === 'unassigned' && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                    </button>

                    {project.characters.length > 0 && (
                      <div className="my-1 border-t border-[var(--border)]" />
                    )}

                    {/* Character List */}
                    {project.characters.map((c) => {
                      const isSelected = selectedCharFilter === c.id;
                      const lineCount = project.lines.filter((l) => l.characterId === c.id).length;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onCharFilterChange(c.id);
                            setIsCharDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold ring-1 ring-[var(--accent)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: c.color }}
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium truncate text-[var(--text-main)]">
                                {c.name}
                              </div>
                              <div className="text-[9px] font-mono text-[var(--text-faint)] truncate">
                                {lineCount} lines · {c.font}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1.5 mt-1 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCharDropdownOpen(false);
                        onOpenSettingsModal('characters');
                      }}
                      className="w-full py-1 text-center text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3 h-3 text-[var(--accent)]" />
                      <span>Manage Characters in Settings</span>
                    </button>
                  </div>
                </div>,
                document.body
              )}
          </div>
        </div>
      </div>

      {/* Subtle section divider between Search and Actions */}
      <div className="h-3.5 w-px bg-[var(--border)] shrink-0 mx-1 sm:mx-1.5 opacity-60" aria-hidden="true" />

      {/* ================= ATTACHED UNDO / REDO BUTTONS ================= */}
      {onUndo && onRedo && (
        <div
          className="h-6 inline-flex items-center rounded-md border border-[var(--border-light)] bg-[var(--bg-subtle)] p-0.5 shrink-0 transition-colors shadow-2xs hover:border-[var(--border)]"
          role="group"
          aria-label="Undo and Redo"
        >
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title={canUndo ? `Undo (${undoCount} available) (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
          >
            <Undo2 className="w-3 h-3 text-[var(--text-main)]" />
          </button>
          <span className="w-px h-3 bg-[var(--border)] mx-0.5" />
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title={canRedo ? `Redo (${redoCount} available) (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
          >
            <Redo2 className="w-3 h-3 text-[var(--text-main)]" />
          </button>
        </div>
      )}

      {/* ================= RIGHT GROUP: ACTIONS & CONTROLS ================= */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Presence Indicator */}
        {collaborators.length > 1 && (
          <div
            onClick={onOpenUserModal}
            className="items-center gap-1 cursor-pointer text-[9.5px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] mr-0.5 hidden sm:flex"
            title={`${collaborators.length} active editors connected`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{collaborators.length} live</span>
          </div>
        )}

        {/* Section Divider separating Video & Associate button */}
        <div className="h-3.5 w-px bg-[var(--border)] shrink-0 mx-0.5 opacity-60" aria-hidden="true" />

        {/* Video Player Toggle & Associate Button Group */}
        {onToggleVideo && (
          <button
            type="button"
            onClick={onToggleVideo}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isVideoOpen
                ? 'bg-[var(--accent)] text-white shadow-2xs border border-[var(--accent)]'
                : isPipActive
                ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50 animate-pulse border border-amber-500/50'
                : 'border border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
            }`}
            title={
              isPipActive
                ? 'Video in Picture-in-Picture (Click to restore to accordion)'
                : isVideoOpen
                ? 'Collapse Subtitle Video Player'
                : 'Open Subtitle Video Player (Accordion)'
            }
            aria-label="Toggle Subtitle Video Player"
          >
            <Video className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Associate Button (Chain Icon): Glows when active/associated, gray when not, broken red chain when missing */}
        {onToggleAssociate && (
          <button
            type="button"
            onClick={onToggleAssociate}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isCurrentSubtitleMissing
                ? 'border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-border)] shadow-xs animate-pulse'
                : isAssociated
                ? 'bg-[var(--accent)] text-white shadow-[0_0_10px_var(--accent-glow)] border border-[var(--accent)] ring-1 ring-[var(--accent)]'
                : 'border border-[var(--border-light)] text-[var(--text-faint)] bg-[var(--bg-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border)]'
            }`}
            title={
              isCurrentSubtitleMissing
                ? `Associated subtitle file is missing from last saved directory! Click to re-associate or locate.`
                : isAssociated
                ? `Active subtitles are associated with this video (Click to disassociate)`
                : `Associate current subtitles with this video (Click to associate)`
            }
            aria-label="Associate Subtitles with Video"
          >
            {isCurrentSubtitleMissing ? (
              <Unlink className="w-3.5 h-3.5 text-[var(--error-border)]" />
            ) : (
              <Link className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Section Divider separating Video controls from view mode / filters */}
        <div className="h-3.5 w-px bg-[var(--border)] shrink-0 mx-0.5 opacity-60" aria-hidden="true" />

        {/* 1. Details / Card View (Icon only) */}
        {onToggleViewMode && (
          <button
            type="button"
            onClick={onToggleViewMode}
            className="w-6 h-6 rounded-md border border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={viewMode === 'table' ? 'Switch to Card / Details View' : 'Switch to Table Grid View'}
          >
            {viewMode === 'table' ? (
              <List className="w-3.5 h-3.5 text-[var(--accent)]" />
            ) : (
              <LayoutGrid className="w-3.5 h-3.5 text-[var(--accent)]" />
            )}
          </button>
        )}

        {/* 2. Flags (No Number, Icon only) */}
        <button
          type="button"
          onClick={onToggleFlagFilter}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            flagFilterOnly
              ? 'shadow-2xs font-bold border'
              : 'border border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
          }`}
          style={
            flagFilterOnly
              ? {
                  backgroundColor: 'var(--error-bg)',
                  color: 'var(--error-border)',
                  borderColor: 'var(--error-border)',
                }
              : undefined
          }
          title={flagFilterOnly ? 'Show all lines' : `Show flagged lines only (${flaggedCount})`}
        >
          <AlertTriangle
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: flagFilterOnly ? 'var(--error-border)' : 'inherit' }}
          />
        </button>

        {/* 3 & 4. Import & Export (Icon only) */}
        <div
          className="h-6 inline-flex items-center rounded-md border border-[var(--border-light)] bg-[var(--bg-subtle)]/80 p-0.5 shrink-0 transition-colors shadow-2xs hover:border-[var(--border)]"
          role="group"
          aria-label="Import and Export Subtitles"
        >
          {/* Import */}
          <button
            type="button"
            onClick={() => onOpenImportExportModal('import')}
            className="w-5 h-5 rounded flex items-center justify-center hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-all cursor-pointer"
            title="Import Subtitles (SRT, ASS, SSA, WebVTT, YouTube SBV, JSON, CSV, LRC, etc.)"
          >
            <Upload className="w-3 h-3 text-[var(--accent)]" />
          </button>

          <span className="w-px h-3 bg-[var(--border)] mx-0.5" />

          {/* Export */}
          <button
            type="button"
            onClick={() => onOpenImportExportModal('export')}
            className="w-5 h-5 rounded flex items-center justify-center hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-all cursor-pointer"
            title="Export Subtitles (SRT, VTT, ASS, JSON, CSV)"
          >
            <Download className="w-3 h-3 text-[var(--text-muted)] hover:text-[var(--text-main)]" />
          </button>
        </div>

        {/* 5. Settings (Icon only) */}
        <button
          type="button"
          onClick={() => onOpenSettingsModal('series')}
          className="w-6 h-6 rounded-md border border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Project & Series Settings (Series, Characters, Typography)"
        >
          <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
        </button>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="sm:hidden p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-md hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          title="Open tools menu"
        >
          {isMobileMenuOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
        </button>

        {/* Subtle separator before Theme & Profile */}
        <div className="h-3.5 w-px bg-[var(--border)] shrink-0 mx-0.5 opacity-60" aria-hidden="true" />

        {/* Unified Day/Night Toggle (Hold to choose theme) */}
        <ThemeToggle
          isDark={isDark}
          currentTheme={currentTheme}
          availableThemes={availableThemes}
          onToggle={onToggleDarkMode}
          onSelectTheme={onSelectTheme}
        />

        {/* User Profile Avatar */}
        <button
          type="button"
          onClick={onOpenUserModal}
          aria-label="User login and profile"
          title={`Signed in as ${currentUser.name} (Click to change editor profile)`}
          className="w-6 h-6 rounded-full border border-[var(--border)] flex items-center justify-center text-white text-[9px] font-mono font-bold shrink-0 transition-transform hover:scale-105 shadow-2xs cursor-pointer ml-0.5"
          style={{ backgroundColor: currentUser.color }}
        >
          {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <User className="w-2.5 h-2.5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu for Phones */}
      {isMobileMenuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)] shadow-xl p-2.5 flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
          {onToggleVideo && (
            <button
              type="button"
              onClick={() => {
                onToggleVideo();
                setIsMobileMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Video className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{isVideoOpen ? 'Close Video Player' : 'Open Video Player'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onOpenSettingsModal('series');
              setIsMobileMenuOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Settings (Series, Characters, Defaults)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenSettingsModal('language');
              setIsMobileMenuOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Language & Format Settings</span>
          </button>
          {/* Mobile Joined Import & Export buttons */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onOpenImportExportModal('import');
                setIsMobileMenuOpen(false);
              }}
              className="px-2.5 py-1.5 text-center text-xs font-medium text-[var(--text-main)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Import Any File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenImportExportModal('export');
                setIsMobileMenuOpen(false);
              }}
              className="px-2.5 py-1.5 text-center text-xs font-medium text-[var(--text-main)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Export Subtitles</span>
            </button>
          </div>
          {/* Character Filter inside mobile drawer */}
          <div className="pt-1.5 mt-1 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
            <span>Filter Character:</span>
            <select
              value={selectedCharFilter}
              onChange={(e) => onCharFilterChange(e.target.value)}
              className="text-[11px] bg-[var(--bg-subtle)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-main)]"
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {project.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </header>
  );
};

