import React, { useState, useEffect, useRef } from 'react';
import { User, Check, X, Search, Plus, ArrowLeft, Bold, Italic } from 'lucide-react';
import { Character, COMMON_FONTS, FONT_SIZES, CHARACTER_PALETTE } from '../types/subtitle';
import { useInactivityAutoClose } from '../hooks/useInactivityAutoClose';

interface CharacterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { top: number; left: number };
  title?: string;
  characters: Character[];
  selectedCharacterId?: string;
  onSelect: (characterId?: string, newlyCreatedCharacter?: Character) => void;
  onAddCharacter?: (newCharacter: Character) => void;
}

export const CharacterPopover: React.FC<CharacterPopoverProps> = ({
  isOpen,
  onClose,
  position,
  title = 'Assign Character',
  characters = [],
  selectedCharacterId,
  onSelect,
  onAddCharacter,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // New Character Form State
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(CHARACTER_PALETTE[0]);
  const [newFont, setNewFont] = useState<string>('Inter');
  const [newSize, setNewSize] = useState<number>(18);
  const [newBold, setNewBold] = useState<boolean>(false);
  const [newItalic, setNewItalic] = useState<boolean>(false);
  const [newDescription, setNewDescription] = useState<string>('');

  // Reset form when opening or closing
  useEffect(() => {
    if (!isOpen) {
      setIsAdding(false);
      setSearch('');
    } else {
      // Pick a random fresh color from palette for convenience
      setNewName('');
      setNewColor(CHARACTER_PALETTE[Math.floor(Math.random() * CHARACTER_PALETTE.length)]);
      setNewFont('Inter');
      setNewSize(18);
      setNewBold(false);
      setNewItalic(false);
      setNewDescription('');
    }
  }, [isOpen]);

  // 5-second inactivity auto-close (active during list browsing, paused while actively adding character)
  const { isClosing, progress, resetTimer } = useInactivityAutoClose({
    isOpen: isOpen && !isAdding,
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
      if (e.key === 'Escape') {
        if (isAdding) {
          setIsAdding(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAdding, onClose]);

  if (!isOpen) return null;

  const filteredCharacters = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const popoverWidth = isAdding ? 285 : 225;
  const popoverHeight = isAdding ? 460 : 310;
  const top = position ? Math.min(position.top, Math.max(10, window.innerHeight - popoverHeight)) : 100;
  const left = position ? Math.max(10, Math.min(position.left, window.innerWidth - (popoverWidth + 15))) : 100;

  const handleCreateNewCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newChar: Character = {
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newName.trim().toUpperCase(),
      color: newColor,
      font: newFont,
      size: newSize,
      bold: newBold,
      italic: newItalic,
      description: newDescription.trim() || undefined,
    };

    onAddCharacter?.(newChar);
    onSelect(newChar.id, newChar);
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${Math.max(10, top)}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: 9999,
      }}
      className={`rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2.5 text-xs select-none font-sans relative overflow-hidden transition-all duration-200 ${
        isClosing
          ? 'opacity-0 scale-95 translate-y-1 pointer-events-none'
          : 'animate-in fade-in zoom-in-95 duration-100 opacity-100 scale-100'
      }`}
    >
      {/* 5-second inactivity subtle progress indicator (active when not adding) */}
      {!isAdding && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-light)] overflow-hidden rounded-b-xl pointer-events-none">
          <div
            className="h-full bg-[var(--accent)] opacity-40 transition-[width] duration-75 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {isAdding ? (
        /* ================= ADD CHARACTER VIEW ================= */
        <form onSubmit={handleCreateNewCharacter} className="flex flex-col space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 -ml-1 rounded text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] flex items-center gap-1 cursor-pointer transition-colors"
              title="Back to characters list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold text-[var(--text-main)]">Add Character</span>
            </button>
            <button
              type="button"
              onClick={onClose}
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
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
                  style={{ backgroundColor: newColor }}
                />
                <span className="text-[9px] font-mono text-[var(--text-faint)] uppercase">
                  {newColor}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CHARACTER_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                    newColor.toLowerCase() === c.toLowerCase()
                      ? 'scale-125 ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-surface)]'
                      : 'hover:scale-115 opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  title={`Select color ${c}`}
                />
              ))}
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
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
                  value={newFont}
                  onChange={(e) => setNewFont(e.target.value)}
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
                  value={newSize}
                  onChange={(e) => setNewSize(Number(e.target.value))}
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
                    onClick={() => setNewBold(!newBold)}
                    className={`flex-1 h-6 rounded flex items-center justify-center transition-colors cursor-pointer border ${
                      newBold
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
                    onClick={() => setNewItalic(!newItalic)}
                    className={`flex-1 h-6 rounded flex items-center justify-center transition-colors cursor-pointer border ${
                      newItalic
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
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. Lead Pilot, Ship AI, Narrator..."
              className="w-full px-2 py-1 text-[11px] rounded bg-[var(--bg-app)] border border-[var(--border)] focus:border-[var(--accent)] outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
            />
          </div>

          {/* Live Preview Card */}
          <div className="p-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] flex items-center gap-2 overflow-hidden shadow-2xs">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 truncate max-w-[110px]"
              style={{
                color: newColor,
                backgroundColor: `${newColor}20`,
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              {newName.trim() || 'SPEAKER'}:
            </span>
            <span
              className="truncate text-[11px] select-none text-[var(--text-main)]"
              style={{
                color: newColor,
                fontFamily: newFont,
                fontWeight: newBold ? 'bold' : 'normal',
                fontStyle: newItalic ? 'italic' : 'normal',
              }}
            >
              Subtitle dialogue preview
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
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
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--text-main)] truncate">
              <User className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
              <span className="truncate">{title}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-sm text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Optional Search if more than 4 characters */}
          {characters.length > 4 && (
            <div className="mb-1.5 relative">
              <Search className="w-3 h-3 text-[var(--text-faint)] absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  resetTimer();
                  setSearch(e.target.value);
                }}
                placeholder="Search characters..."
                className="w-full h-6 pl-6 pr-1.5 text-[10.5px] rounded bg-[var(--bg-subtle)] border border-[var(--border-light)] focus:border-[var(--accent)] outline-hidden text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
              />
            </div>
          )}

          {/* Characters List */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 py-0.5 scrollbar-thin">
            {/* Unassigned / None Option */}
            <button
              type="button"
              onClick={() => {
                onSelect(undefined);
                onClose();
              }}
              className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                !selectedCharacterId
                  ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
              title="None (Unassigned / Narrator)"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[var(--text-faint)] shrink-0" />
                <span className="truncate text-[11px]">None (Narrator)</span>
              </div>
              {!selectedCharacterId && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
            </button>

            {/* Character Items */}
            {filteredCharacters.map((c) => {
              const isSelected = c.id === selectedCharacterId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c.id);
                    onClose();
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold ring-1 ring-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                  title={`${c.name} (${c.font || 'Inter'} · ${c.size || 18}px)`}
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
                        {c.font || 'Inter'} · {c.size || 18}px
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                </button>
              );
            })}

            {filteredCharacters.length === 0 && characters.length > 0 && (
              <div className="py-3 text-center text-[10px] text-[var(--text-faint)]">
                No characters found
              </div>
            )}
          </div>

          {/* Bottom Footer Bar with Speaker Count and Small + Button in Bottom Right */}
          <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-faint)] font-mono pl-0.5">
              {characters.length} {characters.length === 1 ? 'speaker' : 'speakers'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetTimer();
                setIsAdding(true);
              }}
              className="w-5 h-5 rounded-md bg-[var(--accent)] hover:opacity-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs hover:scale-110 active:scale-95"
              title="Add character"
              aria-label="Add character"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
