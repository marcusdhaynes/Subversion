import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  SubtitleLine,
  Character,
  Series,
  DefaultProjectSettings,
  CollaboratorUser,
  COMMON_FONTS,
  FONT_SIZES,
  CHARACTER_PALETTE,
  ShadowSettings,
  OutlineSettings,
  SubtitleGroup,
} from '../types/subtitle';
import { formatLineNumber, formatFolderLineNumber, calculateDuration, calculateCps, secondsToTimecode, timecodeToSeconds } from '../utils/timecode';
import { cleanSubtitleDialogue, parseAndCleanSubtitleText } from '../utils/textCleaner';
import {
  Flag,
  Plus,
  X,
  ShieldAlert,
  Video,
  Check,
  Trash2,
  User,
  Users,
  ChevronDown,
  Type,
  Heading,
  Palette,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  ALargeSmall,
  Sun,
  Layers,
  Sparkles,
  Music,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderMinus,
  FolderTree,
  GripVertical,
  ChevronRight,
  Edit2,
  ArrowLeft,
} from 'lucide-react';
import { ColorWheelPicker } from './ColorWheelPicker';
import { LightEffectsModal, buildTextShadow } from './LightEffectsModal';
import { StylePopover, StyleValues } from './StylePopover';
import { MusicPopover } from './MusicPopover';
import { CharacterPopover } from './CharacterPopover';
import { MusicSymbol, MusicPlacement, applyMusic, stripMusicSymbols } from '../utils/musicSymbols';

interface SubtitleTableProps {
  lines: SubtitleLine[];
  characters: Character[];
  defaultSettings: DefaultProjectSettings;
  collaborators: CollaboratorUser[];
  currentUserId: string;
  onUpdateLine: (line: SubtitleLine) => void;
  onUpdateLines?: (lines: SubtitleLine[]) => void;
  onAddLine: (line: SubtitleLine, afterIndex?: number) => void;
  onDeleteLine: (lineId: string) => void;
  onDeleteLines?: (lineIds: string[]) => void;
  onOpenFlagModal: (line: SubtitleLine) => void;
  onLineFocus: (lineId: string | null) => void;
  isVideoOpen?: boolean;
  isPipActive?: boolean;
  onToggleVideo?: () => void;
  activePlayingLineId?: string | null;
  onSeekToLine?: (line: SubtitleLine) => void;
  seriesId?: string;
  seriesList?: Series[];
  // Groups / folders support
  groups?: SubtitleGroup[];
  onCreateGroup?: (name: string, lineIds: string[], parentGroupId?: string | null) => SubtitleGroup;
  onUpdateGroup?: (group: SubtitleGroup, applyStylesToLines?: boolean) => void;
  onDeleteGroup?: (groupId: string, deleteLines?: boolean) => void;
  onToggleGroupCollapse?: (groupId: string) => void;
  onMoveLinesToGroup?: (lineIds: string[], targetGroupId: string | null) => void;
  onMoveGroup?: (groupId: string, targetParentGroupId: string | null) => void;
  onReorderProjectItems?: (newLines: SubtitleLine[], newGroups: SubtitleGroup[]) => void;
  onAddCharacter?: (character: Character) => void;
  projectTitle?: string;
  onSaveTitleFormatting?: (updates: any) => void;
}


