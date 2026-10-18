import React, { useState } from 'react';
import { Character, COMMON_FONTS, FONT_SIZES, CHARACTER_PALETTE, SubtitleLine } from '../types/subtitle';
import { Plus, Trash2, Check, X, User, Bold, Italic } from 'lucide-react';

interface CharactersModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  lines: SubtitleLine[];
  onSaveCharacters: (characters: Character[]) => void;
  onApplyStyleToLines?: (characterId: string, style: { font: string; size: number; bold: boolean; italic: boolean }) => void;
}

export const CharactersModal: React.FC<CharactersModalProps> = ({
  isOpen,
  onClose,
  characters,
  lines,
  onSaveCharacters,
  onApplyStyleToLines,
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string>(characters[0]?.id || 'new');
  
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [font, setFont] = useState('Inter');
  const [size, setSize] = useState(18);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [description, setDescription] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [applyToExistingLines, setApplyToExistingLines] = useState(true);

  React.useEffect(() => {
    const existing = characters.find((c) => c.id === selectedCharId);
    if (existing) {
      setName(existing.name);
      setColor(existing.color);
      setFont(existing.font);
      setSize(existing.size);
      setBold(existing.bold);
      setItalic(existing.italic);
      setDescription(existing.description || '');
      setIsEditingExisting(true);
    } else {
      setName('');
      setColor(CHARACTER_PALETTE[Math.floor(Math.random() * CHARACTER_PALETTE.length)]);
      setFont('Inter');
      setSize(18);
      setBold(false);
      setItalic(false);
      setDescription('');
      setIsEditingExisting(false);
    }
  }, [selectedCharId, characters]);

  if (!isOpen) return null;

  const countLinesForChar = (charId: string) => {
    return lines.filter((l) => l.characterId === charId).length;
  };

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const charData: Character = {
      id: isEditingExisting ? selectedCharId : `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim().toUpperCase(),
      color,
      font,
      size,
      bold,
      italic,
      description: description.trim(),
    };

    let updatedList: Character[];
    if (isEditingExisting) {
      updatedList = characters.map((c) => (c.id === charData.id ? charData : c));
    } else {
      updatedList = [...characters, charData];
      setSelectedCharId(charData.id);
    }

    onSaveCharacters(updatedList);

    if (applyToExistingLines && onApplyStyleToLines) {
      onApplyStyleToLines(charData.id, {
        font: charData.font,
        size: charData.size,
        bold: charData.bold,
        italic: charData.italic,
      });
    }
  };

  const handleDelete = (charId: string) => {
    const updated = characters.filter((c) => c.id !== charId);
    onSaveCharacters(updated);
    if (selectedCharId === charId) {
      setSelectedCharId(updated[0]?.id || 'new');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
      <div
        className="w-full max-w-2xl max-h-[90vh] crystal-glass rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans text-xs transition-colors duration-200"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 25px var(--accent-glow)',
          borderColor: 'var(--border-glass)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="h-10 px-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-semibold text-[var(--text-main)]">Characters & Speaker Defaults</span>
            <span className="text-[10px] text-[var(--text-faint)]">({characters.length})</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[var(--border)] flex-1 overflow-y-auto min-h-0">
          {/* Character List */}
          <div className="w-full md:w-52 p-2 bg-[var(--bg-app)] flex flex-col shrink-0 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedCharId('new')}
              className="w-full py-1 px-2 mb-2 text-left text-[11px] font-medium border border-dashed border-[var(--border)] hover:border-[var(--text-muted)] text-[var(--text-main)] flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Character
            </button>

            <div className="space-y-0.5">
              {characters.map((char) => {
                const isSelected = selectedCharId === char.id;
                const lineCount = countLinesForChar(char.id);
                return (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharId(char.id)}
                    className={`w-full text-left py-1.5 px-2 flex items-center justify-between text-[11px] transition-colors ${
                      isSelected
                        ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold border-l-2 border-l-blue-500'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: char.color }} />
                      <span className="truncate">{char.name}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0">{lineCount}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form & Preview */}
          <div className="flex-1 p-4 bg-[var(--bg-surface)] overflow-y-auto">
            <form onSubmit={handleCreateOrUpdate} className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--border-light)]">
                <span className="font-mono text-[10px] uppercase text-[var(--text-faint)]">
                  {isEditingExisting ? `Editing: ${name || 'Character'}` : 'New Speaker'}
                </span>
                {isEditingExisting && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedCharId)}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>

              {/* Character Name */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NARRATOR or SARAH"
                  className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] focus:border-blue-500 outline-hidden uppercase font-semibold text-[var(--text-main)]"
                />
              </div>

              {/* Accent Color */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CHARACTER_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        color.toLowerCase() === c.toLowerCase() ? 'scale-125 ring-2 ring-neutral-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-5 h-5 cursor-pointer border-0 bg-transparent p-0 ml-1"
                  />
                </div>
              </div>

              {/* Typography */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">Font</label>
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value)}
                    className="w-full px-1.5 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
                  >
                    {COMMON_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">Size</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full px-1.5 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}px
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">Bold</label>
                  <button
                    type="button"
                    onClick={() => setBold(!bold)}
                    className={`w-full py-1 text-[11px] font-bold border transition-colors flex items-center justify-center ${
                      bold
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                    title="Bold"
                    aria-label="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">Italic</label>
                  <button
                    type="button"
                    onClick={() => setItalic(!italic)}
                    className={`w-full py-1 text-[11px] italic border transition-colors flex items-center justify-center ${
                      italic
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                    title="Italic"
                    aria-label="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* On-screen Subtitle Preview */}
              <div className="pt-2">
                <span className="block text-[10px] font-mono uppercase text-[var(--text-faint)] mb-1">Preview</span>
                <div className="h-16 bg-black flex items-center justify-center p-2 text-center">
                  <span
                    className="text-white drop-shadow-sm truncate"
                    style={{
                      fontFamily: font,
                      fontSize: `${Math.min(size, 18)}px`,
                      fontWeight: bold ? 'bold' : 'normal',
                      fontStyle: italic ? 'italic' : 'normal',
                    }}
                  >
                    <span style={{ color }} className="mr-1.5 font-bold uppercase text-[11px]">
                      {name || 'SPEAKER'}:
                    </span>
                    "Subtitle text renders with speaker styling."
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-light)]">
                {isEditingExisting && countLinesForChar(selectedCharId) > 0 ? (
                  <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToExistingLines}
                      onChange={(e) => setApplyToExistingLines(e.target.checked)}
                      className="rounded-none text-blue-600"
                    />
                    <span>Sync to {countLinesForChar(selectedCharId)} lines</span>
                  </label>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 text-[11px] font-medium bg-[var(--text-main)] text-[var(--bg-surface)] hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
