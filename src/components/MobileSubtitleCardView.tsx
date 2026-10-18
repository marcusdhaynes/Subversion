import React, { useState, useMemo, useRef } from 'react';
import { SubtitleLine, Character, DefaultProjectSettings, CollaboratorUser, SubtitleGroup, COMMON_FONTS, FONT_SIZES } from '../types/subtitle';
import { formatLineNumber, formatFolderLineNumber, calculateDuration, timecodeToSeconds, secondsToTimecode } from '../utils/timecode';
import { cleanSubtitleDialogue, parseAndCleanSubtitleText } from '../utils/textCleaner';
import { Flag, Plus, X, ShieldAlert, Bold, Italic, User, Folder, FolderOpen } from 'lucide-react';
import { CharacterPopover } from './CharacterPopover';

interface MobileSubtitleCardViewProps {
  lines: SubtitleLine[];
  characters: Character[];
  defaultSettings: DefaultProjectSettings;
  collaborators: CollaboratorUser[];
  currentUserId: string;
  groups?: SubtitleGroup[];
  onToggleGroupCollapse?: (groupId: string) => void;
  onUpdateLine: (line: SubtitleLine) => void;
  onAddLine: (line: SubtitleLine, afterIndex?: number) => void;
  onDeleteLine: (lineId: string) => void;
  onOpenFlagModal: (line: SubtitleLine) => void;
  onLineFocus: (lineId: string | null) => void;
  activePlayingLineId?: string | null;
  onSeekToLine?: (line: SubtitleLine) => void;
  onAddCharacter?: (character: Character) => void;
}

