import React from 'react';
import { Character, SubtitleLine } from '../types/subtitle';
import { Search, AlertTriangle, X, LayoutGrid, List } from 'lucide-react';
import { secondsToTimecode, timecodeToSeconds } from '../utils/timecode';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  flagFilterOnly: boolean;
  onToggleFlagFilter: () => void;
  selectedCharFilter: string;
  onCharFilterChange: (charId: string) => void;
  characters: Character[];
  lines: SubtitleLine[];
  viewMode?: 'table' | 'cards';
  onToggleViewMode?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  flagFilterOnly,
  onToggleFlagFilter,
  selectedCharFilter,
  onCharFilterChange,
  characters,
  lines,
  viewMode = 'table',
  onToggleViewMode,
}) => {
  const flaggedCount = lines.filter((l) => l.flag?.isFlagged).length;
  const maxEndSeconds = lines.reduce((max, l) => {
    const s = timecodeToSeconds(l.endTime);
    return s > max ? s : max;
  }, 0);

  return (
    <div className="h-7.5 px-3 bg-[var(--bg-app)] border-b border-[var(--border)] flex items-center justify-between gap-2 sm:gap-3 text-xs select-none shrink-0 font-sans transition-colors">
      {/* Left Filters */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {/* Search */}
        <div className="flex items-center gap-1.5 w-32 xs:w-44 sm:w-60 min-w-0">
          <Search className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search dialogue, note..."
            className="w-full text-[11px] bg-transparent outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)] truncate"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-[var(--text-faint)] hover:text-[var(--text-main)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <span className="text-[var(--border)]">|</span>

        {/* Flagged filter toggle */}
        <button
          type="button"
          onClick={onToggleFlagFilter}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono cursor-pointer transition-all shrink-0 ${
            flagFilterOnly
              ? 'font-bold shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
          style={
            flagFilterOnly
              ? {
                  backgroundColor: 'var(--error-bg)',
                  color: 'var(--error-border)',
                  border: '1px solid var(--error-border)',
                }
              : undefined
          }
        >
          <AlertTriangle
            className="w-3 h-3"
            style={{ color: flagFilterOnly ? 'var(--error-border)' : 'var(--error-border)' }}
          />
          <span>Flagged ({flaggedCount})</span>
        </button>

        <span className="text-[var(--border)] hidden sm:inline">|</span>

        {/* Character filter dropdown */}
        <select
          value={selectedCharFilter}
          onChange={(e) => onCharFilterChange(e.target.value)}
          className="text-[11px] bg-transparent outline-hidden text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[120px] sm:max-w-none hidden sm:inline-block"
        >
          <option value="all">All Characters</option>
          <option value="unassigned">Unassigned (Narrator)</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Right Stats & View Mode Toggle for Mobile/Tablet */}
      <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] text-[var(--text-faint)] shrink-0">
        {onToggleViewMode && (
          <button
            type="button"
            onClick={onToggleViewMode}
            className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] flex items-center gap-1 transition-colors"
            title={viewMode === 'table' ? 'Switch to Mobile Card View' : 'Switch to Table Grid View'}
          >
            {viewMode === 'table' ? (
              <>
                <List className="w-3 h-3 text-[var(--accent)]" />
                <span className="hidden xs:inline">Cards</span>
              </>
            ) : (
              <>
                <LayoutGrid className="w-3 h-3 text-[var(--accent)]" />
                <span className="hidden xs:inline">Table</span>
              </>
            )}
          </button>
        )}

        <span className="hidden xs:inline">{lines.length} lines</span>
        <span className="hidden xs:inline">·</span>
        <span>{secondsToTimecode(maxEndSeconds)}</span>
      </div>
    </div>
  );
};
