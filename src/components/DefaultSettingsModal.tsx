import React, { useState } from 'react';
import { DefaultProjectSettings, COMMON_FONTS, FONT_SIZES } from '../types/subtitle';
import { X, Sliders } from 'lucide-react';

interface DefaultSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSettings: DefaultProjectSettings;
  onSaveDefaults: (defaults: DefaultProjectSettings) => void;
}

export const DefaultSettingsModal: React.FC<DefaultSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultSettings,
  onSaveDefaults,
}) => {
  const [font, setFont] = useState(defaultSettings.font || 'Inter');
  const [size, setSize] = useState(defaultSettings.size || 18);
  const [bold, setBold] = useState(defaultSettings.bold || false);
  const [italic, setItalic] = useState(defaultSettings.italic || false);
  const [cpsLimit, setCpsLimit] = useState(defaultSettings.cpsLimit || 21);
  const [rewindSeconds, setRewindSeconds] = useState(defaultSettings.rewindSeconds ?? 10);
  const [fastForwardSeconds, setFastForwardSeconds] = useState(defaultSettings.fastForwardSeconds ?? 10);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDefaults({
      ...defaultSettings,
      font,
      size,
      bold,
      italic,
      cpsLimit,
      rewindSeconds: Math.max(1, Math.min(60, Number(rewindSeconds) || 10)),
      fastForwardSeconds: Math.max(1, Math.min(60, Number(fastForwardSeconds) || 10)),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
      <div
        className="w-full max-w-sm crystal-glass rounded-2xl shadow-2xl overflow-hidden font-sans text-xs transition-colors duration-200"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 20px var(--accent-glow)',
          borderColor: 'var(--border-glass)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-10 px-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-semibold text-[var(--text-main)]">Default Font & Typography</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                Default Font
              </label>
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
              >
                {COMMON_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                Default Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">Bold</label>
              <button
                type="button"
                onClick={() => setBold(!bold)}
                className={`w-full py-1 text-[11px] font-bold border transition-colors ${
                  bold
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                B {bold ? 'ON' : 'OFF'}
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">Italic</label>
              <button
                type="button"
                onClick={() => setItalic(!italic)}
                className={`w-full py-1 text-[11px] italic border transition-colors ${
                  italic
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                I {italic ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
              CPS Warning Threshold
            </label>
            <input
              type="number"
              min={10}
              max={40}
              value={cpsLimit}
              onChange={(e) => setCpsLimit(Number(e.target.value))}
              className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-light)]">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                Rewind Skip (Sec)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={rewindSeconds}
                onChange={(e) => setRewindSeconds(Number(e.target.value))}
                className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                Fast-Forward Skip (Sec)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={fastForwardSeconds}
                onChange={(e) => setFastForwardSeconds(Number(e.target.value))}
                className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[11px] text-[var(--text-main)] outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-light)]">
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
              Save Defaults
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
