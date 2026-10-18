import React, { useState, useMemo } from 'react';
import {
  DatabaseSubtitleTrack,
  MediaMedium,
  getAllDatabaseTracks,
  getOrganizedHierarchyTree,
  HierarchyTree,
} from '../utils/mediaDatabase';
import { SubtitleTrackType, SubtitleLine } from '../types/subtitle';
import {
  Database,
  Film,
  Tv,
  Radio,
  Sparkles,
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  Check,
  Languages,
  Captions,
  X,
  Play,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { getLanguageByCode } from '../utils/languages';

interface MediaDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrackId?: string;
  onSelectTrack: (track: DatabaseSubtitleTrack) => void;
  onRequestTranslate?: (track: DatabaseSubtitleTrack) => void;
}

export const MediaDatabaseModal: React.FC<MediaDatabaseModalProps> = ({
  isOpen,
  onClose,
  currentTrackId,
  onSelectTrack,
  onRequestTranslate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedium, setSelectedMedium] = useState<string>('All');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'Movie': true,
    'TV Show': true,
    'Anime': true,
    'Audio Drama': true,
    'Movie > The Matrix': true,
    'TV Show > Digimon': true,
    'Anime > Digimon': true,
    "Audio Drama > We're Alive": true,
  });

  const allTracks = useMemo(() => getAllDatabaseTracks(), [isOpen]);
  const hierarchyTree = useMemo(() => getOrganizedHierarchyTree(), [isOpen, allTracks]);

  if (!isOpen) return null;

  const toggleNode = (nodePath: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodePath]: !prev[nodePath],
    }));
  };

  const getMediumIcon = (medium: string) => {
    switch (medium) {
      case 'Movie':
        return <Film className="w-3.5 h-3.5 text-blue-500" />;
      case 'TV Show':
      case 'Anime':
        return <Tv className="w-3.5 h-3.5 text-purple-500" />;
      case 'Audio Drama':
      case 'Podcast':
        return <Radio className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Database className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-3xl h-[85vh] max-h-[700px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center shadow-2xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-main)]">
                  Media Subtitle Database
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[10px] font-mono text-[var(--accent)] font-bold">
                  {allTracks.length} Tracks
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-faint)]">
                Structured by Medium → Title → Season → Episode → Variant → Language → Type
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center gap-2 shrink-0">
          <div className="flex-1 flex items-center gap-2 px-2.5 h-7 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)]">
            <Search className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Matrix, Digimon, We're Alive, or language..."
              className="w-full text-[11px] bg-transparent outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[var(--text-faint)] hover:text-[var(--text-main)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Medium Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
            {['All', 'Movie', 'TV Show', 'Anime', 'Audio Drama'].map((med) => (
              <button
                key={med}
                type="button"
                onClick={() => setSelectedMedium(med)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                  selectedMedium === med
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-2xs'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {med}
              </button>
            ))}
          </div>
        </div>

        {/* Tree Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          {Object.entries(hierarchyTree).map(([medium, titles]) => {
            if (selectedMedium !== 'All' && selectedMedium !== medium) return null;
            const mediumOpen = expandedNodes[medium] ?? true;

            return (
              <div key={medium} className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/50 overflow-hidden">
                {/* Level 1: Medium */}
                <button
                  type="button"
                  onClick={() => toggleNode(medium)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {mediumOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                    )}
                    <span className="font-semibold text-[11px] text-[var(--text-main)] flex items-center gap-1.5">
                      {getMediumIcon(medium)}
                      <span>Medium: {medium}</span>
                    </span>
                  </div>
                  <span className="text-[9.5px] text-[var(--text-faint)]">
                    {Object.keys(titles).length} titles
                  </span>
                </button>

                {mediumOpen && (
                  <div className="p-2 space-y-2 border-t border-[var(--border)]">
                    {Object.entries(titles).map(([titleName, seasons]) => {
                      const titlePath = `${medium} > ${titleName}`;
                      const titleOpen = expandedNodes[titlePath] ?? true;

                      // Filter check if searching
                      if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        const matchesTitle = titleName.toLowerCase().includes(q);
                        const matchesMedium = medium.toLowerCase().includes(q);
                        if (!matchesTitle && !matchesMedium) return null;
                      }

                      return (
                        <div key={titleName} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                          {/* Level 2: Title / Franchise */}
                          <div
                            onClick={() => toggleNode(titlePath)}
                            className="flex items-center justify-between cursor-pointer py-1 px-1 rounded hover:bg-[var(--bg-hover)]"
                          >
                            <div className="flex items-center gap-1.5 font-sans font-bold text-[11.5px] text-[var(--text-main)]">
                              {titleOpen ? (
                                <ChevronDown className="w-3 h-3 text-[var(--accent)]" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-[var(--accent)]" />
                              )}
                              <span>• {titleName}</span>
                            </div>
                            <span className="text-[9px] font-mono text-[var(--text-faint)]">
                              {Object.keys(seasons).length} release(s)
                            </span>
                          </div>

                          {titleOpen && (
                            <div className="ml-4 mt-1.5 space-y-2 border-l-2 border-[var(--border)] pl-2">
                              {Object.entries(seasons).map(([seasonName, episodes]) => (
                                <div key={seasonName} className="space-y-1">
                                  {/* Level 3: Season */}
                                  <div className="text-[10.5px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                                    <span className="text-[var(--text-faint)]">--</span>
                                    <span>{seasonName}</span>
                                  </div>

                                  <div className="ml-3 space-y-1.5 border-l border-[var(--border-light)] pl-2">
                                    {Object.entries(episodes).map(([episodeName, variants]) => (
                                      <div key={episodeName} className="space-y-1">
                                        {/* Level 4: Episode */}
                                        <div className="text-[10px] font-medium text-[var(--text-main)] flex items-center gap-1">
                                          <span className="text-[var(--text-faint)]">---</span>
                                          <span>{episodeName}</span>
                                        </div>

                                        <div className="ml-3 space-y-1.5 border-l border-[var(--border-light)] pl-2">
                                          {Object.entries(variants).map(([variantName, languages]) => (
                                            <div key={variantName} className="space-y-1">
                                              {/* Level 5: Variant */}
                                              <div className="text-[9.5px] font-medium text-[var(--text-faint)] flex items-center gap-1">
                                                <span>----</span>
                                                <span className="px-1 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
                                                  Variant: {variantName}
                                                </span>
                                              </div>

                                              {/* Level 6 & 7: Language & Type */}
                                              <div className="ml-3 space-y-1 pt-0.5">
                                                {Object.entries(languages).map(([langCode, types]) => {
                                                  const langObj = getLanguageByCode(langCode);
                                                  return (
                                                    <div key={langCode} className="space-y-1">
                                                      <div className="text-[9.5px] font-semibold text-[var(--accent)] flex items-center gap-1">
                                                        <span>-----</span>
                                                        <Languages className="w-2.5 h-2.5" />
                                                        <span>Language: {langObj.name} ({langCode.toUpperCase()})</span>
                                                      </div>

                                                      <div className="ml-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                                                        {Object.entries(types).map(([typeName, track]) => {
                                                          const isCurrent = track.id === currentTrackId;

                                                          return (
                                                            <div
                                                              key={typeName}
                                                              className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                                                                isCurrent
                                                                  ? 'bg-[var(--accent-subtle)] border-[var(--accent)] shadow-2xs'
                                                                  : 'bg-[var(--bg-subtle)] border-[var(--border)] hover:border-[var(--border-hover)]'
                                                              }`}
                                                            >
                                                              <div className="min-w-0 font-sans">
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="text-[10px] font-bold text-[var(--text-main)] flex items-center gap-1">
                                                                    <Captions className="w-3 h-3 text-[var(--accent)]" />
                                                                    {typeName}
                                                                  </span>
                                                                  {track.isPrimary && (
                                                                    <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8.5px] font-bold">
                                                                      PRIMARY
                                                                    </span>
                                                                  )}
                                                                </div>
                                                                <div className="text-[9px] font-mono text-[var(--text-faint)] truncate mt-0.5">
                                                                  {track.lines?.length || 0} lines · {track.format || 'srt'}
                                                                </div>
                                                              </div>

                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  onSelectTrack(track);
                                                                  onClose();
                                                                }}
                                                                className="px-2 py-1 rounded bg-[var(--accent)] hover:opacity-90 text-[var(--accent-contrast)] text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                                                              >
                                                                <Play className="w-2.5 h-2.5 fill-current" />
                                                                <span>Open</span>
                                                              </button>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[var(--bg-subtle)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-faint)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Database active & synchronized with disk & local sessions</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
