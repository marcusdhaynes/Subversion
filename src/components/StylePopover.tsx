import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Palette,
  X,
} from 'lucide-react';
import { COMMON_FONTS, FONT_SIZES, CHARACTER_PALETTE } from '../types/subtitle';
import { useInactivityAutoClose } from '../hooks/useInactivityAutoClose';

export interface StyleValues {
  color?: string;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
}

interface StylePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { top: number; left: number };
  values: StyleValues;
  onChange: (updates: Partial<StyleValues>) => void;
  onOpenColorPicker?: (currentColor: string) => void;
  title?: string;
}

export const StylePopover: React.FC<StylePopoverProps> = ({
  isOpen,
  onClose,
  position,
  values,
  onChange,
  onOpenColorPicker,
  title = 'Typography & Style',
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // 5-second inactivity auto-close with natural smooth fade-out
  const { isClosing, progress } = useInactivityAutoClose({
    isOpen,
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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentFont = values.font || 'Inter';
  const currentSize = values.size || 18;
  const currentColor = values.color || '#FFFFFF';

  // Position adjustments to stay fully on screen
  const top = position ? Math.min(position.top, window.innerHeight - 270) : 100;
  const left = position ? Math.max(10, Math.min(position.left, window.innerWidth - 250)) : 100;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${Math.max(10, top)}px`,
        left: `${left}px`,
        zIndex: 9999,
      }}
      className={`w-[236px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2.5 text-xs select-none font-sans relative overflow-hidden transition-all duration-280 ${
        isClosing
          ? 'opacity-0 scale-95 translate-y-1 pointer-events-none'
          : 'animate-in fade-in zoom-in-95 duration-100 opacity-100 scale-100'
      }`}
    >
      {/* 5-second inactivity subtle progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-light)] overflow-hidden rounded-b-xl pointer-events-none">
        <div
          className="h-full bg-[var(--accent)] opacity-40 transition-[width] duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
        <span className="font-semibold text-[11px] text-[var(--text-main)] truncate">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-sm text-[var(--text-faint)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Row 1: Font & Size */}
      <div className="flex items-center gap-1.5 mb-2.5">
        {/* Font dropdown */}
        <div className="flex-1 min-w-0">
          <label className="block text-[9px] font-mono uppercase text-[var(--text-muted)] mb-0.5">
            Font
          </label>
          <select
            value={currentFont}
            onChange={(e) => onChange({ font: e.target.value })}
            className="w-full h-6 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border)] text-[10.5px] text-[var(--text-main)] outline-hidden cursor-pointer truncate"
          >
            {COMMON_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Size dropdown */}
        <div className="w-[62px] shrink-0">
          <label className="block text-[9px] font-mono uppercase text-[var(--text-muted)] mb-0.5">
            Size
          </label>
          <select
            value={currentSize}
            onChange={(e) => onChange({ size: Number(e.target.value) })}
            className="w-full h-6 px-1 rounded bg-[var(--bg-subtle)] border border-[var(--border)] text-[10.5px] font-mono text-[var(--text-main)] outline-hidden cursor-pointer"
          >
            {FONT_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}px
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Formatting Buttons (B, I, U, S, X², X₂) */}
      <div className="mb-2.5">
        <label className="block text-[9px] font-mono uppercase text-[var(--text-muted)] mb-1">
          Format
        </label>
        <div className="grid grid-cols-6 gap-1">
          {/* Bold */}
          <button
            type="button"
            onClick={() => onChange({ bold: !values.bold })}
            className={`h-6 rounded flex items-center justify-center transition-all cursor-pointer border ${
              values.bold
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs font-extrabold'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={values.bold ? 'Bold (Active)' : 'Bold'}
          >
            <Bold className="w-3 h-3 stroke-[2.5]" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => onChange({ italic: !values.italic })}
            className={`h-6 rounded flex items-center justify-center transition-all cursor-pointer border ${
              values.italic
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={values.italic ? 'Italic (Active)' : 'Italic'}
          >
            <Italic className="w-3 h-3 stroke-[2.5]" />
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => onChange({ underline: !values.underline })}
            className={`h-6 rounded flex items-center justify-center transition-all cursor-pointer border ${
              values.underline
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={values.underline ? 'Underline (Active)' : 'Underline'}
          >
            <Underline className="w-3 h-3 stroke-[2.5]" />
          </button>

          {/* Strike-through */}
          <button
            type="button"
            onClick={() => onChange({ strikethrough: !values.strikethrough })}
            className={`h-6 rounded flex items-center justify-center transition-all cursor-pointer border ${
              values.strikethrough
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={values.strikethrough ? 'Strike-through (Active)' : 'Strike-through'}
          >
            <Strikethrough className="w-3 h-3 stroke-[2.5]" />
          </button>

          {/* Superscript */}
          <button
            type="button"
            onClick={() =>
              onChange({
                superscript: !values.superscript,
                subscript: !values.superscript ? false : values.subscript,
              })
            }
            className={`h-6 rounded flex items-center justify-center transition-all cursor-pointer border ${
              values.superscript
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={values.superscript ? 'Superscript (Active)' : 'Superscript (X²)'}
          >
            <Superscript className="w-3 h-3 stroke-[2.5]" />
          </button>

          {/* Subscript */}
          <button
            type="button"
            onClick={() =>
              onChange({
                subscript: !values.subscript,
                superscript: !values.subscript ? false : values.superscript,
              })
            }
            className={`h-6 rounded flex items-center justify-center transition-all cursor-pointer border ${
              values.subscript
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-2xs'
                : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={values.subscript ? 'Subscript (Active)' : 'Subscript (X₂)'}
          >
            <Subscript className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Row 3: Color Palette & Swatches */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[9px] font-mono uppercase text-[var(--text-muted)]">
            Color
          </label>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full border border-[var(--border)] shrink-0"
              style={{ backgroundColor: currentColor }}
            />
            <span className="font-mono text-[9.5px] text-[var(--text-muted)]">
              {currentColor}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Default White */}
          <button
            type="button"
            onClick={() => onChange({ color: '#FFFFFF' })}
            className={`w-5 h-5 rounded-full border shadow-2xs hover:scale-115 transition-transform cursor-pointer ${
              currentColor.toUpperCase() === '#FFFFFF'
                ? 'ring-2 ring-[var(--accent)] ring-offset-1 border-neutral-400'
                : 'border-neutral-300'
            }`}
            style={{ backgroundColor: '#FFFFFF' }}
            title="White (#FFFFFF)"
          />

          {/* Palette Colors */}
          {CHARACTER_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className={`w-5 h-5 rounded-full border border-black/20 shadow-2xs hover:scale-115 transition-transform cursor-pointer ${
                currentColor.toLowerCase() === c.toLowerCase()
                  ? 'ring-2 ring-[var(--accent)] ring-offset-1'
                  : ''
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}

          {/* Color Wheel / Custom Picker trigger */}
          {onOpenColorPicker && (
            <button
              type="button"
              onClick={() => {
                onOpenColorPicker(currentColor);
                onClose();
              }}
              className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-2xs hover:scale-110 transition-all cursor-pointer"
              title="Open Color Wheel"
            >
              <Palette className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