export const SubtitleTable: React.FC<SubtitleTableProps> = ({
  lines,
  characters,
  defaultSettings,
  collaborators,
  currentUserId,
  onUpdateLine,
  onUpdateLines,
  onAddLine,
  onDeleteLine,
  onDeleteLines,
  onOpenFlagModal,
  onLineFocus,
  isVideoOpen = false,
  isPipActive = false,
  onToggleVideo,
  activePlayingLineId,
  onSeekToLine,
  seriesId,
  seriesList,
  groups = [],
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onToggleGroupCollapse,
  onMoveLinesToGroup,
  onMoveGroup,
  onReorderProjectItems,
  onAddCharacter,
  projectTitle = '',
  onSaveTitleFormatting,
}) => {
  const textInputRefs = useRef<{ [lineId: string]: HTMLInputElement | null }>({});
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  // Multi-select state
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Groups & sub-groups state
  const [isGroupPopoverOpen, setIsGroupPopoverOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParentId, setNewGroupParentId] = useState<string>('none');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const groupDropdownRef = useRef<HTMLDivElement | null>(null);

  // Drag and Drop state (Supports multi-line selection drag)
  const [draggedItem, setDraggedItem] = useState<{
    type: 'line' | 'group';
    id: string;
    memberIds?: string[];
  } | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: string;
    targetType: 'line' | 'group';
    position: 'before' | 'after' | 'into';
  } | null>(null);

  // Close group popover on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setIsGroupPopoverOpen(false);
      }
    };
    if (isGroupPopoverOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isGroupPopoverOpen]);

  // Bulk character assignment dropdown state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement | null>(null);
  const charListScrollRef = useRef<HTMLDivElement | null>(null);
  const savedCharScrollPos = useRef<number>(0);
  const [isBulkAddingChar, setIsBulkAddingChar] = useState(false);
  const [bulkNewName, setBulkNewName] = useState('');
  const [bulkNewColor, setBulkNewColor] = useState<string>(CHARACTER_PALETTE[0]);
  const [bulkNewFont, setBulkNewFont] = useState<string>('Inter');
  const [bulkNewSize, setBulkNewSize] = useState<number>(18);
  const [bulkNewBold, setBulkNewBold] = useState<boolean>(false);
  const [bulkNewItalic, setBulkNewItalic] = useState<boolean>(false);
  const [bulkNewDescription, setBulkNewDescription] = useState<string>('');

  // Bulk font, size, and color popovers state
  const [isFontOpen, setIsFontOpen] = useState(false);
  const fontDropdownRef = useRef<HTMLDivElement | null>(null);

  const [isSizeOpen, setIsSizeOpen] = useState(false);
  const sizeDropdownRef = useRef<HTMLDivElement | null>(null);

  const [isColorOpen, setIsColorOpen] = useState(false);
  const colorDropdownRef = useRef<HTMLDivElement | null>(null);

  // Restore scroll position when character popup opens if setting is enabled & reset add form
  useEffect(() => {
    if (isAssignOpen) {
      if (charListScrollRef.current) {
        const shouldRemember = defaultSettings.rememberCharacterListScroll !== false;
        if (shouldRemember && savedCharScrollPos.current > 0) {
          charListScrollRef.current.scrollTop = savedCharScrollPos.current;
        }
      }
      setBulkNewName('');
      setBulkNewColor(CHARACTER_PALETTE[Math.floor(Math.random() * CHARACTER_PALETTE.length)]);
      setBulkNewFont(defaultSettings.font || 'Inter');
      setBulkNewSize(defaultSettings.size || 18);
      setBulkNewBold(defaultSettings.bold || false);
      setBulkNewItalic(defaultSettings.italic || false);
      setBulkNewDescription('');
    } else {
      setIsBulkAddingChar(false);
    }
  }, [isAssignOpen, defaultSettings]);

  // Time shift with smooth animated amount selector & animated unit button
  const [timeShiftAmount, setTimeShiftAmount] = useState('100');
  const [timeShiftUnit, setTimeShiftUnit] = useState<'ms' | 's'>('ms');
  const [isUnitExpanded, setIsUnitExpanded] = useState(false);
  const [isAmountExpanded, setIsAmountExpanded] = useState(false);
  const amountExpanderRef = useRef<HTMLDivElement | null>(null);
  const unitExpanderRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  // Close amount expander & unit expander on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (amountExpanderRef.current && !amountExpanderRef.current.contains(e.target as Node)) {
        setIsAmountExpanded(false);
      }
      if (unitExpanderRef.current && !unitExpanderRef.current.contains(e.target as Node)) {
        setIsUnitExpanded(false);
      }
    };
    if (isAmountExpanded || isUnitExpanded) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAmountExpanded, isUnitExpanded]);

  // Expanding Style (B/I) and Light (Shadow/Outline) buttons
  const [expandedStyleLineId, setExpandedStyleLineId] = useState<string | null>(null);
  const [expandedLightLineId, setExpandedLightLineId] = useState<string | null>(null);
  const [isBulkStyleExpanded, setIsBulkStyleExpanded] = useState<boolean>(false);
  const [isBulkLightExpanded, setIsBulkLightExpanded] = useState<boolean>(false);

  // Unified Style Popover state (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript)
  const [activeStylePopover, setActiveStylePopover] = useState<{
    targetId: string;
    position: { top: number; left: number };
    title: string;
    values: StyleValues;
  } | null>(null);

  // Music Notes Popover state (♪, ♫, ♬, ♩, Placement)
  const [activeMusicPopover, setActiveMusicPopover] = useState<{
    targetId: string;
    position: { top: number; left: number };
    title: string;
    lineText: string;
  } | null>(null);

  // Character Assignment Popover state (Line and Group Character selection)
  const [activeCharPopover, setActiveCharPopover] = useState<{
    targetId: string;
    position: { top: number; left: number };
    title: string;
    currentCharacterId?: string;
  } | null>(null);

  // Light Effects Modal state
  const [activeLightModal, setActiveLightModal] = useState<{
    lineId: string | 'bulk';
    defaultTab: 'shadow' | 'outline';
    initialShadow?: ShadowSettings;
    initialOutline?: OutlineSettings;
    position?: { top: number; left: number };
  } | null>(null);

  // Auto-close light expanders after 5 seconds of inactivity
  useEffect(() => {
    if (!expandedLightLineId && !isBulkLightExpanded) return;

    let timer: number | null = null;

    const startTimer = () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => {
        setExpandedLightLineId(null);
        setIsBulkLightExpanded(false);
      }, 5000);
    };

    startTimer();

    const handleActivity = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('[data-light-expander]')) {
        startTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [expandedLightLineId, isBulkLightExpanded]);

  // Close row-level expanded buttons on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-style-expander]')) {
        setExpandedStyleLineId(null);
        setIsBulkStyleExpanded(false);
      }
      if (!target.closest('[data-light-expander]')) {
        setExpandedLightLineId(null);
        setIsBulkLightExpanded(false);
      }
    };
    if (expandedStyleLineId || expandedLightLineId || isBulkStyleExpanded || isBulkLightExpanded) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [expandedStyleLineId, expandedLightLineId, isBulkStyleExpanded, isBulkLightExpanded]);

  const toggleMusicForText = useCallback((text: string): string => {
    const trimmed = (text || '').trim();
    const startsWithMusic = trimmed.startsWith('♪') || trimmed.startsWith('♫');
    const endsWithMusic = trimmed.endsWith('♪') || trimmed.endsWith('♫');

    if (startsWithMusic && endsWithMusic) {
      return trimmed.replace(/^[♪♫\s]+|[♪♫\s]+$/g, '');
    } else {
      const clean = trimmed.replace(/^[♪♫\s]+|[♪♫\s]+$/g, '');
      return clean ? `♪ ${clean} ♪` : '♪ ♪';
    }
  }, []);

  const hasMusicNotes = useCallback((text: string): boolean => {
    const trimmed = (text || '').trim();
    return (trimmed.startsWith('♪') || trimmed.startsWith('♫')) && (trimmed.endsWith('♪') || trimmed.endsWith('♫'));
  }, []);

  const handleBulkToggleMusic = useCallback(() => {
    if (selectedLineIds.size === 0) return;
    const allHaveMusic = lines
      .filter((l) => selectedLineIds.has(l.id))
      .every((l) => hasMusicNotes(l.text) || l.hasMusicSymbols);

    const updated = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        const newText = allHaveMusic
          ? line.text.trim().replace(/^[♪♫\s]+|[♪♫\s]+$/g, '')
          : toggleMusicForText(line.text);
        return {
          ...line,
          text: newText,
          hasMusicSymbols: !allHaveMusic,
        };
      }
      return line;
    });

    if (onUpdateLines) {
      onUpdateLines(updated);
    } else {
      updated.forEach((l) => onUpdateLine(l));
    }
  }, [selectedLineIds, lines, hasMusicNotes, toggleMusicForText, onUpdateLines, onUpdateLine]);

  // Count how many of the currently selected lines are in any group
  const selectedLinesInGroupCount = useMemo(() => {
    return lines.filter((l) => selectedLineIds.has(l.id) && !!l.groupId).length;
  }, [lines, selectedLineIds]);

  // Fast O(1) Lookup Maps to eliminate repeated O(N) find/findIndex during rendering
  const lineIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < lines.length; i++) {
      map.set(lines[i].id, i);
    }
    return map;
  }, [lines]);

  const charMap = useMemo(() => {
    const map = new Map<string, Character>();
    for (let i = 0; i < characters.length; i++) {
      map.set(characters[i].id, characters[i]);
    }
    return map;
  }, [characters]);

  const collabMap = useMemo(() => {
    const map = new Map<string, CollaboratorUser>();
    for (let i = 0; i < collaborators.length; i++) {
      const c = collaborators[i];
      if (c.id !== currentUserId && c.currentLineId) {
        map.set(c.currentLineId, c);
      }
    }
    return map;
  }, [collaborators, currentUserId]);

  // Pre-indexed Group Info (descendants and member line IDs in a single pass)
  const groupStatsMap = useMemo(() => {
    const directLinesMap = new Map<string, SubtitleLine[]>();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.groupId) {
        if (!directLinesMap.has(l.groupId)) directLinesMap.set(l.groupId, []);
        directLinesMap.get(l.groupId)!.push(l);
      }
    }

    const childGroupsMap = new Map<string, string[]>();
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.parentGroupId) {
        if (!childGroupsMap.has(g.parentGroupId)) childGroupsMap.set(g.parentGroupId, []);
        childGroupsMap.get(g.parentGroupId)!.push(g.id);
      }
    }

    const stats = new Map<string, {
      allGroupIds: Set<string>;
      memberLines: SubtitleLine[];
      memberLineIds: string[];
      earliestStart: string;
      latestEnd: string;
      count: number;
    }>();

    for (let i = 0; i < groups.length; i++) {
      const rootId = groups[i].id;
      const allGroupIds = new Set<string>([rootId]);
      const queue = [rootId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const children = childGroupsMap.get(curr) || [];
        for (let j = 0; j < children.length; j++) {
          if (!allGroupIds.has(children[j])) {
            allGroupIds.add(children[j]);
            queue.push(children[j]);
          }
        }
      }

      const memberLines: SubtitleLine[] = [];
      allGroupIds.forEach((gid) => {
        const direct = directLinesMap.get(gid);
        if (direct) {
          for (let k = 0; k < direct.length; k++) {
            memberLines.push(direct[k]);
          }
        }
      });

      let earliestStart = '00:00:00.000';
      let latestEnd = '00:00:00.000';

      if (memberLines.length > 0) {
        let minStartSec = Infinity;
        let maxEndSec = -Infinity;
        for (let k = 0; k < memberLines.length; k++) {
          const s = timecodeToSeconds(memberLines[k].startTime);
          const e = timecodeToSeconds(memberLines[k].endTime);
          if (s < minStartSec) {
            minStartSec = s;
            earliestStart = memberLines[k].startTime;
          }
          if (e > maxEndSec) {
            maxEndSec = e;
            latestEnd = memberLines[k].endTime;
          }
        }
      }

      stats.set(rootId, {
        allGroupIds,
        memberLines,
        memberLineIds: memberLines.map((l) => l.id),
        earliestStart,
        latestEnd,
        count: memberLines.length,
      });
    }

    return stats;
  }, [groups, lines]);

  // Collect all member line IDs for a group (recursive for nested subgroups) - Instant O(1)
  const getGroupMembers = useCallback(
    (groupId: string) => {
      const found = groupStatsMap.get(groupId);
      if (found) return found;
      return {
        allGroupIds: new Set<string>([groupId]),
        memberLines: [],
        memberLineIds: [],
        earliestStart: '00:00:00.000',
        latestEnd: '00:00:00.000',
        count: 0,
      };
    },
    [groupStatsMap]
  );

  // Precomputed set of group IDs belonging to the hovered folder hierarchy (for O(1) blur checks)
  const hoveredFolderHierarchyIds = useMemo(() => {
    if (!hoveredFolderId) return null;
    return groupStatsMap.get(hoveredFolderId)?.allGroupIds || new Set<string>([hoveredFolderId]);
  }, [hoveredFolderId, groupStatsMap]);

  // Toggle selection for all lines in a group
  const handleToggleSelectGroup = useCallback(
    (groupId: string) => {
      const { memberLineIds } = getGroupMembers(groupId);
      if (memberLineIds.length === 0) return;
      const allSelected = memberLineIds.every((id) => selectedLineIds.has(id));
      setSelectedLineIds((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          memberLineIds.forEach((id) => next.delete(id));
        } else {
          memberLineIds.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    [getGroupMembers, selectedLineIds]
  );

  // Build the hierarchical flat render list (Decoupled from selectedLineIds for 0ms selection speed)
  interface RenderTreeItem {
    id: string;
    type: 'group' | 'line';
    group?: SubtitleGroup;
    line?: SubtitleLine;
    depth: number;
    earliestStart?: string;
    latestEnd?: string;
    memberCount?: number;
  }

  const displayTreeItems = useMemo<RenderTreeItem[]>(() => {
    const childGroupsMap = new Map<string | null, SubtitleGroup[]>();
    groups.forEach((g) => {
      const parentKey = g.parentGroupId || null;
      if (!childGroupsMap.has(parentKey)) childGroupsMap.set(parentKey, []);
      childGroupsMap.get(parentKey)!.push(g);
    });

    const linesByGroupMap = new Map<string | null, SubtitleLine[]>();
    lines.forEach((l) => {
      const gKey = l.groupId || null;
      if (!linesByGroupMap.has(gKey)) linesByGroupMap.set(gKey, []);
      linesByGroupMap.get(gKey)!.push(l);
    });

    const result: RenderTreeItem[] = [];

    const traverseGroup = (group: SubtitleGroup, depth: number) => {
      const info = getGroupMembers(group.id);

      result.push({
        id: group.id,
        type: 'group',
        group,
        depth,
        earliestStart: info.earliestStart,
        latestEnd: info.latestEnd,
        memberCount: info.count,
      });

      if (group.collapsed) return;

      const childGroups = childGroupsMap.get(group.id) || [];
      const directLines = linesByGroupMap.get(group.id) || [];

      type ChildEntry =
        | { kind: 'group'; group: SubtitleGroup; time: number }
        | { kind: 'line'; line: SubtitleLine; time: number };

      const childEntries: ChildEntry[] = [
        ...childGroups.map((cg) => {
          const cgInfo = getGroupMembers(cg.id);
          return { kind: 'group' as const, group: cg, time: timecodeToSeconds(cgInfo.earliestStart) };
        }),
        ...directLines.map((dl) => ({ kind: 'line' as const, line: dl, time: timecodeToSeconds(dl.startTime) })),
      ].sort((a, b) => a.time - b.time);

      childEntries.forEach((entry) => {
        if (entry.kind === 'group') {
          traverseGroup(entry.group, depth + 1);
        } else {
          result.push({
            id: entry.line.id,
            type: 'line',
            line: entry.line,
            depth: depth + 1,
          });
        }
      });
    };

    const existingGroupIds = new Set(groups.map((g) => g.id));
    const topGroups = groups.filter((g) => !g.parentGroupId || !existingGroupIds.has(g.parentGroupId));
    const ungroupedLines = lines.filter((l) => !l.groupId || !existingGroupIds.has(l.groupId));

    type TopEntry =
      | { kind: 'group'; group: SubtitleGroup; time: number }
      | { kind: 'line'; line: SubtitleLine; time: number };

    const topEntries: TopEntry[] = [
      ...topGroups.map((g) => {
        const gInfo = getGroupMembers(g.id);
        return { kind: 'group' as const, group: g, time: timecodeToSeconds(gInfo.earliestStart) };
      }),
      ...ungroupedLines.map((l) => ({ kind: 'line' as const, line: l, time: timecodeToSeconds(l.startTime) })),
    ].sort((a, b) => a.time - b.time);

    topEntries.forEach((entry) => {
      if (entry.kind === 'group') {
        traverseGroup(entry.group, 0);
      } else {
        result.push({
          id: entry.line.id,
          type: 'line',
          line: entry.line,
          depth: 0,
        });
      }
    });

    return result;
  }, [groups, lines, getGroupMembers]);

  // Drag and drop handlers with drop zones (before, after, into folder) and outside blur
  // Full Multi-Selection Support: When dragging any selected line, ALL selected lines move together!
  const handleDragStart = (e: React.DragEvent, type: 'line' | 'group', id: string) => {
    e.dataTransfer.effectAllowed = 'move';

    if (type === 'line') {
      let memberIds: string[];
      if (selectedLineIds.size > 0) {
        if (selectedLineIds.has(id)) {
          // Drag all selected lines in their natural project order
          memberIds = lines.filter((l) => selectedLineIds.has(l.id)).map((l) => l.id);
        } else {
          // Include dragged line in selection and move all together
          setSelectedLineIds((prev) => new Set([...prev, id]));
          memberIds = [...lines.filter((l) => selectedLineIds.has(l.id)).map((l) => l.id), id];
        }
      } else {
        memberIds = [id];
      }

      setDraggedItem({ type: 'line', id, memberIds });
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'line', id, memberIds }));

      // Custom compact drag preview badge: prevents container from scrolling with cursor!
      const dragPreview = document.createElement('div');
      dragPreview.style.position = 'absolute';
      dragPreview.style.top = '-9999px';
      dragPreview.style.left = '-9999px';
      dragPreview.style.padding = '4px 10px';
      dragPreview.style.background = 'var(--accent, #6366f1)';
      dragPreview.style.color = '#ffffff';
      dragPreview.style.borderRadius = '6px';
      dragPreview.style.fontSize = '11px';
      dragPreview.style.fontFamily = 'monospace';
      dragPreview.style.fontWeight = 'bold';
      dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
      dragPreview.style.pointerEvents = 'none';
      dragPreview.style.zIndex = '9999';

      const lineObj = lines.find((l) => l.id === id);
      if (memberIds.length > 1) {
        dragPreview.textContent = `📑 Moving ${memberIds.length} lines`;
      } else {
        const lineText = lineObj?.text ? ` "${lineObj.text.slice(0, 18)}..."` : '';
        dragPreview.textContent = `📄 ${formatLineNumber(lineObj?.lineNumber || 1)}${lineText}`;
      }
      document.body.appendChild(dragPreview);
      e.dataTransfer.setDragImage(dragPreview, 15, 15);
      setTimeout(() => {
        if (document.body.contains(dragPreview)) {
          document.body.removeChild(dragPreview);
        }
      }, 0);
    } else {
      setDraggedItem({ type: 'group', id });
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id }));

      const grp = groups.find((g) => g.id === id);
      const dragPreview = document.createElement('div');
      dragPreview.style.position = 'absolute';
      dragPreview.style.top = '-9999px';
      dragPreview.style.left = '-9999px';
      dragPreview.style.padding = '4px 10px';
      dragPreview.style.background = '#f59e0b';
      dragPreview.style.color = '#ffffff';
      dragPreview.style.borderRadius = '6px';
      dragPreview.style.fontSize = '11px';
      dragPreview.style.fontFamily = 'sans-serif';
      dragPreview.style.fontWeight = 'bold';
      dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
      dragPreview.style.pointerEvents = 'none';
      dragPreview.style.zIndex = '9999';
      dragPreview.textContent = `📁 ${grp?.name || 'Folder'}`;
      document.body.appendChild(dragPreview);
      e.dataTransfer.setDragImage(dragPreview, 15, 15);
      setTimeout(() => {
        if (document.body.contains(dragPreview)) {
          document.body.removeChild(dragPreview);
        }
      }, 0);
    }
  };

  const handleDragOverGroup = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedItem || draggedItem.id === groupId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    let position: 'before' | 'after' | 'into' = 'into';

    // Top 22% = insert before, Bottom 22% = insert after, Middle = drop into folder
    if (relY < rect.height * 0.22) {
      position = 'before';
    } else if (relY > rect.height * 0.78) {
      position = 'after';
    } else {
      position = 'into';
    }

    const nextHovered = position === 'into' ? groupId : null;
    setHoveredFolderId((prev) => (prev === nextHovered ? prev : nextHovered));

    setDropIndicator((prev) => {
      if (prev?.targetId === groupId && prev?.targetType === 'group' && prev?.position === position) {
        return prev;
      }
      return { targetId: groupId, targetType: 'group', position };
    });
  }, [draggedItem]);

  const handleDragLeaveGroup = useCallback((e: React.DragEvent, groupId: string) => {
    const related = e.relatedTarget as HTMLElement;
    if (!related || !e.currentTarget.contains(related)) {
      setHoveredFolderId((prev) => (prev === groupId ? null : prev));
      setDropIndicator((prev) => (prev?.targetId === groupId ? null : prev));
    }
  }, []);

  const handleDragOverLine = useCallback((e: React.DragEvent, lineId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedItem) return;

    // Do not show drop placement line inside the currently dragged lines
    const movingLineIds = draggedItem.memberIds || (draggedItem.type === 'line' ? [draggedItem.id] : []);
    if (movingLineIds.includes(lineId)) {
      setDropIndicator(null);
      setHoveredFolderId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    setDropIndicator((prev) => {
      if (prev?.targetId === lineId && prev?.targetType === 'line' && prev?.position === position) {
        return prev;
      }
      return { targetId: lineId, targetType: 'line', position };
    });

    // When hovering over a line row, it is not hovering over a folder; it is strictly for placement!
    setHoveredFolderId(null);
  }, [draggedItem]);

  const handleDropOnGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    const position = dropIndicator?.position || 'into';
    const movingLineIds = draggedItem.memberIds || (draggedItem.type === 'line' ? [draggedItem.id] : []);

    if (position === 'into') {
      if (draggedItem.type === 'line' && movingLineIds.length > 0) {
        // Move ALL selected lines into target folder!
        onMoveLinesToGroup?.(movingLineIds, targetGroupId);
      } else if (draggedItem.type === 'group' && draggedItem.id !== targetGroupId) {
        onMoveGroup?.(draggedItem.id, targetGroupId);
      }
    } else {
      // Reordering relative to group (before / after)
      if (draggedItem.type === 'group' && draggedItem.id !== targetGroupId) {
        const targetGroup = groups.find((g) => g.id === targetGroupId);
        const fromIdx = groups.findIndex((g) => g.id === draggedItem.id);
        if (fromIdx !== -1 && targetGroup) {
          const nextGroups = [...groups];
          const [moved] = nextGroups.splice(fromIdx, 1);
          moved.parentGroupId = targetGroup.parentGroupId || null;
          let toIdx = nextGroups.findIndex((g) => g.id === targetGroupId);
          if (position === 'after') {
            nextGroups.splice(toIdx + 1, 0, moved);
          } else {
            nextGroups.splice(toIdx, 0, moved);
          }
          if (onReorderProjectItems) {
            onReorderProjectItems(lines, nextGroups);
          }
        }
      } else if (draggedItem.type === 'line' && movingLineIds.length > 0) {
        const targetGroup = groups.find((g) => g.id === targetGroupId);
        const targetParentGroupId = targetGroup?.parentGroupId || null;
        const targetGroupStats = groupStatsMap.get(targetGroupId);
        const memberLines = targetGroupStats?.memberLines || [];

        let referenceLineId: string | null = null;
        if (memberLines.length > 0) {
          referenceLineId = position === 'before' ? memberLines[0].id : memberLines[memberLines.length - 1].id;
        }

        const movingSet = new Set(movingLineIds);
        const movingObjects = lines
          .filter((l) => movingSet.has(l.id))
          .map((l) => ({ ...l, groupId: targetParentGroupId }));

        const remaining = lines.filter((l) => !movingSet.has(l.id));

        if (referenceLineId) {
          const refIdx = remaining.findIndex((l) => l.id === referenceLineId);
          if (refIdx !== -1) {
            const insertIdx = position === 'after' ? refIdx + 1 : refIdx;
            remaining.splice(insertIdx, 0, ...movingObjects);
          } else {
            remaining.push(...movingObjects);
          }
        } else {
          remaining.push(...movingObjects);
        }

        if (onReorderProjectItems) {
          onReorderProjectItems(remaining, groups);
        } else if (onUpdateLines) {
          onUpdateLines(remaining);
        }
      }
    }

    setDraggedItem(null);
    setHoveredFolderId(null);
    setDropIndicator(null);
  };

  const handleDropOnLine = (e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    const position = dropIndicator?.position || 'before';
    const movingLineIds = draggedItem.memberIds || (draggedItem.type === 'line' ? [draggedItem.id] : []);

    if (draggedItem.type === 'line' && movingLineIds.length > 0) {
      const movingSet = new Set(movingLineIds);
      if (movingSet.has(targetLineId)) {
        setDraggedItem(null);
        setHoveredFolderId(null);
        setDropIndicator(null);
        return;
      }

      const targetLine = lines.find((l) => l.id === targetLineId);
      const targetGroupId = targetLine?.groupId || null;

      // Extract moving lines in their current order, updating their groupId to targetGroupId
      const movingObjects = lines
        .filter((l) => movingSet.has(l.id))
        .map((l) => ({ ...l, groupId: targetGroupId }));

      // Remaining lines without the moved items
      const remaining = lines.filter((l) => !movingSet.has(l.id));
      const targetIdx = remaining.findIndex((l) => l.id === targetLineId);

      if (targetIdx !== -1) {
        const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
        remaining.splice(insertIdx, 0, ...movingObjects);

        if (onReorderProjectItems) {
          onReorderProjectItems(remaining, groups);
        } else if (onUpdateLines) {
          onUpdateLines(remaining);
        }
      }
    } else if (draggedItem.type === 'group') {
      const targetLine = lines.find((l) => l.id === targetLineId);
      if (targetLine) {
        onMoveGroup?.(draggedItem.id, targetLine.groupId || null);
      }
    }

    setDraggedItem(null);
    setHoveredFolderId(null);
    setDropIndicator(null);
  };

  // Group-level helper actions
  const handleGroupToggleBold = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const nextBold = !group.bold;
    onUpdateGroup?.({ ...group, bold: nextBold }, true);
  };

  const handleGroupToggleItalic = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const nextItalic = !group.italic;
    onUpdateGroup?.({ ...group, italic: nextItalic }, true);
  };

  const handleApplyMusic = useCallback(
    (symbol: MusicSymbol, placement: MusicPlacement) => {
      if (!activeMusicPopover) return;
      const target = activeMusicPopover.targetId;
      const isOff = placement === 'none';

      if (target.startsWith('group:')) {
        const gId = target.replace('group:', '');
        const group = groups.find((g) => g.id === gId);
        if (!group) return;
        const { memberLines } = getGroupMembers(gId);
        const updated = memberLines.map((l) => {
          const newText = isOff ? stripMusicSymbols(l.text) : applyMusic(l.text, symbol, placement);
          return {
            ...l,
            hasMusicSymbols: !isOff,
            text: newText,
          };
        });
        if (onUpdateLines) onUpdateLines(updated);
        onUpdateGroup?.({ ...group, hasMusicSymbols: !isOff }, false);
      } else if (target === 'bulk') {
        const updated = lines.map((l) => {
          if (selectedLineIds.has(l.id)) {
            const newText = isOff ? stripMusicSymbols(l.text) : applyMusic(l.text, symbol, placement);
            return {
              ...l,
              hasMusicSymbols: !isOff,
              text: newText,
            };
          }
          return l;
        });
        if (onUpdateLines) onUpdateLines(updated);
        else updated.forEach((l) => selectedLineIds.has(l.id) && onUpdateLine(l));
      } else {
        const lineId = target.replace('line:', '');
        const targetLine = lines.find((l) => l.id === lineId);
        if (targetLine) {
          const newText = isOff ? stripMusicSymbols(targetLine.text) : applyMusic(targetLine.text, symbol, placement);
          onUpdateLine({
            ...targetLine,
            hasMusicSymbols: !isOff,
            text: newText,
          });
        }
      }
    },
    [activeMusicPopover, groups, lines, selectedLineIds, getGroupMembers, onUpdateLines, onUpdateGroup, onUpdateLine]
  );

  const handleGroupToggleMusic = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const nextMusic = !group.hasMusicSymbols;
    const { memberLines } = getGroupMembers(groupId);
    const updated = memberLines.map((l) => ({
      ...l,
      hasMusicSymbols: nextMusic,
      text: nextMusic ? toggleMusicForText(l.text) : l.text.trim().replace(/^[♪♫\s]+|[♪♫\s]+$/g, ''),
    }));
    if (onUpdateLines) onUpdateLines(updated);
    onUpdateGroup?.({ ...group, hasMusicSymbols: nextMusic }, false);
  };

  const handleAddLineToGroup = (groupId: string) => {
    const { memberLines } = getGroupMembers(groupId);
    let nextStart = '00:00:01.000';
    let nextEnd = '00:00:03.500';

    if (memberLines.length > 0) {
      const lastLine = memberLines[memberLines.length - 1];
      const lastEndSec = timecodeToSeconds(lastLine.endTime);
      nextStart = secondsToTimecode(lastEndSec + 0.1);
      nextEnd = secondsToTimecode(lastEndSec + 2.6);
    } else if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastEndSec = timecodeToSeconds(lastLine.endTime);
      nextStart = secondsToTimecode(lastEndSec + 0.1);
      nextEnd = secondsToTimecode(lastEndSec + 2.6);
    }

    const group = groups.find((g) => g.id === groupId);
    if (group?.collapsed) {
      if (onToggleGroupCollapse) {
        onToggleGroupCollapse(groupId);
      } else if (onUpdateGroup) {
        onUpdateGroup({ ...group, collapsed: false }, false);
      }
    }

    const newLine: SubtitleLine = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      lineNumber: lines.length + 1,
      startTime: nextStart,
      endTime: nextEnd,
      groupId,
      characterId: group?.characterId,
      font: group?.font || defaultSettings.font,
      size: group?.size || defaultSettings.size,
      bold: group?.bold !== undefined ? group.bold : defaultSettings.bold,
      italic: group?.italic !== undefined ? group.italic : defaultSettings.italic,
      color: group?.color,
      shadow: group?.shadow,
      outline: group?.outline,
      hasMusicSymbols: group?.hasMusicSymbols,
      text: '',
    };

    onAddLine(newLine);
    setTimeout(() => {
      textInputRefs.current[newLine.id]?.focus();
    }, 50);
  };

  const handleToggleGroupCollapse = useCallback(
    (groupId: string) => {
      if (onToggleGroupCollapse) {
        onToggleGroupCollapse(groupId);
      } else if (onUpdateGroup) {
        const group = groups.find((g) => g.id === groupId);
        if (group) {
          onUpdateGroup({ ...group, collapsed: !group.collapsed }, false);
        }
      }
    },
    [onToggleGroupCollapse, onUpdateGroup, groups]
  );

  const handleAddSubGroup = (parentGroupId: string) => {
    const parentGroup = groups.find((g) => g.id === parentGroupId);
    const subCount = groups.filter((g) => g.parentGroupId === parentGroupId).length + 1;
    const subName = `${parentGroup?.name || 'Group'} Sub-group ${subCount}`;
    onCreateGroup?.(subName, [], parentGroupId);
  };

  const handleCreateGroupFromSelection = () => {
    if (selectedLineIds.size === 0) return;
    const name = newGroupName.trim() || `Group ${groups.length + 1}`;
    const parentId = newGroupParentId === 'none' ? null : newGroupParentId;
    if (onCreateGroup) {
      onCreateGroup(name, Array.from(selectedLineIds), parentId);
    }
    setNewGroupName('');
    setNewGroupParentId('none');
    setIsGroupPopoverOpen(false);
  };

  const handleAddSelectedToExistingGroup = (targetGroupId: string) => {
    if (selectedLineIds.size === 0) return;
    if (onMoveLinesToGroup) {
      onMoveLinesToGroup(Array.from(selectedLineIds), targetGroupId);
    }
    setIsGroupPopoverOpen(false);
  };

  const handleRemoveSelectedFromGroup = () => {
    if (selectedLineIds.size === 0) return;
    if (onMoveLinesToGroup) {
      onMoveLinesToGroup(Array.from(selectedLineIds), null);
    }
    setIsGroupPopoverOpen(false);
  };

  const handleTimeShift = useCallback(
    (direction: 1 | -1) => {
      const val = parseFloat(timeShiftAmount);
      if (isNaN(val) || val <= 0) return;
      const deltaSeconds = (timeShiftUnit === 'ms' ? val / 1000 : val) * direction;

      const updatedLines = lines.map((line) => {
        if (selectedLineIds.has(line.id)) {
          const curStart = timecodeToSeconds(line.startTime);
          const curEnd = timecodeToSeconds(line.endTime);
          const newStart = Math.max(0, curStart + deltaSeconds);
          const newEnd = Math.max(newStart + 0.05, curEnd + deltaSeconds);
          return {
            ...line,
            startTime: secondsToTimecode(newStart),
            endTime: secondsToTimecode(newEnd),
          };
        }
        return line;
      });

      if (onUpdateLines) {
        onUpdateLines(updatedLines);
      } else {
        updatedLines.forEach((l) => {
          if (selectedLineIds.has(l.id)) {
            onUpdateLine(l);
          }
        });
      }
    },
    [timeShiftAmount, timeShiftUnit, lines, selectedLineIds, onUpdateLines, onUpdateLine]
  );

  // Close assign, font, size, and color dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(target)) {
        setIsAssignOpen(false);
      }
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setIsFontOpen(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(target)) {
        setIsSizeOpen(false);
      }
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(target)) {
        setIsColorOpen(false);
      }
    };
    if (isAssignOpen || isFontOpen || isSizeOpen || isColorOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAssignOpen, isFontOpen, isSizeOpen, isColorOpen]);

  // Determine current active series
  const currentSeries = useMemo(() => {
    if (seriesId && seriesList && seriesList.length > 0) {
      return seriesList.find((s) => s.id === seriesId);
    }
    return undefined;
  }, [seriesId, seriesList]);

  // Active characters list:
  // "All if no series assigned, or that series if one is assigned."
  const activeCharacters = useMemo(() => {
    if (currentSeries) {
      if (currentSeries.characters && currentSeries.characters.length > 0) {
        return currentSeries.characters;
      }
      return characters;
    }
    // No series assigned: combine all characters from project and library
    const charMap = new Map<string, Character>();
    characters.forEach((c) => charMap.set(c.id, c));
    seriesList?.forEach((s) => {
      s.characters?.forEach((c) => {
        if (!charMap.has(c.id)) {
          charMap.set(c.id, c);
        }
      });
    });
    return Array.from(charMap.values());
  }, [currentSeries, characters, seriesList]);

  // Color Picker Popover state
  const [activeColorPicker, setActiveColorPicker] = useState<{
    lineId: string;
    initialColor: string;
    position: { top: number; left: number };
  } | null>(null);

  // Auto-scroll to active playing row when video plays (disabled during drag to prevent scrolling with cursor)
  // Use behavior: 'auto' so continuous animated smooth scrolls don't lock or throttle the browser render thread
  useEffect(() => {
    if (activePlayingLineId && activeRowRef.current && !draggedItem) {
      activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [activePlayingLineId, draggedItem]);

  // Handle line checkbox toggle with Shift + click range multi-select
  const handleToggleSelectLine = useCallback(
    (lineId: string, index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedLineIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastClickedIndex !== null) {
          const start = Math.min(lastClickedIndex, index);
          const end = Math.max(lastClickedIndex, index);
          const shouldSelect = !prev.has(lineId);
          for (let i = start; i <= end; i++) {
            if (lines[i]) {
              if (shouldSelect) {
                next.add(lines[i].id);
              } else {
                next.delete(lines[i].id);
              }
            }
          }
        } else {
          if (next.has(lineId)) {
            next.delete(lineId);
          } else {
            next.add(lineId);
          }
        }
        return next;
      });
      setLastClickedIndex(index);
    },
    [lastClickedIndex, lines]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedLineIds.size === lines.length && lines.length > 0) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(lines.map((l) => l.id)));
    }
  }, [selectedLineIds.size, lines]);

  const handleColorChange = useCallback(
    (newColor: string) => {
      if (!activeColorPicker) return;
      const target = activeColorPicker.lineId;
      if (target.startsWith('group:')) {
        const gId = target.replace('group:', '');
        const targetGroup = groups.find((g) => g.id === gId);
        if (targetGroup && onUpdateGroup) {
          onUpdateGroup({ ...targetGroup, color: newColor }, true);
        }
      } else if (target === 'bulk') {
        const updated = lines.map((l) =>
          selectedLineIds.has(l.id) ? { ...l, color: newColor } : l
        );
        if (onUpdateLines) {
          onUpdateLines(updated);
        } else {
          updated.forEach((l) => selectedLineIds.has(l.id) && onUpdateLine(l));
        }
      } else {
        const cleanLineId = target.replace('line:', '');
        const targetLine = lines.find((l) => l.id === cleanLineId);
        if (targetLine) {
          onUpdateLine({ ...targetLine, color: newColor });
        }

        // If the targeted line is part of a multi-selection, update all selected lines simultaneously in a single batch
        if (selectedLineIds.has(cleanLineId) && selectedLineIds.size > 1) {
          const updated = lines.map((l) =>
            selectedLineIds.has(l.id) ? { ...l, color: newColor } : l
          );
          if (onUpdateLines) {
            onUpdateLines(updated);
          } else {
            updated.forEach((l) => selectedLineIds.has(l.id) && onUpdateLine(l));
          }
        }
      }

      if (activeStylePopover) {
        setActiveStylePopover((prev) =>
          prev ? { ...prev, values: { ...prev.values, color: newColor } } : null
        );
      }
      // ONLY change format for all if ALL lines are selected
      if (onSaveTitleFormatting) {
        const isAllSelected = target === 'bulk' && selectedLineIds.size === lines.length && lines.length > 0;
        if (isAllSelected) {
          onSaveTitleFormatting({ color: newColor });
        }
      }
    },
    [activeColorPicker, lines, groups, onUpdateGroup, onUpdateLine, onUpdateLines, selectedLineIds, activeStylePopover, onSaveTitleFormatting]
  );

  const handleApplyStyle = useCallback(
    (updates: Partial<StyleValues>) => {
      if (!activeStylePopover) return;
      const target = activeStylePopover.targetId;

      if (target.startsWith('group:')) {
        const gId = target.replace('group:', '');
        const targetGroup = groups.find((g) => g.id === gId);
        if (targetGroup && onUpdateGroup) {
          onUpdateGroup({ ...targetGroup, ...updates }, true);
        }
      } else if (target === 'bulk') {
        const updated = lines.map((l) =>
          selectedLineIds.has(l.id) ? { ...l, ...updates } : l
        );
        if (onUpdateLines) {
          onUpdateLines(updated);
        } else {
          updated.forEach((l) => selectedLineIds.has(l.id) && onUpdateLine(l));
        }
      } else {
        const lineId = target.replace('line:', '');
        const isMulti = selectedLineIds.has(lineId) && selectedLineIds.size > 1;

        if (isMulti) {
          const updated = lines.map((l) =>
            selectedLineIds.has(l.id) ? { ...l, ...updates } : l
          );
          if (onUpdateLines) {
            onUpdateLines(updated);
          } else {
            updated.forEach((l) => selectedLineIds.has(l.id) && onUpdateLine(l));
          }
        } else {
          const targetLine = lines.find((l) => l.id === lineId);
          if (targetLine) {
            onUpdateLine({ ...targetLine, ...updates });
          }
        }
      }

      setActiveStylePopover((prev) =>
        prev ? { ...prev, values: { ...prev.values, ...updates } } : null
      );
      // ONLY change format for all if ALL lines are selected
      if (onSaveTitleFormatting) {
        const isAllSelected = target === 'bulk' && selectedLineIds.size === lines.length && lines.length > 0;
        if (isAllSelected) {
          onSaveTitleFormatting(updates);
        }
      }
    },
    [activeStylePopover, lines, groups, selectedLineIds, onUpdateLine, onUpdateLines, onUpdateGroup, onSaveTitleFormatting]
  );

  const handleCharacterChange = (line: SubtitleLine, newCharId: string) => {
    if (!newCharId) {
      onUpdateLine({
        ...line,
        characterId: undefined,
      });
      return;
    }

    const selectedChar = characters.find((c) => c.id === newCharId);
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
      onUpdateLine({
        ...line,
        characterId: newCharId,
      });
    }
  };

  const handleSelectCharacterFromPopover = useCallback(
    (newCharId?: string, newCharObj?: Character) => {
      if (!activeCharPopover) return;
      const target = activeCharPopover.targetId;

      if (target.startsWith('group:')) {
        const gId = target.replace('group:', '');
        const group = groups.find((g) => g.id === gId);
        if (!group) return;
        const selChar = newCharObj || (newCharId ? characters.find((c) => c.id === newCharId) : undefined);
        onUpdateGroup?.(
          {
            ...group,
            characterId: newCharId,
            font: selChar ? selChar.font : group.font,
            size: selChar ? selChar.size : group.size,
            bold: selChar ? selChar.bold : group.bold,
            italic: selChar ? selChar.italic : group.italic,
          },
          true
        );
      } else if (target.startsWith('line:')) {
        const lineId = target.replace('line:', '');
        const targetLine = lines.find((l) => l.id === lineId);
        if (targetLine) {
          if (!newCharId) {
            onUpdateLine({ ...targetLine, characterId: undefined });
          } else {
            const selChar = newCharObj || characters.find((c) => c.id === newCharId);
            if (selChar) {
              onUpdateLine({
                ...targetLine,
                characterId: newCharId,
                font: selChar.font,
                size: selChar.size,
                bold: selChar.bold,
                italic: selChar.italic,
              });
            } else {
              handleCharacterChange(targetLine, newCharId);
            }
          }
        }
      }
    },
    [activeCharPopover, groups, characters, onUpdateGroup, lines, handleCharacterChange, onUpdateLine]
  );

  const handleBulkAssignCharacter = (charId?: string, explicitCharObj?: Character) => {
    const selectedChar = explicitCharObj || (charId ? activeCharacters.find((c) => c.id === charId) : undefined);

    const updatedLines = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        if (selectedChar) {
          return {
            ...line,
            characterId: selectedChar.id,
            font: selectedChar.font,
            size: selectedChar.size,
            bold: selectedChar.bold,
            italic: selectedChar.italic,
          };
        } else {
          return {
            ...line,
            characterId: undefined,
          };
        }
      }
      return line;
    });

    if (onUpdateLines) {
      onUpdateLines(updatedLines);
    } else {
      updatedLines.forEach((l) => {
        if (selectedLineIds.has(l.id)) {
          onUpdateLine(l);
        }
      });
    }
  };

  const handleCreateBulkCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkNewName.trim()) return;

    const newChar: Character = {
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: bulkNewName.trim().toUpperCase(),
      color: bulkNewColor,
      font: bulkNewFont,
      size: bulkNewSize,
      bold: bulkNewBold,
      italic: bulkNewItalic,
      description: bulkNewDescription.trim() || undefined,
    };

    onAddCharacter?.(newChar);
    handleBulkAssignCharacter(newChar.id, newChar);
    setIsBulkAddingChar(false);
    setIsAssignOpen(false);
  };

  const handleBulkFontChange = (font: string) => {
    const updatedLines = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        return { ...line, font };
      }
      return line;
    });
    if (onUpdateLines) {
      onUpdateLines(updatedLines);
    } else {
      updatedLines.forEach((l) => {
        if (selectedLineIds.has(l.id)) onUpdateLine(l);
      });
    }
    if (selectedLineIds.size === lines.length && lines.length > 0 && onSaveTitleFormatting) {
      onSaveTitleFormatting({ font });
    }
    setIsFontOpen(false);
  };

  const handleBulkSizeChange = (size: number) => {
    const updatedLines = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        return { ...line, size };
      }
      return line;
    });
    if (onUpdateLines) {
      onUpdateLines(updatedLines);
    } else {
      updatedLines.forEach((l) => {
        if (selectedLineIds.has(l.id)) onUpdateLine(l);
      });
    }
    if (selectedLineIds.size === lines.length && lines.length > 0 && onSaveTitleFormatting) {
      onSaveTitleFormatting({ size });
    }
    setIsSizeOpen(false);
  };

  const handleBulkColorChange = (color: string) => {
    const updatedLines = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        return { ...line, color };
      }
      return line;
    });
    if (onUpdateLines) {
      onUpdateLines(updatedLines);
    } else {
      updatedLines.forEach((l) => {
        if (selectedLineIds.has(l.id)) onUpdateLine(l);
      });
    }
    if (selectedLineIds.size === lines.length && lines.length > 0 && onSaveTitleFormatting) {
      onSaveTitleFormatting({ color });
    }
    setIsColorOpen(false);
  };

  const handleBulkToggleBold = () => {
    // If all selected are bold, toggle them to false; otherwise set all to true
    const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
    const allBold = selectedLines.every((l) => {
      if (l.bold !== undefined) return l.bold;
      const char = characters.find((c) => c.id === l.characterId);
      return char ? char.bold : defaultSettings.bold;
    });
    const newBold = !allBold;

    const updatedLines = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        return { ...line, bold: newBold };
      }
      return line;
    });
    if (onUpdateLines) {
      onUpdateLines(updatedLines);
    } else {
      updatedLines.forEach((l) => {
        if (selectedLineIds.has(l.id)) onUpdateLine(l);
      });
    }
  };

  const handleBulkToggleItalic = () => {
    // If all selected are italic, toggle them to false; otherwise set all to true
    const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
    const allItalic = selectedLines.every((l) => {
      if (l.italic !== undefined) return l.italic;
      const char = characters.find((c) => c.id === l.characterId);
      return char ? char.italic : defaultSettings.italic;
    });
    const newItalic = !allItalic;

    const updatedLines = lines.map((line) => {
      if (selectedLineIds.has(line.id)) {
        return { ...line, italic: newItalic };
      }
      return line;
    });
    if (onUpdateLines) {
      onUpdateLines(updatedLines);
    } else {
      updatedLines.forEach((l) => {
        if (selectedLineIds.has(l.id)) onUpdateLine(l);
      });
    }
  };

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

  // Check if an item (group or line) belongs inside a target folder / group hierarchy
  const isItemInsideHoveredFolder = useCallback(
    (item: RenderTreeItem, targetFolderHierarchy: Set<string> | null): boolean => {
      if (!targetFolderHierarchy) return false;
      if (item.type === 'group' && item.group) {
        return targetFolderHierarchy.has(item.group.id);
      } else if (item.type === 'line' && item.line) {
        return item.line.groupId ? targetFolderHierarchy.has(item.line.groupId) : false;
      }
      return false;
    },
    []
  );

  const renderGroupRow = (group: SubtitleGroup, item: RenderTreeItem, shouldBlur: boolean) => {
    const depth = item.depth;
    const groupChar = group.characterId ? charMap.get(group.characterId) : null;
    const isGroupHoveredTarget = hoveredFolderId === group.id && dropIndicator?.position === 'into';
    const isPlacementBefore = dropIndicator?.targetId === group.id && dropIndicator.position === 'before';
    const isPlacementAfter = dropIndicator?.targetId === group.id && dropIndicator.position === 'after';
    const stats = groupStatsMap.get(group.id);
    const isAllSelected = !!(stats && stats.memberLineIds.length > 0 && stats.memberLineIds.every((id) => selectedLineIds.has(id)));
    const isSomeSelected = !isAllSelected && !!(stats && stats.memberLineIds.some((id) => selectedLineIds.has(id)));
    const depthClass = depth === 0 ? 'folder-depth-0' : depth === 1 ? 'folder-depth-1' : depth === 2 ? 'folder-depth-2' : 'folder-depth-3';

    return (
      <tr
        key={`group-${group.id}`}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, 'group', group.id)}
        onDragOver={(e) => handleDragOverGroup(e, group.id)}
        onDragLeave={(e) => handleDragLeaveGroup(e, group.id)}
        onDrop={(e) => handleDropOnGroup(e, group.id)}
        onDragEnd={() => {
          setDraggedItem(null);
          setHoveredFolderId(null);
          setDropIndicator(null);
        }}
        style={{
          filter: shouldBlur ? 'blur(2.5px)' : 'none',
          opacity: shouldBlur ? 0.35 : draggedItem?.id === group.id ? 0.4 : 1,
          transition: 'filter 0.15s ease, opacity 0.15s ease',
          pointerEvents: shouldBlur ? 'none' : 'auto',
        }}
        className={`dense-grid-row group/grp relative select-none border-b border-[var(--border)] transition-colors duration-150 ${depthClass} ${
          isGroupHoveredTarget
            ? 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-subtle)]/80 shadow-md'
            : isAllSelected
            ? 'row-selected bg-[var(--accent-subtle)]/60 text-[var(--text-main)] font-semibold'
            : 'text-[var(--text-main)] font-medium'
        } ${isPlacementBefore ? 'drop-placement-before' : ''} ${isPlacementAfter ? 'drop-placement-after' : ''}`}
      >
        {/* Select Box Column (Sticky left-0, with prominent folder hierarchy stripe) */}
        <td
          style={{ width: '28px', minWidth: '28px', maxWidth: '28px' }}
          className={`sticky left-0 z-10 px-0.5 text-center border-r border-[var(--border)] select-none ${
            isAllSelected
              ? 'sticky-cell-bg-selected border-l-2 border-l-[var(--accent)]'
              : depth === 0
              ? 'sticky-cell-bg-normal border-l-[3.5px] border-l-[var(--folder-accent)]'
              : depth === 1
              ? 'sticky-cell-bg-normal border-l-[4px] border-l-[var(--tree-rail)] shadow-inner'
              : 'sticky-cell-bg-normal border-l-[4.5px] border-l-[var(--tree-rail-sub)] shadow-inner'
          }`}
        >
          <button
            type="button"
            onClick={() => handleToggleSelectGroup(group.id)}
            className={`w-3.5 h-3.5 rounded-xs border inline-flex items-center justify-center cursor-pointer transition-all ${
              isAllSelected
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : isSomeSelected
                ? 'bg-[var(--accent)]/30 border-[var(--accent)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)]'
            }`}
            title={isAllSelected ? 'Deselect all lines in group' : 'Select all lines in group'}
          >
            {isAllSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            {isSomeSelected && !isAllSelected && (
              <div className="w-1.5 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
        </td>

        {/* LINE / Tree Hierarchy (Sticky left-28px: clicking on the line number expands and collapses the group) */}
        <td
          onClick={() => handleToggleGroupCollapse(group.id)}
          style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
          className="sticky left-[28px] z-10 px-0.5 text-center font-mono text-[11px] select-none border-r border-[var(--border)] sticky-cell-bg-normal cursor-pointer group/linenum transition-colors hover:bg-[var(--bg-hover)]"
          title={
            group.collapsed
              ? `Folder "${group.name}" is collapsed (${stats?.memberLines?.length || 0} lines inside) — Click line number to expand`
              : `Folder "${group.name}" is open — Click line number to collapse (${stats?.memberLines?.length || 0} lines)`
          }
        >
          <div className="relative h-6 flex items-center justify-center font-mono text-[11px]">
            <div className="w-[4ch] flex items-center tracking-normal">
              <span className="w-[2ch] flex items-center justify-center shrink-0">
                {group.collapsed ? (
                  <Folder className="w-3.5 h-3.5 text-[var(--folder-accent)] opacity-75 shrink-0 transition-transform group-hover/linenum:scale-105" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-[var(--folder-accent)] opacity-75 shrink-0 transition-transform group-hover/linenum:scale-105" />
                )}
              </span>
              <span
                className={`w-[2ch] text-center font-medium tracking-normal transition-colors ${
                  group.collapsed
                    ? 'text-[var(--folder-accent)] group-hover/linenum:underline'
                    : 'text-[var(--text-muted)] group-hover/linenum:text-[var(--text-main)] group-hover/linenum:underline'
                }`}
              >
                {formatFolderLineNumber(stats?.memberLines?.[0]?.lineNumber || (displayTreeItems.findIndex((it) => it.id === group.id) + 1))}
              </span>
            </div>
          </div>
        </td>

        {/* Earliest Start Time */}
        <td
          className="px-1 text-center font-mono text-[10.5px] font-normal text-[var(--text-muted)] select-none"
          title="Earliest start time across group"
        >
          {item.earliestStart || '00:00:00.000'}
        </td>

        {/* Latest End Time */}
        <td
          className="px-1 text-center font-mono text-[10.5px] font-normal text-[var(--text-muted)] select-none"
          title="Latest end time across group"
        >
          {item.latestEnd || '00:00:00.000'}
        </td>

        {/* Character Assignment (Applies to whole group: icon only) */}
        <td className="px-1 text-center" style={{ width: '84px', minWidth: '84px', maxWidth: '84px' }}>
          <div className="h-6 flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveCharPopover({
                  targetId: 'group:' + group.id,
                  position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 60) },
                  title: `Group Character: ${group.name}`,
                  currentCharacterId: group.characterId,
                });
              }}
              className={`w-5.5 h-5.5 rounded flex items-center justify-center transition-all cursor-pointer ${
                groupChar
                  ? 'bg-[var(--bg-subtle)] border border-[var(--border)] shadow-2xs hover:border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
              title={
                groupChar
                  ? `Group Character: ${groupChar.name} (Click to change)`
                  : 'Assign character to whole group'
              }
              aria-label={groupChar ? `Group Character: ${groupChar.name}` : 'Assign character to whole group'}
            >
              <Users
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: groupChar ? groupChar.color : 'inherit' }}
              />
            </button>
          </div>
        </td>

        {/* Format Controls (Applies to whole group: Style, Light, Music) */}
        <td className="px-1 text-center" style={{ width: '84px', minWidth: '84px', maxWidth: '84px' }}>
          <div className="h-6 inline-flex items-center rounded-md border border-[var(--border-light)] bg-[var(--bg-subtle)] p-0.5 shrink-0 shadow-2xs gap-0.5">
            {/* 1. Group Style Button (Icon only) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveStylePopover({
                  targetId: 'group:' + group.id,
                  position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 50) },
                  title: `Group Style: ${group.name}`,
                  values: {
                    color: group.color || '#FFFFFF',
                    font: group.font || defaultSettings.font,
                    size: group.size || defaultSettings.size,
                    bold: group.bold,
                    italic: group.italic,
                    underline: group.underline,
                    strikethrough: group.strikethrough,
                    superscript: group.superscript,
                    subscript: group.subscript,
                  },
                });
              }}
              className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
                group.bold || group.italic || group.underline || group.strikethrough || group.superscript || group.subscript || group.color
                  ? 'bg-[var(--accent)] text-white shadow-2xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
              title="Group Style (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript)"
              aria-label="Group Style settings"
            >
              <ALargeSmall className="w-3.5 h-3.5 shrink-0" />
            </button>

            <span className="w-px h-3 bg-[var(--border)] shrink-0 opacity-60" />

            {/* Group Light Expander (Shadow / Outline) */}
            <div
              data-light-expander="true"
              className={`h-5 flex items-center rounded bg-[var(--bg-surface)] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] select-none border ${
                expandedLightLineId === 'group:' + group.id
                  ? 'w-[48px] px-0.5 border-[var(--border)]'
                  : 'w-[20px] px-0 border-transparent'
              }`}
            >
              {expandedLightLineId !== 'group:' + group.id ? (
                <button
                  type="button"
                  onClick={() => setExpandedLightLineId((prev) => (prev === 'group:' + group.id ? null : 'group:' + group.id))}
                  className={`w-full h-full flex items-center justify-center transition-all cursor-pointer ${
                    group.shadow?.enabled || group.outline?.enabled
                      ? 'text-amber-500 font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title="Group Light FX (Shadow & Outline) — Click to expand"
                >
                  <Sun className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : (
                <div className="flex items-center justify-center w-full h-full gap-0.5 animate-in fade-in duration-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveLightModal({
                        lineId: 'group:' + group.id,
                        defaultTab: 'shadow',
                        initialShadow: group.shadow,
                        initialOutline: group.outline,
                        position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 80) },
                      });
                    }}
                    className="w-5 h-4.5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                    title="Configure Drop-Shadow for whole group"
                  >
                    <Layers className="w-3 h-3 shrink-0 text-amber-500" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveLightModal({
                        lineId: 'group:' + group.id,
                        defaultTab: 'outline',
                        initialShadow: group.shadow,
                        initialOutline: group.outline,
                        position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 80) },
                      });
                    }}
                    className="w-5 h-4.5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                    title="Configure Outline & Glow for whole group"
                  >
                    <Sparkles className="w-3 h-3 shrink-0 text-blue-500" />
                  </button>
                </div>
              )}
            </div>

            <span className="w-px h-3 bg-[var(--border)] shrink-0 opacity-60" />

            {/* Group Music Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveMusicPopover({
                  targetId: 'group:' + group.id,
                  position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 60) },
                  title: `Music Notes: ${group.name}`,
                  lineText: '',
                });
              }}
              className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
                group.hasMusicSymbols
                  ? 'bg-[var(--accent)] text-white shadow-2xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
              title="Music notes (♪, ♫, ♬, ♩) settings on whole group"
              aria-label="Group music notes settings"
            >
              <Music className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </td>

        {/* Group Name (No + Line or + Sub-group buttons) */}
        <td className="px-2">
          <div className="flex items-center h-6 min-w-0 gap-1.5">
            <input
              type="text"
              value={group.name}
              onChange={(e) => onUpdateGroup?.({ ...group, name: e.target.value }, false)}
              placeholder="Folder / Group Name..."
              className="h-6 px-1.5 font-bold text-xs bg-transparent focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)] text-[var(--text-main)] rounded-sm outline-hidden max-w-[220px]"
              title="Edit group name"
            />
          </div>
        </td>

        {/* Flag Column (Summary of flags in group) */}
        <td className="px-1 text-center font-mono text-[10px] text-[var(--text-muted)]">
          {(() => {
            const flaggedCount = lines.filter((l) => l.groupId === group.id && l.flag?.isFlagged).length;
            return flaggedCount > 0 ? (
              <span className="px-1 py-0.5 rounded text-[9.5px] font-bold bg-rose-500/15 text-rose-500">
                {flaggedCount}
              </span>
            ) : (
              <span className="text-[var(--text-faint)]">-</span>
            );
          })()}
        </td>

        {/* Actions Column: Restore + and trash buttons to the far right visible on hover */}
        <td className="px-1 text-right pr-2">
          <div className="opacity-0 group-hover/grp:opacity-100 flex items-center justify-end gap-1 transition-opacity">
            <button
              type="button"
              onClick={() => handleAddLineToGroup(group.id)}
              title="Add line into folder"
              className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteGroup?.(group.id, false)}
              title="Delete folder (keeps lines)"
              className="text-[var(--text-faint)] hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div
      className="flex-1 w-full overflow-x-auto overflow-y-auto select-none font-sans bg-[var(--bg-app)]"
      onDragOver={(e) => {
        if (!draggedItem) return;
        const tbody = e.currentTarget.querySelector('tbody');
        if (tbody) {
          const tbodyRect = tbody.getBoundingClientRect();
          if (e.clientY > tbodyRect.bottom) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const lastItem = displayTreeItems[displayTreeItems.length - 1];
            if (lastItem) {
              const lastId = lastItem.type === 'line' ? lastItem.line?.id : lastItem.group?.id;
              const lastType = lastItem.type;
              if (lastId) {
                setDropIndicator((prev) => {
                  if (prev?.targetId === lastId && prev?.position === 'after') return prev;
                  return { targetId: lastId, targetType: lastType, position: 'after' };
                });
                setHoveredFolderId(null);
              }
            }
          }
        }
      }}
      onDrop={(e) => {
        if (!draggedItem) return;
        const tbody = e.currentTarget.querySelector('tbody');
        if (tbody) {
          const tbodyRect = tbody.getBoundingClientRect();
          if (e.clientY > tbodyRect.bottom) {
            const lastItem = displayTreeItems[displayTreeItems.length - 1];
            if (lastItem) {
              if (lastItem.type === 'line' && lastItem.line) {
                handleDropOnLine(e, lastItem.line.id);
              } else if (lastItem.type === 'group' && lastItem.group) {
                handleDropOnGroup(e, lastItem.group.id);
              }
            }
          }
        }
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as HTMLElement;
        if (!related || !e.currentTarget.contains(related)) {
          setDropIndicator(null);
          setHoveredFolderId(null);
        }
      }}
    >
      <table className="w-full border-separate border-spacing-0 text-left min-w-[960px] table-fixed">
        {/* Minimalist Condensed Table Header (Numbers removed, only clean labels) */}
        <thead className="sticky top-0 z-30 bg-[var(--bg-subtle)] text-[9.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          <tr className="h-5.5">
            {/* Select Box Column: top-left corner sticky with highest z-40 */}
            <th
              style={{ width: '28px', minWidth: '28px', maxWidth: '28px' }}
              className="sticky left-0 top-0 z-40 bg-[var(--bg-subtle)] px-0.5 py-0.5 text-center font-semibold border-l-2 border-l-transparent border-r border-[var(--border)] border-b border-[var(--border)]"
            >
              <button
                type="button"
                onClick={handleSelectAll}
                className={`w-3.5 h-3.5 rounded-xs border transition-all inline-flex items-center justify-center cursor-pointer ${
                  selectedLineIds.size === lines.length && lines.length > 0
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : selectedLineIds.size > 0
                    ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-transparent hover:border-[var(--accent)]'
                }`}
                title={selectedLineIds.size === lines.length && lines.length > 0 ? 'Deselect all' : 'Select all lines'}
              >
                {selectedLineIds.size === lines.length && lines.length > 0 && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                {selectedLineIds.size > 0 && selectedLineIds.size < lines.length && (
                  <div className="w-1.5 h-0.5 bg-[var(--accent)] rounded-full" />
                )}
              </button>
            </th>

            {/* Line Number Column: top-left-28px sticky with highest z-40 */}
            <th
              style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
              className="sticky left-[28px] top-0 z-40 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-r border-[var(--border)] border-b border-[var(--border)]"
            >
              LINE
            </th>
            <th style={{ width: '88px' }} className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-b border-[var(--border)]">START</th>
            <th style={{ width: '88px' }} className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-b border-[var(--border)]">END</th>
            <th style={{ width: '84px', minWidth: '84px', maxWidth: '84px' }} className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-b border-[var(--border)]">CHARACTER</th>
            <th style={{ width: '84px', minWidth: '84px', maxWidth: '84px' }} className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-b border-[var(--border)]">FORMAT</th>
            <th className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-2 py-0.5 text-center font-semibold border-b border-[var(--border)]">TEXT</th>
            <th style={{ width: '48px' }} className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-b border-[var(--border)]">FLAG</th>
            <th style={{ width: '56px' }} className="sticky top-0 z-30 bg-[var(--bg-subtle)] px-1 py-0.5 text-center font-semibold border-b border-[var(--border)]" />
          </tr>
        </thead>

        {/* Dense Table Body */}
        <tbody className="divide-y divide-[var(--border-light)] text-xs">
          {displayTreeItems.map((item, treeIndex) => {
            const isBlurActive = !!hoveredFolderId;
            const isInside = isItemInsideHoveredFolder(item, hoveredFolderHierarchyIds);
            const shouldBlur = isBlurActive && !isInside;

            if (item.type === 'group' && item.group) {
              return renderGroupRow(item.group, item, shouldBlur);
            }

            const line = item.line!;
            const index = lineIndexMap.get(line.id) ?? 0;
            const depth = item.depth;
            const isFlagged = !!line.flag?.isFlagged;
            const isCurrentlyPlaying = activePlayingLineId === line.id;
            const isSelected = selectedLineIds.has(line.id);
            const character = line.characterId ? charMap.get(line.characterId) : null;
            const effectiveFont = line.font || character?.font || defaultSettings.font || 'Inter';
            const effectiveSize = line.size || character?.size || defaultSettings.size || 18;
            const isBold = line.bold !== undefined ? line.bold : (character?.bold ?? defaultSettings.bold);
            const isItalic = line.italic !== undefined ? line.italic : (character?.italic ?? defaultSettings.italic);
            const effectiveColor = line.color || character?.color || '#FFFFFF';

            // Active collaborator on this line
            const editorOnThisLine = collabMap.get(line.id);

            // Check if this line is part of the currently dragged selection
            const isThisLineDragged = draggedItem?.type === 'line' && (
              draggedItem.id === line.id || (draggedItem.memberIds && draggedItem.memberIds.includes(line.id))
            );

            const isPlacementBefore = dropIndicator?.targetId === line.id && dropIndicator.position === 'before';
            const isPlacementAfter = dropIndicator?.targetId === line.id && dropIndicator.position === 'after';
            const depthClass = depth === 0 ? 'line-depth-0' : depth === 1 ? 'line-depth-1' : depth === 2 ? 'line-depth-2' : 'line-depth-3';

            return (
              <tr
                key={line.id}
                ref={isCurrentlyPlaying ? activeRowRef : undefined}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, 'line', line.id)}
                onDragOver={(e) => handleDragOverLine(e, line.id)}
                onDrop={(e) => handleDropOnLine(e, line.id)}
                onDragEnd={() => {
                  setDraggedItem(null);
                  setHoveredFolderId(null);
                  setDropIndicator(null);
                }}
                style={{
                  filter: shouldBlur ? 'blur(2.5px)' : 'none',
                  opacity: shouldBlur ? 0.35 : isThisLineDragged ? 0.35 : 1,
                  transition: 'filter 0.15s ease, opacity 0.15s ease',
                  pointerEvents: shouldBlur ? 'none' : 'auto',
                }}
                className={`dense-grid-row group relative ${depthClass} ${
                  isCurrentlyPlaying
                    ? 'row-playing bg-[var(--accent-subtle)] font-medium shadow-xs z-10'
                    : isSelected
                    ? 'row-selected bg-[var(--accent-subtle)]/60 text-[var(--text-main)]'
                    : isFlagged
                    ? 'bg-[var(--error-bg)] text-[var(--error-text)] flagged-theme-highlight'
                    : 'text-[var(--text-main)]'
                } ${editorOnThisLine ? 'bg-[var(--accent-subtle)]/40 ring-1 ring-[var(--accent)]/40' : ''} ${
                  isPlacementBefore ? 'drop-placement-before' : ''
                } ${
                  isPlacementAfter ? 'drop-placement-after' : ''
                }`}
              >
                {/* Select Box Column (Sticky left-0, 100% Opaque, z-10 so it scrolls under sticky header z-40) */}
                <td
                  style={{ width: '28px', minWidth: '28px', maxWidth: '28px' }}
                  className={`sticky left-0 z-10 px-0.5 text-center border-r border-[var(--border)] select-none ${
                    isCurrentlyPlaying
                      ? 'sticky-cell-bg-playing border-l-4 border-l-[var(--accent)] font-medium'
                      : isSelected
                      ? 'sticky-cell-bg-selected border-l-2 border-l-[var(--accent)]'
                      : isFlagged
                      ? 'sticky-cell-bg-flagged border-l-2 border-l-[var(--error-border)]'
                      : depth === 1
                      ? 'sticky-cell-bg-normal border-l-[3px] border-l-[var(--tree-rail-subtle)]'
                      : depth === 2
                      ? 'sticky-cell-bg-normal border-l-[3.5px] border-l-[var(--tree-rail)]'
                      : depth >= 3
                      ? 'sticky-cell-bg-normal border-l-[4px] border-l-[var(--tree-rail-sub)]'
                      : 'sticky-cell-bg-normal border-l-[1.5px] border-l-transparent'
                  }`}
                  onClick={(e) => handleToggleSelectLine(line.id, index, e)}
                >
                  <button
                    type="button"
                    onClick={(e) => handleToggleSelectLine(line.id, index, e)}
                    className={`w-3.5 h-3.5 rounded-xs border inline-flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white opacity-100'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)] opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label={`Select line ${line.lineNumber}`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </button>
                </td>

                {/* 4-Digit Line Number (Sticky column on left-28px, 100% Opaque, z-10) */}
                <td
                  onClick={() => onSeekToLine?.(line)}
                  title={
                    line.groupId
                      ? `Line ${formatLineNumber(line.lineNumber)} · In folder · Click to jump video to ${line.startTime}`
                      : `Click to jump video to ${line.startTime}`
                  }
                  style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                  className={`sticky left-[28px] z-10 px-0.5 text-center font-mono text-[11px] select-none border-r border-[var(--border)] cursor-pointer hover:underline hover:text-[var(--accent)] ${
                    isCurrentlyPlaying
                      ? 'sticky-cell-bg-playing text-[var(--accent)] font-bold'
                      : isSelected
                      ? 'sticky-cell-bg-selected font-bold text-[var(--accent)]'
                      : isFlagged
                      ? 'sticky-cell-bg-flagged text-[var(--error-text)] font-bold'
                      : 'sticky-cell-bg-normal text-[var(--text-faint)] group-hover:text-[var(--text-muted)]'
                  }`}
                >
                  <div className="relative h-6 flex items-center justify-center font-mono text-[11px]">
                    {/* The dot indicating the current line is smaller, farther to the left, and does not move the line number to the right */}
                    {isCurrentlyPlaying && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                    )}
                    {/* Subtle hierarchy tree rail on the left edge of the line cell */}
                    {depth === 1 && !isCurrentlyPlaying && (
                      <span className="absolute left-1 text-[var(--tree-rail)] text-[10px] select-none pointer-events-none font-bold opacity-75">│</span>
                    )}
                    {depth >= 2 && !isCurrentlyPlaying && (
                      <span className="absolute left-0.5 text-[var(--tree-rail-sub)] text-[10px] select-none pointer-events-none font-bold opacity-90">║</span>
                    )}
                    <span className="w-[4ch] text-center inline-block tracking-normal">
                      {formatLineNumber(line.lineNumber)}
                    </span>
                  </div>
                </td>

                {/* Time Code [Start] */}
                <td className="px-1">
                  <input
                    type="text"
                    value={line.startTime}
                    onChange={(e) => onUpdateLine({ ...line, startTime: e.target.value })}
                    onFocus={() => onLineFocus(line.id)}
                    onBlur={() => onLineFocus(null)}
                    className="w-full h-6 px-1 font-mono text-[11px] bg-transparent focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)] outline-hidden text-[var(--text-main)] rounded-none"
                  />
                </td>

                {/* Time Code [End] */}
                <td className="px-1">
                  <input
                    type="text"
                    value={line.endTime}
                    onChange={(e) => onUpdateLine({ ...line, endTime: e.target.value })}
                    onFocus={() => onLineFocus(line.id)}
                    onBlur={() => onLineFocus(null)}
                    className="w-full h-6 px-1 font-mono text-[11px] bg-transparent focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)] outline-hidden text-[var(--text-main)] rounded-none"
                  />
                </td>

                {/* Character [Optional: icon only] */}
                <td className="px-1 text-center" style={{ width: '84px', minWidth: '84px', maxWidth: '84px' }}>
                  <div className="h-6 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveCharPopover({
                          targetId: 'line:' + line.id,
                          position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 60) },
                          title: `Assign Character - Line ${formatLineNumber(line.lineNumber)}`,
                          currentCharacterId: line.characterId,
                        });
                      }}
                      className={`w-5.5 h-5.5 rounded flex items-center justify-center transition-all cursor-pointer ${
                        character
                          ? 'bg-[var(--bg-subtle)] border border-[var(--border)] shadow-2xs hover:border-[var(--accent)]'
                          : 'text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                      title={
                        character
                          ? `Character: ${character.name} (Click to change)`
                          : 'Assign character'
                      }
                      aria-label={character ? `Character ${character.name}` : 'Assign character'}
                    >
                      <User
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: character ? character.color : 'inherit' }}
                      />
                    </button>
                  </div>
                </td>

                {/* Connected Typography Controls: Style (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript), Light (Shadow/Outline), Music (♪) */}
                <td className="px-1 text-center" style={{ width: '84px', minWidth: '84px', maxWidth: '84px' }}>
                  <div
                    className="h-6 inline-flex items-center rounded-md border border-[var(--border-light)] bg-[var(--bg-subtle)] p-0.5 shrink-0 transition-colors shadow-2xs hover:border-[var(--border)] gap-0.5"
                    role="group"
                    aria-label="Format styling: style, light, music"
                  >
                    {/* 1. Unified Style Button (Icon only) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveStylePopover({
                          targetId: 'line:' + line.id,
                          position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 50) },
                          title: `Style - Line ${formatLineNumber(line.lineNumber)}`,
                          values: {
                            color: line.color || character?.color || '#FFFFFF',
                            font: effectiveFont,
                            size: effectiveSize,
                            bold: isBold,
                            italic: isItalic,
                            underline: line.underline,
                            strikethrough: line.strikethrough,
                            superscript: line.superscript,
                            subscript: line.subscript,
                          },
                        });
                      }}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
                        isBold || isItalic || line.underline || line.strikethrough || line.superscript || line.subscript || line.color
                          ? 'bg-[var(--accent)] text-white shadow-2xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                      title="Style (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript)"
                      aria-label="Style settings"
                    >
                      <ALargeSmall className="w-3.5 h-3.5 shrink-0" />
                    </button>

                    <span className="w-px h-3 bg-[var(--border)] shrink-0 opacity-60" />

                    {/* 2. Light Button (Drop-Shadow & Outline Expander) */}
                    <div
                      data-light-expander="true"
                      className={`h-5 flex items-center rounded bg-[var(--bg-surface)] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] select-none border ${
                        expandedLightLineId === line.id ? 'w-[44px] px-0.5 border-[var(--border)]' : 'w-[20px] px-0 border-transparent'
                      }`}
                    >
                      {expandedLightLineId !== line.id ? (
                        <button
                          type="button"
                          onClick={() => setExpandedLightLineId((prev) => (prev === line.id ? null : line.id))}
                          className={`w-full h-full flex items-center justify-center rounded transition-all cursor-pointer ${
                            line.shadow?.enabled || line.outline?.enabled
                              ? 'text-amber-400 font-bold'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                          }`}
                          title="Light Effects (Drop-Shadow & Outline) — Click to expand"
                          aria-label="Expand light effects"
                        >
                          <Sun className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center justify-center w-full h-full gap-0.5 animate-in fade-in duration-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveLightModal({
                                lineId: line.id,
                                defaultTab: 'shadow',
                                initialShadow: line.shadow,
                                initialOutline: line.outline,
                                position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 100) },
                              });
                            }}
                            className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[9px] font-semibold transition-all cursor-pointer ${
                              line.shadow?.enabled
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                            }`}
                            title="Configure Drop-Shadow"
                            aria-label="Configure Drop-Shadow"
                          >
                            <Layers className="w-2.5 h-2.5 text-amber-500" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveLightModal({
                                lineId: line.id,
                                defaultTab: 'outline',
                                initialShadow: line.shadow,
                                initialOutline: line.outline,
                                position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 100) },
                              });
                            }}
                            className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[9px] font-semibold transition-all cursor-pointer ${
                              line.outline?.enabled
                                ? 'bg-blue-500 text-white shadow-2xs'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                            }`}
                            title="Configure Outline & Glow"
                            aria-label="Configure Outline and Glow"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="w-px h-3 bg-[var(--border)] shrink-0 opacity-60" />

                    {/* 3. Music Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveMusicPopover({
                          targetId: 'line:' + line.id,
                          position: { top: rect.bottom + 4, left: Math.max(10, rect.left - 60) },
                          title: `Music Notes - Line ${formatLineNumber(line.lineNumber)}`,
                          lineText: line.text,
                        });
                      }}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
                        hasMusicNotes(line.text) || line.hasMusicSymbols
                          ? 'bg-[var(--accent)] text-white shadow-2xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                      title={hasMusicNotes(line.text) || line.hasMusicSymbols ? 'Music notes active (Click to configure or remove)' : 'Add music notes (♪, ♫, ♬, ♩)'}
                      aria-label="Configure music notes"
                    >
                      <Music className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                {/* Text (Fast zero-lag input without arrow/indentation) */}
                <td className="px-2 overflow-hidden">
                  <div className="flex items-center w-full">
                    <input
                      ref={(el) => {
                        textInputRefs.current[line.id] = el;
                      }}
                      type="text"
                      dir="auto"
                      value={line.text}
                      onChange={(e) => {
                        onUpdateLine({
                          ...line,
                          text: e.target.value,
                        });
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        if (pasted && (pasted.includes('<') || pasted.includes('{') || pasted.includes('\\'))) {
                          e.preventDefault();
                          const parsed = parseAndCleanSubtitleText(pasted);
                          onUpdateLine({
                            ...line,
                            text: parsed.cleanText,
                            font: parsed.font || line.font,
                            size: parsed.size || line.size,
                            bold: parsed.bold !== undefined ? parsed.bold : line.bold,
                            italic: parsed.italic !== undefined ? parsed.italic : line.italic,
                            color: parsed.color || line.color,
                          });
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, line, index)}
                      onFocus={() => onLineFocus(line.id)}
                      onBlur={() => onLineFocus(null)}
                      placeholder="Enter subtitle text..."
                      style={{
                        fontFamily: effectiveFont,
                        fontWeight: isBold ? 'bold' : 'normal',
                        fontStyle: isItalic ? 'italic' : 'normal',
                        textDecoration: [
                          line.underline ? 'underline' : '',
                          line.strikethrough ? 'line-through' : '',
                        ].filter(Boolean).join(' ') || undefined,
                        verticalAlign: line.superscript ? 'super' : line.subscript ? 'sub' : undefined,
                        color: line.color || character?.color || 'inherit',
                        textShadow: buildTextShadow(line.shadow, line.outline) || undefined,
                      }}
                      className="w-full h-6 px-1 text-xs bg-transparent focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)] outline-hidden text-[var(--text-main)] leading-none truncate select-text"
                    />
                  </div>
                </td>

                {/* Flag (Compact, exactly matches width of FLAG label) */}
                <td className="px-1 text-center overflow-hidden" style={{ width: '48px' }}>
                  {isFlagged ? (
                    <button
                      type="button"
                      onClick={() => onOpenFlagModal(line)}
                      className="cursor-pointer inline-flex items-center justify-center w-6 h-5 rounded-xs transition-all hover:scale-105"
                      style={{
                        backgroundColor: 'var(--error-bg)',
                        color: 'var(--error-border)',
                        border: '1px solid var(--error-border)',
                      }}
                      title={line.flag?.note ? `${line.flag.code || 'FLAG'}: ${line.flag.note}` : (line.flag?.code || 'Flagged')}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" style={{ color: 'var(--error-border)' }} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenFlagModal(line)}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-6 h-5 rounded-xs text-[var(--text-faint)] hover:text-[var(--error-border)] transition-opacity cursor-pointer"
                      title="Flag line"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>

                {/* Row Actions: Restore + and trash buttons to the far right visible on hover */}
                <td className="px-1 text-right pr-2">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
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
                            underline: line.underline,
                            strikethrough: line.strikethrough,
                            superscript: line.superscript,
                            subscript: line.subscript,
                            color: line.color,
                            groupId: line.groupId,
                            text: '',
                          },
                          index
                        );
                      }}
                      title="Insert line below"
                      className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLine(line.id)}
                      title="Delete line"
                      className="text-[var(--text-faint)] hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Interactive Color Wheel Picker Popover */}
      {activeColorPicker && (
        <ColorWheelPicker
          initialColor={activeColorPicker.initialColor}
          position={activeColorPicker.position}
          onChange={handleColorChange}
          onClose={() => setActiveColorPicker(null)}
          title={`Line Color (${selectedLineIds.size > 1 && selectedLineIds.has(activeColorPicker.lineId) ? `${selectedLineIds.size} lines` : '1 line'})`}
        />
      )}

      {/* Light Effects Modal (Drop-Shadow & Outline) */}
      {activeLightModal && (
        <LightEffectsModal
          title={
            activeLightModal.lineId.startsWith('group:')
              ? 'Group Light Effects'
              : activeLightModal.lineId === 'bulk'
              ? 'Bulk Light Effects'
              : 'Light Effects'
          }
          defaultTab={activeLightModal.defaultTab}
          initialShadow={activeLightModal.initialShadow}
          initialOutline={activeLightModal.initialOutline}
          position={activeLightModal.position}
          onApply={(shadow, outline) => {
            if (activeLightModal.lineId.startsWith('group:')) {
              const gId = activeLightModal.lineId.replace('group:', '');
              const targetGroup = groups.find((g) => g.id === gId);
              if (targetGroup && onUpdateGroup) {
                onUpdateGroup({ ...targetGroup, shadow, outline }, true);
              }
            } else if (activeLightModal.lineId === 'bulk') {
              const updated = lines.map((l) =>
                selectedLineIds.has(l.id) ? { ...l, shadow, outline } : l
              );
              if (onUpdateLines) onUpdateLines(updated);
              else updated.forEach((l) => selectedLineIds.has(l.id) && onUpdateLine(l));
            } else {
              const target = lines.find((l) => l.id === activeLightModal.lineId);
              if (target) onUpdateLine({ ...target, shadow, outline });
            }
            if (onSaveTitleFormatting) {
              const isAllSelected = activeLightModal.lineId === 'bulk' && selectedLineIds.size === lines.length && lines.length > 0;
              if (isAllSelected) {
                onSaveTitleFormatting({ shadow, outline });
              }
            }
            setActiveLightModal(null);
          }}
          onClose={() => setActiveLightModal(null)}
        />
      )}

      {/* Unified Style Popover (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript) */}
      {activeStylePopover && (
        <StylePopover
          isOpen={!!activeStylePopover}
          onClose={() => setActiveStylePopover(null)}
          position={activeStylePopover.position}
          values={activeStylePopover.values}
          onChange={handleApplyStyle}
          onOpenColorPicker={(currColor) => {
            setActiveColorPicker({
              lineId: activeStylePopover.targetId,
              initialColor: currColor,
              position: activeStylePopover.position,
            });
          }}
          title={activeStylePopover.title}
        />
      )}

      {/* Music Notes Popover (♪, ♫, ♬, ♩, Placement) */}
      {activeMusicPopover && (
        <MusicPopover
          isOpen={!!activeMusicPopover}
          onClose={() => setActiveMusicPopover(null)}
          position={activeMusicPopover.position}
          title={activeMusicPopover.title}
          initialText={activeMusicPopover.lineText}
          onApply={handleApplyMusic}
        />
      )}

      {/* Character Assignment Popover (Line and Group Character selection) */}
      {activeCharPopover && (
        <CharacterPopover
          isOpen={!!activeCharPopover}
          onClose={() => setActiveCharPopover(null)}
          position={activeCharPopover.position}
          title={activeCharPopover.title}
          characters={activeCharacters}
          selectedCharacterId={activeCharPopover.currentCharacterId}
          onSelect={handleSelectCharacterFromPopover}
          onAddCharacter={onAddCharacter}
        />
      )}

      {/* Floating Multi-Select Action Bar */}
      {selectedLineIds.size > 0 && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl text-xs font-mono animate-in fade-in slide-in-from-bottom-2 max-w-[95vw]">
          {/* Groups & Sub-groups Control (Leftmost in selection bar) */}
          <div ref={groupDropdownRef} className="relative inline-flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsGroupPopoverOpen((prev) => !prev)}
              className="h-6 px-2 rounded-md flex items-center gap-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--accent)] transition-all cursor-pointer shadow-2xs font-sans text-[11px] font-semibold"
              title="Add selected lines to a group or sub-group"
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Group</span>
            </button>

            {/* Group Creation & Assignment Popover */}
            {isGroupPopoverOpen && (
              <div className="absolute bottom-full mb-2.5 left-0 w-64 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs select-none">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
                  <span className="font-semibold text-[11px] text-[var(--text-main)] flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Group Selection ({selectedLineIds.size} lines)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsGroupPopoverOpen(false)}
                    className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5 mb-2.5">
                  <label className="text-[10px] text-[var(--text-muted)] font-medium">New Group Name:</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Scene 1 / Chorus"
                    className="w-full h-6 px-2 rounded border border-[var(--border)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateGroupFromSelection();
                    }}
                    autoFocus
                  />

                  <label className="text-[10px] text-[var(--text-muted)] font-medium block pt-1">Parent (Create Sub-group):</label>
                  <select
                    value={newGroupParentId}
                    onChange={(e) => setNewGroupParentId(e.target.value)}
                    className="w-full h-6 px-1.5 rounded border border-[var(--border)] bg-[var(--bg-subtle)] text-[10.5px] text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                  >
                    <option value="none">None (Root Group)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.parentGroupId ? '  ↳ ' : ''}{g.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleCreateGroupFromSelection}
                    className="w-full mt-1.5 h-6 rounded bg-[var(--accent)] hover:opacity-90 text-white font-medium text-[11px] flex items-center justify-center gap-1 transition-opacity cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{newGroupParentId !== 'none' ? 'Create Sub-group' : 'Create Group'}</span>
                  </button>
                </div>

                {groups.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-medium block mb-1">
                      Or Add to Existing Group:
                    </span>
                    <div className="max-h-28 overflow-y-auto space-y-0.5">
                      {groups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleAddSelectedToExistingGroup(g.id)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-main)] flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate flex items-center gap-1">
                            {g.parentGroupId ? (
                              <span className="text-[var(--tree-rail)] font-mono text-[10px] pl-0.5">↳</span>
                            ) : (
                              <Folder className="w-3 h-3 text-[var(--folder-accent)]" />
                            )}
                            {g.name}
                          </span>
                          <span className="text-[9.5px] text-[var(--text-muted)] font-mono">
                            {lines.filter((l) => l.groupId === g.id).length} lines
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLinesInGroupCount > 0 && (
                  <div className="pt-2 mt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={handleRemoveSelectedFromGroup}
                      className="w-full h-6 px-2 rounded hover:bg-rose-500/10 text-rose-500 text-[10.5px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <FolderMinus className="w-3 h-3" />
                      <span>Remove from Group ({selectedLinesInGroupCount})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-3.5 w-px bg-[var(--border)] shrink-0" />

          {/* Time Shift Control (Text field holding smoothly expands options like ms/s, with tighter layout and no dropdown icon) */}
          <div className="relative inline-flex items-center shrink-0">
            {/* Shift Earlier button (-) */}
            <button
              type="button"
              onClick={() => handleTimeShift(-1)}
              className="w-5 h-6 rounded-l-md border border-r-0 border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs"
              title={`Shift selected lines earlier by -${timeShiftAmount || '0'}${timeShiftUnit}`}
            >
              -
            </button>

            {/* Number Input Field (Doubles as compact picker, holding smoothly expands options like ms/s, tighter padding) */}
            <div
              ref={amountExpanderRef}
              className={`relative flex items-center h-6 border border-r-0 border-[var(--border)] bg-[var(--bg-subtle)] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] select-none ${
                isAmountExpanded
                  ? timeShiftUnit === 'ms'
                    ? 'w-[108px] px-0.5'
                    : 'w-[84px] px-0.5'
                  : 'w-[36px] px-0.5 justify-center focus-within:border-[var(--accent)]'
              }`}
            >
              {!isAmountExpanded ? (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={timeShiftAmount}
                  onChange={(e) => setTimeShiftAmount(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTimeShift(1);
                    }
                  }}
                  onPointerDown={() => {
                    holdTimerRef.current = window.setTimeout(() => {
                      setIsAmountExpanded(true);
                    }, 280);
                  }}
                  onPointerUp={() => {
                    if (holdTimerRef.current) {
                      clearTimeout(holdTimerRef.current);
                      holdTimerRef.current = null;
                    }
                  }}
                  onPointerLeave={() => {
                    if (holdTimerRef.current) {
                      clearTimeout(holdTimerRef.current);
                      holdTimerRef.current = null;
                    }
                  }}
                  placeholder="100"
                  className="w-full text-center font-mono font-bold text-[10.5px] bg-transparent outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)] cursor-pointer"
                  title="Type number or hold to show time options"
                />
              ) : (
                <div className="flex items-center justify-between w-full h-full gap-0.5 animate-in fade-in duration-200">
                  {/* Preset Options for current unit: ms (10, 100, 500, 1000) or s (1, 3, 5, 10) */}
                  {(timeShiftUnit === 'ms' ? [10, 100, 500, 1000] : [1, 3, 5, 10]).map((val) => {
                    const isSelected = Number(timeShiftAmount) === val;
                    const label = val >= 1000 ? '1k' : String(val);
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setTimeShiftAmount(String(val));
                          setIsAmountExpanded(false);
                        }}
                        className={`h-[19px] px-1 rounded font-mono text-[9px] font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer flex-1 flex items-center justify-center ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white shadow-2xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                        title={`Select ${val}${timeShiftUnit}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attached Unit Button (Smooth iOS/Android style animated horizontal expansion) */}
            <div
              ref={unitExpanderRef}
              className={`h-6 flex items-center border border-r-0 border-[var(--border)] bg-[var(--bg-subtle)] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] select-none ${
                isUnitExpanded ? 'w-[50px] px-0.5' : 'w-[27px] px-0'
              }`}
            >
              <div className="flex items-center justify-center w-full h-full gap-0.5">
                {/* MS Option */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isUnitExpanded) {
                      setIsUnitExpanded(true);
                    } else {
                      setTimeShiftUnit('ms');
                      if (timeShiftUnit === 's') {
                        setTimeShiftAmount('100');
                      }
                      setIsUnitExpanded(false);
                    }
                  }}
                  className={`font-mono transition-all duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer flex items-center justify-center ${
                    !isUnitExpanded
                      ? timeShiftUnit === 'ms'
                        ? 'w-full h-full text-[10.5px] font-bold text-[var(--accent)] hover:text-[var(--text-main)]'
                        : 'w-0 max-w-0 opacity-0 p-0 pointer-events-none scale-75 overflow-hidden'
                      : `h-[19px] px-1.5 rounded text-[9.5px] font-bold shrink-0 ${
                          timeShiftUnit === 'ms'
                            ? 'bg-[var(--accent)] text-white shadow-2xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`
                  }`}
                  title={!isUnitExpanded ? 'Click to toggle unit (ms / s)' : 'Milliseconds (ms)'}
                >
                  ms
                </button>

                {/* S Option */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isUnitExpanded) {
                      setIsUnitExpanded(true);
                    } else {
                      setTimeShiftUnit('s');
                      if (timeShiftUnit === 'ms') {
                        setTimeShiftAmount('1');
                      }
                      setIsUnitExpanded(false);
                    }
                  }}
                  className={`font-mono transition-all duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer flex items-center justify-center ${
                    !isUnitExpanded
                      ? timeShiftUnit === 's'
                        ? 'w-full h-full text-[10.5px] font-bold text-[var(--accent)] hover:text-[var(--text-main)]'
                        : 'w-0 max-w-0 opacity-0 p-0 pointer-events-none scale-75 overflow-hidden'
                      : `h-[19px] px-1.5 rounded text-[9.5px] font-bold shrink-0 ${
                          timeShiftUnit === 's'
                            ? 'bg-[var(--accent)] text-white shadow-2xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`
                  }`}
                  title={!isUnitExpanded ? 'Click to toggle unit (ms / s)' : 'Seconds (s)'}
                >
                  s
                </button>
              </div>
            </div>

            {/* Shift Later button (+) */}
            <button
              type="button"
              onClick={() => handleTimeShift(1)}
              className="w-5 h-6 rounded-r-md border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs"
              title={`Shift selected lines later by +${timeShiftAmount || '0'}${timeShiftUnit}`}
            >
              +
            </button>
          </div>

          <div className="h-3.5 w-px bg-[var(--border)] shrink-0" />

          {/* Bulk Assign Character (Icon Only, no words) */}
          <div ref={assignDropdownRef} className="relative inline-flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsAssignOpen((prev) => !prev)}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--accent)] transition-all cursor-pointer shadow-2xs"
              title={
                currentSeries
                  ? `Assign character from series "${currentSeries.name}"`
                  : 'Assign character'
              }
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* Character Assignment Popover Menu (Opens upward, centered directly over the button, content-fitted width, exactly 3 items visible) */}
            {isAssignOpen && (
              <div
                className={`absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs select-none transition-all ${
                  isBulkAddingChar
                    ? 'w-[285px] p-2.5 max-h-[460px] overflow-y-auto'
                    : 'w-max min-w-[140px] max-w-[260px] p-1'
                }`}
              >
                {isBulkAddingChar ? (
                  /* ================= ADD CHARACTER VIEW ================= */
                  <form onSubmit={handleCreateBulkCharacter} className="flex flex-col space-y-2.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setIsBulkAddingChar(false)}
                        className="p-1 -ml-1 rounded text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Back to characters list"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold text-[var(--text-main)]">Add Character</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsBulkAddingChar(false);
                          setIsAssignOpen(false);
                        }}
                        className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Name Input */}
                    <div>
                      <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                        Character Name *
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={bulkNewName}
                        onChange={(e) => setBulkNewName(e.target.value)}
                        placeholder="e.g. CAPTAIN VANCE, DR. THORNE..."
                        className="w-full px-2 py-1 text-xs uppercase font-semibold rounded bg-[var(--bg-app)] border border-[var(--border)] focus:border-[var(--accent)] outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
                      />
                    </div>

                    {/* Color Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[9.5px] font-mono uppercase text-[var(--text-muted)]">
                          Badge / Dialogue Color
                        </label>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-2xs"
                            style={{ backgroundColor: bulkNewColor }}
                          />
                          <span className="text-[9px] font-mono text-[var(--text-faint)] uppercase">
                            {bulkNewColor}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {CHARACTER_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setBulkNewColor(c)}
                            className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                              bulkNewColor.toLowerCase() === c.toLowerCase()
                                ? 'scale-125 ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-surface)]'
                                : 'hover:scale-115 opacity-85 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                            title={`Select color ${c}`}
                          />
                        ))}
                        <input
                          type="color"
                          value={bulkNewColor}
                          onChange={(e) => setBulkNewColor(e.target.value)}
                          className="w-4.5 h-4.5 cursor-pointer rounded overflow-hidden border border-[var(--border)] p-0 ml-0.5 bg-transparent"
                          title="Custom color picker"
                        />
                      </div>
                    </div>

                    {/* Font & Typography Settings Box */}
                    <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] space-y-1.5">
                      <div className="text-[9.5px] font-mono uppercase text-[var(--text-muted)] font-semibold">
                        Dedicated Font & Typography
                      </div>

                      <div className="grid grid-cols-12 gap-1.5">
                        {/* Font Select */}
                        <div className="col-span-6">
                          <label className="block text-[9px] font-mono uppercase text-[var(--text-faint)] mb-0.5">
                            Font
                          </label>
                          <select
                            value={bulkNewFont}
                            onChange={(e) => setBulkNewFont(e.target.value)}
                            className="w-full px-1.5 py-1 text-[10.5px] bg-[var(--bg-app)] border border-[var(--border)] rounded text-[var(--text-main)] outline-hidden focus:border-[var(--accent)] cursor-pointer"
                          >
                            {COMMON_FONTS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Size Select */}
                        <div className="col-span-3">
                          <label className="block text-[9px] font-mono uppercase text-[var(--text-faint)] mb-0.5">
                            Size
                          </label>
                          <select
                            value={bulkNewSize}
                            onChange={(e) => setBulkNewSize(Number(e.target.value))}
                            className="w-full px-1.5 py-1 text-[10.5px] bg-[var(--bg-app)] border border-[var(--border)] rounded text-[var(--text-main)] outline-hidden focus:border-[var(--accent)] cursor-pointer font-mono"
                          >
                            {FONT_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}px
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Style Buttons (Bold / Italic) */}
                        <div className="col-span-3">
                          <label className="block text-[9px] font-mono uppercase text-[var(--text-faint)] mb-0.5">
                            Style
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setBulkNewBold(!bulkNewBold)}
                              className={`flex-1 h-6 rounded flex items-center justify-center transition-colors cursor-pointer border ${
                                bulkNewBold
                                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                  : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-main)]'
                              }`}
                              title="Bold"
                              aria-label="Bold"
                            >
                              <Bold className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setBulkNewItalic(!bulkNewItalic)}
                              className={`flex-1 h-6 rounded flex items-center justify-center transition-colors cursor-pointer border ${
                                bulkNewItalic
                                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                  : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-main)]'
                              }`}
                              title="Italic"
                              aria-label="Italic"
                            >
                              <Italic className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description (Optional) */}
                    <div>
                      <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                        Role / Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={bulkNewDescription}
                        onChange={(e) => setBulkNewDescription(e.target.value)}
                        placeholder="e.g. Lead Pilot, Ship AI, Narrator..."
                        className="w-full px-2 py-1 text-[11px] rounded bg-[var(--bg-app)] border border-[var(--border)] focus:border-[var(--accent)] outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
                      />
                    </div>

                    {/* Live Preview Card */}
                    <div className="p-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] flex items-center gap-2 overflow-hidden shadow-2xs">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 truncate max-w-[110px]"
                        style={{
                          color: bulkNewColor,
                          backgroundColor: `${bulkNewColor}20`,
                          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                        }}
                      >
                        {bulkNewName.trim() || 'SPEAKER'}:
                      </span>
                      <span
                        className="truncate text-[11px] select-none text-[var(--text-main)]"
                        style={{
                          color: bulkNewColor,
                          fontFamily: bulkNewFont,
                          fontWeight: bulkNewBold ? 'bold' : 'normal',
                          fontStyle: bulkNewItalic ? 'italic' : 'normal',
                        }}
                      >
                        Subtitle dialogue preview
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setIsBulkAddingChar(false)}
                        className="px-2.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-md bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                        <span>Add Character</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ================= CHARACTERS LIST VIEW ================= */
                  <>
                    {/* Scrollable list sized to display exactly 3 items at ~28px each = 84px height */}
                    <div
                      ref={charListScrollRef}
                      onScroll={(e) => {
                        savedCharScrollPos.current = e.currentTarget.scrollTop;
                      }}
                      className="max-h-[86px] overflow-y-auto space-y-0.5 py-0.5 scrollbar-thin"
                    >
                      {/* Option: Unassigned / Narrator */}
                      <button
                        type="button"
                        onClick={() => {
                          handleBulkAssignCharacter(undefined);
                          setIsAssignOpen(false);
                        }}
                        className="w-full text-left px-2 py-1 h-7 rounded-lg flex items-center justify-between gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer shrink-0"
                        title="Assign as Unassigned / Narrator"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                          <span className="truncate text-[10.5px] font-medium whitespace-nowrap">Unassigned</span>
                        </div>
                      </button>

                      {/* Character Options */}
                      {activeCharacters.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            handleBulkAssignCharacter(c.id);
                            setIsAssignOpen(false);
                          }}
                          className="w-full text-left px-2 py-1 h-7 rounded-lg flex items-center justify-between gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
                          title={`${c.name} (${c.font} · ${c.size}px)`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-0.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="text-[10.5px] font-semibold truncate whitespace-nowrap text-[var(--text-main)] group-hover:text-[var(--accent)]">
                              {c.name}
                            </span>
                          </div>
                        </button>
                      ))}

                      {activeCharacters.length === 0 && (
                        <div className="px-2 py-2 text-center text-[10px] text-[var(--text-faint)] whitespace-nowrap">
                          No characters available
                        </div>
                      )}
                    </div>

                    {/* Bottom Footer with Character Count and Small + Button in Bottom Right */}
                    <div className="flex items-center justify-between pt-1 mt-0.5 border-t border-[var(--border)] px-1">
                      <span className="text-[9.5px] text-[var(--text-faint)] font-mono pl-0.5">
                        {activeCharacters.length} {activeCharacters.length === 1 ? 'char' : 'chars'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBulkAddingChar(true);
                        }}
                        className="w-4.5 h-4.5 rounded-md bg-[var(--accent)] hover:opacity-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs hover:scale-110 active:scale-95 ml-2"
                        title="Add Character"
                        aria-label="Add Character"
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Connected Format Group: Uniform Style (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript), Light (Shadow/Outline), Music (♪) */}
          <div
            className="h-6 inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5 shrink-0 transition-colors shadow-2xs hover:border-[var(--accent)] gap-0.5"
            role="group"
            aria-label="Format styling: style, light, music"
          >
            {/* 1. Bulk Style Button (Uniform across lines, folders, and selection bar) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const firstSelectedLine = lines.find((l) => selectedLineIds.has(l.id));
                setActiveStylePopover({
                  targetId: 'bulk',
                  position: { top: Math.max(10, rect.top - 280), left: Math.max(10, rect.left - 50) },
                  title: `Style (${selectedLineIds.size} lines selected)`,
                  values: {
                    color: firstSelectedLine?.color || '#FFFFFF',
                    font: firstSelectedLine?.font || defaultSettings.font,
                    size: firstSelectedLine?.size || defaultSettings.size,
                    bold: firstSelectedLine?.bold,
                    italic: firstSelectedLine?.italic,
                    underline: firstSelectedLine?.underline,
                    strikethrough: firstSelectedLine?.strikethrough,
                    superscript: firstSelectedLine?.superscript,
                    subscript: firstSelectedLine?.subscript,
                  },
                });
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
              title="Style (Color, Font, Size, Bold, Italic, Underline, Strike-through, Superscript, Subscript)"
              aria-label="Style settings"
            >
              <ALargeSmall className="w-3.5 h-3.5 shrink-0" />
            </button>

            <span className="w-px h-3 bg-[var(--border)] shrink-0 opacity-60" />

            {/* 2. Bulk Light Button (Drop-Shadow & Outline Expander) */}
            <div
              data-light-expander="true"
              className={`h-5 flex items-center rounded bg-[var(--bg-surface)] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] select-none border ${
                isBulkLightExpanded ? 'w-[48px] px-0.5 border-[var(--border)]' : 'w-[20px] px-0 border-transparent'
              }`}
            >
              {!isBulkLightExpanded ? (
                <button
                  type="button"
                  onClick={() => setIsBulkLightExpanded((prev) => !prev)}
                  className="w-full h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                  title="Light Effects (Drop-Shadow & Outline) — Click to expand"
                  aria-label="Expand light effects"
                >
                  <Sun className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : (
                <div className="flex items-center justify-center w-full h-full gap-0.5 animate-in fade-in duration-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveLightModal({
                        lineId: 'bulk',
                        defaultTab: 'shadow',
                        position: { top: Math.max(10, rect.top - 360), left: Math.max(10, rect.left - 100) },
                      });
                    }}
                    className="w-5 h-4.5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                    title="Drop-Shadow Settings for selected lines"
                    aria-label="Configure Drop-Shadow for selected lines"
                  >
                    <Layers className="w-3 h-3 shrink-0 text-amber-500" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveLightModal({
                        lineId: 'bulk',
                        defaultTab: 'outline',
                        position: { top: Math.max(10, rect.top - 360), left: Math.max(10, rect.left - 100) },
                      });
                    }}
                    className="w-5 h-4.5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                    title="Outline & Glow Settings for selected lines"
                    aria-label="Configure Outline and Glow for selected lines"
                  >
                    <Sparkles className="w-3 h-3 shrink-0 text-blue-500" />
                  </button>
                </div>
              )}
            </div>

            <span className="w-px h-3 bg-[var(--border)] shrink-0 opacity-60" />

            {/* 3. Bulk Music Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const firstSelectedLine = lines.find((l) => selectedLineIds.has(l.id));
                setActiveMusicPopover({
                  targetId: 'bulk',
                  position: { top: Math.max(10, rect.top - 200), left: Math.max(10, rect.left - 60) },
                  title: `Music Notes (${selectedLineIds.size} lines)`,
                  lineText: firstSelectedLine?.text || '',
                });
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
              title="Add / Remove music notes (♪, ♫, ♬, ♩) on selected lines"
              aria-label="Configure music notes on selected lines"
            >
              <Music className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          <div className="h-3.5 w-px bg-[var(--border)] shrink-0" />

          {/* Attached Delete and Deselect Buttons (Like top right / undo-redo buttons) */}
          <div
            className="h-6 inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5 shrink-0 transition-colors shadow-2xs"
            role="group"
            aria-label="Selection Actions"
          >
            {/* Delete button with Trash2 icon */}
            <button
              type="button"
              onClick={() => {
                const idsToDelete = Array.from(selectedLineIds);
                setSelectedLineIds(new Set());
                if (onDeleteLines) {
                  onDeleteLines(idsToDelete);
                } else {
                  idsToDelete.forEach((id) => onDeleteLine(id));
                }
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-500/15 transition-all cursor-pointer"
              title="Delete selected lines"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <span className="w-px h-3 bg-[var(--border)] mx-0.5" />
            {/* Deselect button with X icon */}
            <button
              type="button"
              onClick={() => setSelectedLineIds(new Set())}
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
              title="Deselect all (Clear selection)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