export const MobileSubtitleCardView: React.FC<MobileSubtitleCardViewProps> = ({
  lines,
  characters,
  defaultSettings,
  collaborators,
  currentUserId,
  groups = [],
  onToggleGroupCollapse,
  onUpdateLine,
  onAddLine,
  onDeleteLine,
  onOpenFlagModal,
  onLineFocus,
  activePlayingLineId,
  onSeekToLine,
  onAddCharacter,
}) => {
  const textInputRefs = useRef<{ [lineId: string]: HTMLInputElement | null }>({});

  // Character Popover state for mobile cards
  const [activeCharPopover, setActiveCharPopover] = useState<{
    targetId: string;
    position: { top: number; left: number };
    title: string;
    currentCharacterId?: string;
  } | null>(null);

  const handleCharacterChange = (line: SubtitleLine, newCharId: string, charObj?: Character) => {
    if (!newCharId) {
      onUpdateLine({ ...line, characterId: undefined });
      return;
    }
    const selectedChar = charObj || characters.find((c) => c.id === newCharId);
    if (selectedChar) {
      onUpdateLine({
        ...line,
        characterId: newCharId,
        font: selectedChar.font,
        size: selectedChar.size,
        bold: selectedChar.bold,
        italic: selectedChar.italic,
      });
    } else {
      onUpdateLine({ ...line, characterId: newCharId });
    }
  };

  const handleSelectCharacterFromPopover = (newCharId?: string, newCharObj?: Character) => {
    if (!activeCharPopover) return;
    const targetLine = lines.find((l) => l.id === activeCharPopover.targetId);
    if (targetLine) {
      handleCharacterChange(targetLine, newCharId || '', newCharObj);
    }
  };

  // Build hierarchical card render list (when a folder is collapsed, lines inside it are not visible)
  interface CardItem {
    id: string;
    type: 'group' | 'line';
    group?: SubtitleGroup;
    line?: SubtitleLine;
    lineNumber?: number;
    depth?: number;
  }

  const cardItems = useMemo<CardItem[]>(() => {
    if (!groups || groups.length === 0) {
      return lines.map((l) => ({ id: l.id, type: 'line', line: l, lineNumber: l.lineNumber, depth: 0 }));
    }

    const childGroupsMap = new Map<string | null, SubtitleGroup[]>();
    groups.forEach((g) => {
      const pKey = g.parentGroupId || null;
      if (!childGroupsMap.has(pKey)) childGroupsMap.set(pKey, []);
      childGroupsMap.get(pKey)!.push(g);
    });

    const linesByGroupMap = new Map<string | null, SubtitleLine[]>();
    lines.forEach((l) => {
      const gKey = l.groupId || null;
      if (!linesByGroupMap.has(gKey)) linesByGroupMap.set(gKey, []);
      linesByGroupMap.get(gKey)!.push(l);
    });

    const result: CardItem[] = [];

    const traverseGroup = (group: SubtitleGroup, depth: number) => {
      const directLines = linesByGroupMap.get(group.id) || [];
      const childGroups = childGroupsMap.get(group.id) || [];
      const firstLineNum = directLines[0]?.lineNumber;

      result.push({
        id: group.id,
        type: 'group',
        group,
        depth,
        lineNumber: firstLineNum,
      });

      // When a line is in a folder and it is collapsed, it is not visible!
      if (group.collapsed) return;

      type ChildEntry =
        | { kind: 'group'; group: SubtitleGroup; time: number }
        | { kind: 'line'; line: SubtitleLine; time: number };

      const children: ChildEntry[] = [
        ...childGroups.map((cg) => {
          const dl = linesByGroupMap.get(cg.id) || [];
          return { kind: 'group' as const, group: cg, time: dl[0] ? timecodeToSeconds(dl[0].startTime) : 0 };
        }),
        ...directLines.map((l) => ({ kind: 'line' as const, line: l, time: timecodeToSeconds(l.startTime) })),
      ].sort((a, b) => a.time - b.time);

      children.forEach((c) => {
        if (c.kind === 'group') {
          traverseGroup(c.group, depth + 1);
        } else {
          result.push({ id: c.line.id, type: 'line', line: c.line, depth: depth + 1 });
        }
      });
    };

    const existingGroupIds = new Set(groups.map((g) => g.id));
    const topGroups = groups.filter((g) => !g.parentGroupId || !existingGroupIds.has(g.parentGroupId));
    const ungrouped = lines.filter((l) => !l.groupId || !existingGroupIds.has(l.groupId));

    type TopEntry =
      | { kind: 'group'; group: SubtitleGroup; time: number }
      | { kind: 'line'; line: SubtitleLine; time: number };

    const topEntries: TopEntry[] = [
      ...topGroups.map((g) => {
        const dl = linesByGroupMap.get(g.id) || [];
        return { kind: 'group' as const, group: g, time: dl[0] ? timecodeToSeconds(dl[0].startTime) : 0 };
      }),
      ...ungrouped.map((l) => ({ kind: 'line' as const, line: l, time: timecodeToSeconds(l.startTime) })),
    ].sort((a, b) => a.time - b.time);

    topEntries.forEach((entry) => {
      if (entry.kind === 'group') {
        traverseGroup(entry.group, 0);
      } else {
        result.push({ id: entry.line.id, type: 'line', line: entry.line, depth: 0 });
      }
    });

    return result;
  }, [groups, lines]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, line: SubtitleLine, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentEndSec = timecodeToSeconds(line.endTime);
      const nextStart = secondsToTimecode(currentEndSec);
      const nextEnd = secondsToTimecode(currentEndSec + 2.5);

      const newLine: SubtitleLine = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        lineNumber: line.lineNumber + 1,
        startTime: nextStart,
        endTime: nextEnd,
        characterId: line.characterId,
        font: line.font,
        size: line.size,
        bold: line.bold,
        italic: line.italic,
        text: '',
      };

      onAddLine(newLine, index);

      setTimeout(() => {
        textInputRefs.current[newLine.id]?.focus();
      }, 30);
    }
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-2 py-2 space-y-1.5 bg-[var(--bg-app)]">
      {cardItems.map((item, itemIndex) => {
        if (item.type === 'group' && item.group) {
          const group = item.group;
          const isCollapsed = !!group.collapsed;
          const depth = item.depth || 0;
          const depthClass = depth === 0 ? 'folder-depth-0' : depth === 1 ? 'folder-depth-1' : depth === 2 ? 'folder-depth-2' : 'folder-depth-3';
          return (
            <div
              key={`group-${group.id}`}
              className={`p-2 rounded-lg border text-xs font-sans transition-all ${depthClass} border-[var(--border)] text-[var(--text-main)] shadow-2xs ${
                depth === 0
                  ? 'border-l-[3.5px] border-l-[var(--folder-accent)]'
                  : depth === 1
                  ? 'border-l-[4px] border-l-[var(--tree-rail)]'
                  : 'border-l-[4.5px] border-l-[var(--tree-rail-sub)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onToggleGroupCollapse?.(group.id)}
                  className="flex items-center gap-2 cursor-pointer font-mono font-medium text-[11px] hover:underline"
                  title={
                    isCollapsed
                      ? `Folder "${group.name}" is collapsed — Tap line number to expand`
                      : `Folder "${group.name}" is open — Tap line number to collapse`
                  }
                >
                  {isCollapsed ? (
                    <Folder className="w-4 h-4 text-[var(--folder-accent)] opacity-75 shrink-0" />
                  ) : (
                    <FolderOpen className="w-4 h-4 text-[var(--folder-accent)] opacity-75 shrink-0" />
                  )}
                  <span className={isCollapsed ? 'text-[var(--folder-accent)] font-medium' : 'text-[var(--text-muted)] font-medium'}>
                    #{item.lineNumber ? formatFolderLineNumber(item.lineNumber) : '01'}
                  </span>
                  <span className="font-sans font-semibold text-xs truncate text-[var(--text-main)]">
                    {group.name}
                  </span>
                </button>
              </div>
            </div>
          );
        }

        const line = item.line!;
        const index = itemIndex;
        const depth = item.depth || 0;
        const depthClass = depth === 0 ? 'line-depth-0' : depth === 1 ? 'line-depth-1' : depth === 2 ? 'line-depth-2' : 'line-depth-3';
        const isFlagged = !!line.flag?.isFlagged;
        const character = line.characterId ? characters.find((c) => c.id === line.characterId) : null;
        const effectiveFont = line.font || character?.font || defaultSettings.font || 'Inter';
        const effectiveSize = line.size || character?.size || defaultSettings.size || 18;
        const isBold = line.bold !== undefined ? line.bold : (character?.bold ?? defaultSettings.bold);
        const isItalic = line.italic !== undefined ? line.italic : (character?.italic ?? defaultSettings.italic);
        const durationSec = calculateDuration(line.startTime, line.endTime);

        const editorOnThisLine = collaborators.find(
          (c) => c.currentLineId === line.id && c.id !== currentUserId
        );

        const isCurrentlyPlaying = activePlayingLineId === line.id;

        return (
          <div
            key={line.id}
            className={`p-2 rounded-lg border text-xs font-sans ${depthClass} ${
              isCurrentlyPlaying
                ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)] border-l-4 border-l-[var(--accent)] shadow-md'
                : isFlagged
                ? 'bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--error-text)] shadow-2xs'
                : depth === 1
                ? 'border-[var(--border)] border-l-[3px] border-l-[var(--tree-rail-subtle)] text-[var(--text-main)] shadow-2xs'
                : depth >= 2
                ? 'border-[var(--border)] border-l-[3.5px] border-l-[var(--tree-rail)] text-[var(--text-main)] shadow-2xs'
                : 'border-[var(--border)] text-[var(--text-main)] shadow-2xs'
            } ${editorOnThisLine ? 'ring-1 ring-[var(--accent)]/50' : ''}`}
          >
            {/* Top row: Line #, Times, Speaker, Flag */}
            <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5 pb-1 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-1.5 font-mono">
                <button
                  type="button"
                  onClick={() => onSeekToLine?.(line)}
                  title={`Click to jump video to ${line.startTime}`}
                  className="font-bold cursor-pointer hover:underline hover:text-[var(--accent)] flex items-center gap-1 text-[var(--text-main)]"
                >
                  {isCurrentlyPlaying && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  )}
                  {depth === 1 && !isCurrentlyPlaying && (
                    <span className="text-[var(--tree-rail)] font-bold text-[9.5px] select-none opacity-80">│</span>
                  )}
                  {depth >= 2 && !isCurrentlyPlaying && (
                    <span className="text-[var(--tree-rail-sub)] font-bold text-[9.5px] select-none opacity-90">║</span>
                  )}
                  <span>#{formatLineNumber(line.lineNumber)}</span>
                </button>
                <span className="text-[var(--text-muted)]">
                  {line.startTime.split(':').slice(1).join(':')} → {line.endTime.split(':').slice(1).join(':')}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">({durationSec.toFixed(1)}s)</span>
              </div>

              {/* Character [Icon only] & Flag */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveCharPopover({
                      targetId: line.id,
                      position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 60) },
                      title: `Character - Line #${formatLineNumber(line.lineNumber)}`,
                      currentCharacterId: line.characterId,
                    });
                  }}
                  className={`w-5.5 h-5.5 rounded flex items-center justify-center transition-all cursor-pointer ${
                    character
                      ? 'bg-[var(--bg-subtle)] border border-[var(--border)] shadow-2xs'
                      : 'text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                  title={character ? `Character: ${character.name}` : 'Assign character'}
                  aria-label={character ? `Character ${character.name}` : 'Assign character'}
                >
                  <User
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: character ? character.color : 'inherit' }}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenFlagModal(line)}
                  className={`p-1 rounded text-[10px] flex items-center gap-1 font-mono transition-all ${
                    isFlagged
                      ? 'font-bold'
                      : 'text-[var(--text-faint)] hover:text-[var(--error-border)]'
                  }`}
                  style={
                    isFlagged
                      ? {
                          backgroundColor: 'var(--error-bg)',
                          color: 'var(--error-border)',
                          border: '1px solid var(--error-border)',
                        }
                      : {}
                  }
                  title={line.flag?.note || 'Flag line'}
                >
                  {isFlagged ? (
                    <ShieldAlert className="w-3 h-3" style={{ color: 'var(--error-border)' }} />
                  ) : (
                    <Flag className="w-3 h-3" />
                  )}
                  {isFlagged && (
                    <span
                      className="px-1 rounded-2xs text-[9px] text-white"
                      style={{ backgroundColor: 'var(--error-badge)' }}
                    >
                      {line.flag?.code || 'ERR'}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Middle: Strictly single-line text input (Strips markup) */}
            <div className="mb-1.5">
              <input
                ref={(el) => {
                  textInputRefs.current[line.id] = el;
                }}
                type="text"
                dir="auto"
                value={cleanSubtitleDialogue(line.text)}
                onChange={(e) => {
                  const parsed = parseAndCleanSubtitleText(e.target.value);
                  onUpdateLine({
                    ...line,
                    text: parsed.cleanText,
                    font: parsed.font || line.font,
                    size: parsed.size || line.size,
                    bold: parsed.bold !== undefined ? parsed.bold : line.bold,
                    italic: parsed.italic !== undefined ? parsed.italic : line.italic,
                    color: parsed.color || line.color,
                  });
                }}
                onKeyDown={(e) => handleKeyDown(e, line, index)}
                onFocus={() => onLineFocus(line.id)}
                onBlur={() => onLineFocus(null)}
                placeholder="Enter dialogue (tap Enter for next)..."
                style={{
                  fontFamily: effectiveFont,
                  fontWeight: isBold ? 'bold' : 'normal',
                  fontStyle: isItalic ? 'italic' : 'normal',
                  color: line.color || character?.color || 'inherit',
                }}
                className="w-full h-7 px-2 text-xs bg-[var(--bg-app)] rounded border border-[var(--border)] focus:border-[var(--accent)] outline-hidden text-[var(--text-main)] truncate"
              />
            </div>

            {/* Bottom Row: Typography and Quick Actions */}
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
              <div className="flex items-center gap-1.5">
                <select
                  value={line.font || ''}
                  onChange={(e) => onUpdateLine({ ...line, font: e.target.value || undefined })}
                  className="bg-transparent text-[10px] outline-hidden text-[var(--text-muted)] cursor-pointer"
                >
                  <option value="">{effectiveFont}</option>
                  {COMMON_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                <span>·</span>

                <select
                  value={line.size || ''}
                  onChange={(e) =>
                    onUpdateLine({ ...line, size: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="bg-transparent text-[10px] outline-hidden text-[var(--text-muted)] cursor-pointer"
                >
                  <option value="">{effectiveSize}px</option>
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onUpdateLine({ ...line, bold: !isBold })}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                    isBold ? 'text-[var(--accent)] bg-[var(--accent-subtle)]' : 'text-[var(--text-faint)] hover:text-[var(--text-main)]'
                  }`}
                  title="Bold"
                  aria-label="Bold"
                >
                  <Bold className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateLine({ ...line, italic: !isItalic })}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                    isItalic ? 'text-[var(--accent)] bg-[var(--accent-subtle)]' : 'text-[var(--text-faint)] hover:text-[var(--text-main)]'
                  }`}
                  title="Italic"
                  aria-label="Italic"
                >
                  <Italic className="w-3 h-3" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const start = secondsToTimecode(timecodeToSeconds(line.endTime));
                    const end = secondsToTimecode(timecodeToSeconds(line.endTime) + 2.5);
                    onAddLine(
                      {
                        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        lineNumber: line.lineNumber + 1,
                        startTime: start,
                        endTime: end,
                        characterId: line.characterId,
                        font: line.font,
                        size: line.size,
                        bold: line.bold,
                        italic: line.italic,
                        text: '',
                      },
                      index
                    );
                  }}
                  className="p-1 text-[var(--accent)] hover:bg-[var(--bg-subtle)] rounded transition-colors"
                  title="Add line below"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteLine(line.id)}
                  className="p-1 text-[var(--text-faint)] hover:text-rose-500 hover:bg-[var(--bg-subtle)] rounded transition-colors"
                  title="Delete line"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {lines.length === 0 && (
        <div className="p-8 text-center text-[var(--text-faint)] text-xs">
          No subtitle lines match current filter.
        </div>
      )}

      {/* Character Popover for mobile cards */}
      {activeCharPopover && (
        <CharacterPopover
          isOpen={!!activeCharPopover}
          onClose={() => setActiveCharPopover(null)}
          position={activeCharPopover.position}
          title={activeCharPopover.title}
          characters={characters}
          selectedCharacterId={activeCharPopover.currentCharacterId}
          onSelect={handleSelectCharacterFromPopover}
          onAddCharacter={onAddCharacter}
        />
      )}
    </div>
  );
};
