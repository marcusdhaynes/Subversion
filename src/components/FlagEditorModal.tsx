import React, { useState, useEffect } from 'react';
import { SubtitleLine, PRESET_FLAG_CODES, FlagData } from '../types/subtitle';
import { formatLineNumber } from '../utils/timecode';
import { ShieldAlert, Trash2, X } from 'lucide-react';

interface FlagEditorModalProps {
  line: SubtitleLine | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (lineId: string, flag: FlagData | undefined) => void;
  currentUserName: string;
}

export const FlagEditorModal: React.FC<FlagEditorModalProps> = ({
  line,
  isOpen,
  onClose,
  onSave,
  currentUserName,
}) => {
  const [code, setCode] = useState('ERR-SYNC');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (line?.flag) {
      setCode(line.flag.code || 'ERR-SYNC');
      setNote(line.flag.note || '');
    } else {
      setCode('ERR-SYNC');
      setNote('');
    }
  }, [line]);

  if (!isOpen || !line) return null;

  const handleSave = () => {
    const updatedFlag: FlagData = {
      isFlagged: true,
      code,
      note: note.trim(),
      author: line.flag?.author || currentUserName,
      createdAt: line.flag?.createdAt || Date.now(),
    };
    onSave(line.id, updatedFlag);
    onClose();
  };

  const handleRemove = () => {
    onSave(line.id, undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md crystal-glass rounded-2xl shadow-2xl overflow-hidden font-sans text-xs transition-colors duration-200"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 25px var(--error-bg)',
          borderColor: 'var(--border-glass)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="h-10 px-4 border-b border-[var(--border)] flex items-center justify-between"
          style={{ backgroundColor: 'var(--error-bg)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--error-border)' }}>
            <ShieldAlert className="w-4 h-4" />
            <span className="font-semibold font-mono text-[12px]">
              Line {formatLineNumber(line.lineNumber)} Error Flag
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-[var(--bg-surface)]">
          {/* Preset code selector */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
              Error Classification
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_FLAG_CODES.map((item) => {
                const isSelected = code === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setCode(item.code);
                      if (!note) setNote(item.desc);
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-between text-[11px] ${
                      isSelected
                        ? 'font-semibold shadow-xs ring-1'
                        : 'border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: 'var(--error-border)',
                            backgroundColor: 'var(--error-bg)',
                            color: 'var(--error-text)',
                            // @ts-ignore
                            '--tw-ring-color': 'var(--error-border)',
                          }
                        : undefined
                    }
                  >
                    <span className="font-mono text-[10px] font-bold">{item.code}</span>
                    <span className="text-[9px] opacity-80 truncate ml-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note / Instructions for editors */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)]">
                Editor Instructions (What to do / fix)
              </label>
              <span className="text-[10px] text-[var(--text-faint)]">By {line.flag?.author || currentUserName}</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Check audio sync at cut point, verify phrase translation..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border)] rounded-lg outline-hidden text-[11px] text-[var(--text-main)] resize-none transition-colors"
              style={{
                borderColor: note ? 'var(--error-border)' : undefined,
              }}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)]">
            {line.flag?.isFlagged ? (
              <button
                type="button"
                onClick={handleRemove}
                className="text-[11px] flex items-center gap-1 font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--error-border)' }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Flag
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-[11px] font-medium text-white rounded-lg transition-all hover:brightness-110 shadow-xs"
                style={{
                  backgroundColor: 'var(--error-badge)',
                }}
              >
                Save Flag
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
