import React, { useState, useEffect, useRef } from 'react';
import { X, Sun, Layers, Sparkles, Check, RotateCcw } from 'lucide-react';
import { ShadowSettings, OutlineSettings } from '../types/subtitle';
import { useInactivityAutoClose } from '../hooks/useInactivityAutoClose';

export function buildTextShadow(shadow?: ShadowSettings, outline?: OutlineSettings): string {
  const parts: string[] = [];

  if (outline?.enabled) {
    const s = Math.max(1, outline.size ?? 2);
    const g = outline.glow ?? 0;
    const op = (outline.opacity ?? 90) / 100;
    const hex = outline.color || '#000000';
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const gCol = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const colStr = `rgba(${r}, ${gCol}, ${b}, ${op})`;

    parts.push(
      `-${s}px 0 ${g}px ${colStr}`,
      `${s}px 0 ${g}px ${colStr}`,
      `0 -${s}px ${g}px ${colStr}`,
      `0 ${s}px ${g}px ${colStr}`,
      `-${s}px -${s}px ${g}px ${colStr}`,
      `${s}px -${s}px ${g}px ${colStr}`,
      `-${s}px ${s}px ${g}px ${colStr}`,
      `${s}px ${s}px ${g}px ${colStr}`
    );
    if (g > 0) {
      parts.push(`0 0 ${s + g}px ${colStr}`);
    }
  }

  if (shadow?.enabled) {
    const d = shadow.distance ?? 3;
    const angle = shadow.angle ?? 45;
    const blur = shadow.blur ?? 4;
    const op = (shadow.opacity ?? 80) / 100;
    const hex = shadow.color || '#000000';
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const gCol = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const colStr = `rgba(${r}, ${gCol}, ${b}, ${op})`;

    const rad = (angle * Math.PI) / 180;
    const x = Math.round(d * Math.cos(rad));
    const y = Math.round(d * Math.sin(rad));

    parts.push(`${x}px ${y}px ${blur}px ${colStr}`);
  }

  return parts.join(', ');
}

interface LightEffectsModalProps {
  initialShadow?: ShadowSettings;
  initialOutline?: OutlineSettings;
  defaultTab?: 'shadow' | 'outline';
  title?: string;
  position?: { top: number; left: number };
  onApply: (shadow: ShadowSettings, outline: OutlineSettings) => void;
  onClose: () => void;
}

const PRESET_COLORS = ['#000000', '#1E293B', '#FFFFFF', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

export const LightEffectsModal: React.FC<LightEffectsModalProps> = ({
  initialShadow,
  initialOutline,
  defaultTab = 'shadow',
  title = 'Light Effects: Shadow & Outline',
  position,
  onApply,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'shadow' | 'outline'>(defaultTab);

  const [shadow, setShadow] = useState<ShadowSettings>({
    enabled: initialShadow?.enabled ?? false,
    color: initialShadow?.color ?? '#000000',
    opacity: initialShadow?.opacity ?? 80,
    distance: initialShadow?.distance ?? 3,
    angle: initialShadow?.angle ?? 45,
    blur: initialShadow?.blur ?? 4,
  });

  const [outline, setOutline] = useState<OutlineSettings>({
    enabled: initialOutline?.enabled ?? false,
    color: initialOutline?.color ?? '#000000',
    opacity: initialOutline?.opacity ?? 90,
    size: initialOutline?.size ?? 2,
    glow: initialOutline?.glow ?? 3,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // 5-second inactivity auto-close with natural smooth fade-out
  const { isClosing, progress } = useInactivityAutoClose({
    isOpen: true,
    timeoutMs: 5000,
    onClose,
    containerRef: modalRef,
  });

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [onClose]);

  const previewShadow = buildTextShadow(shadow, outline);

  // Quick preset application
  const applyPreset = (type: 'subtle_shadow' | 'deep_shadow' | 'clean_outline' | 'neon_glow' | 'reset') => {
    if (type === 'subtle_shadow') {
      setShadow({ enabled: true, color: '#000000', opacity: 75, distance: 2, angle: 45, blur: 3 });
    } else if (type === 'deep_shadow') {
      setShadow({ enabled: true, color: '#000000', opacity: 90, distance: 5, angle: 60, blur: 6 });
    } else if (type === 'clean_outline') {
      setOutline({ enabled: true, color: '#000000', opacity: 100, size: 2, glow: 1 });
    } else if (type === 'neon_glow') {
      setOutline({ enabled: true, color: '#3B82F6', opacity: 95, size: 2, glow: 8 });
      setShadow({ enabled: true, color: '#3B82F6', opacity: 60, distance: 0, angle: 0, blur: 10 });
    } else if (type === 'reset') {
      setShadow({ enabled: false, color: '#000000', opacity: 80, distance: 3, angle: 45, blur: 4 });
      setOutline({ enabled: false, color: '#000000', opacity: 90, size: 2, glow: 3 });
    }
  };

  // Compute constrained position if passed
  const modalStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: Math.min(window.innerHeight - 380, Math.max(10, position.top)),
        left: Math.min(window.innerWidth - 300, Math.max(10, position.left)),
        zIndex: 9999,
      }
    : {};

  return (
    <div
      ref={modalRef}
      style={modalStyle}
      className={`${
        !position ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50' : ''
      } w-[285px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2.5 font-sans text-xs select-none relative overflow-hidden transition-all duration-280 ${
        isClosing
          ? 'opacity-0 scale-95 translate-y-1 pointer-events-none'
          : 'animate-in fade-in zoom-in-95 duration-100 opacity-100 scale-100'
      }`}
    >
      {/* 5-second inactivity subtle progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-light)] overflow-hidden rounded-b-xl pointer-events-none">
        <div
          className="h-full bg-amber-500 opacity-50 transition-[width] duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Header with Title and Close */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--text-main)]">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Real-time Visual Preview Card */}
      <div className="my-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center flex flex-col items-center justify-center min-h-[46px]">
        <span
          className="text-white font-medium text-sm transition-all"
          style={{
            textShadow: previewShadow || 'none',
          }}
        >
          ♪ Subtitle Preview ♪
        </span>
        <span className="text-[9px] font-mono text-neutral-400 mt-0.5">
          {shadow.enabled && outline.enabled
            ? 'Shadow + Outline Active'
            : shadow.enabled
            ? 'Drop-Shadow Active'
            : outline.enabled
            ? 'Outline Active'
            : 'Effects Disabled'}
        </span>
      </div>

      {/* Tabs: Drop-Shadow vs Outline */}
      <div className="flex rounded-md bg-[var(--bg-subtle)] p-0.5 border border-[var(--border-light)] mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('shadow')}
          className={`flex-1 py-1 rounded flex items-center justify-center gap-1 text-[10.5px] font-medium transition-all cursor-pointer ${
            activeTab === 'shadow'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Layers className="w-3 h-3 text-amber-500" />
          <span>Drop-Shadow</span>
          {shadow.enabled && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('outline')}
          className={`flex-1 py-1 rounded flex items-center justify-center gap-1 text-[10.5px] font-medium transition-all cursor-pointer ${
            activeTab === 'outline'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Sparkles className="w-3 h-3 text-blue-500" />
          <span>Outline</span>
          {outline.enabled && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5" />}
        </button>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'shadow' ? (
        <div className="space-y-2">
          {/* Enable Toggle & Color */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={shadow.enabled ?? false}
                onChange={(e) => setShadow({ ...shadow, enabled: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-[var(--accent)] cursor-pointer"
              />
              <span className="text-[10.5px] font-semibold text-[var(--text-main)]">Enable Shadow</span>
            </label>

            {/* Color Swatch */}
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={shadow.color || '#000000'}
                onChange={(e) => setShadow({ ...shadow, color: e.target.value })}
                className="w-5 h-5 rounded-xs border border-[var(--border)] cursor-pointer p-0 bg-transparent"
                title="Choose shadow color"
              />
              <span className="text-[9.5px] font-mono text-[var(--text-muted)]">
                {shadow.color || '#000000'}
              </span>
            </div>
          </div>

          {/* Quick Color Palette */}
          <div className="flex items-center gap-1 justify-between py-0.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setShadow({ ...shadow, color: c })}
                style={{ backgroundColor: c }}
                className={`w-4 h-4 rounded-full border border-black/30 transition-transform cursor-pointer ${
                  shadow.color?.toUpperCase() === c.toUpperCase() ? 'scale-120 ring-1 ring-[var(--accent)]' : 'hover:scale-110'
                }`}
                title={c}
              />
            ))}
          </div>

          {/* Opacity Slider (0 to 100) */}
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Opacity / Intensity</span>
            <span className="font-mono text-[var(--text-main)] font-bold">{shadow.opacity ?? 80}%</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={shadow.opacity ?? 80}
              onChange={(e) => setShadow({ ...shadow, opacity: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={shadow.opacity ?? 80}
              onChange={(e) =>
                setShadow({ ...shadow, opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
              className="w-10 h-5 px-1 font-mono text-[10px] bg-[var(--bg-subtle)] border border-[var(--border)] rounded text-center text-[var(--text-main)]"
            />
          </div>

          {/* Distance & Angle Grid */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Spread Distance (0 to 20px) */}
            <div>
              <div className="flex items-center justify-between text-[9.5px] text-[var(--text-muted)] mb-0.5">
                <span>Distance</span>
                <span className="font-mono text-[var(--text-main)] font-semibold">{shadow.distance ?? 3}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={shadow.distance ?? 3}
                onChange={(e) => setShadow({ ...shadow, distance: Number(e.target.value) })}
                className="w-full accent-[var(--accent)] cursor-pointer h-1.5"
              />
            </div>

            {/* Degree Angle (0 to 360°) */}
            <div>
              <div className="flex items-center justify-between text-[9.5px] text-[var(--text-muted)] mb-0.5">
                <span>Angle</span>
                <span className="font-mono text-[var(--text-main)] font-semibold">{shadow.angle ?? 45}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={shadow.angle ?? 45}
                onChange={(e) => setShadow({ ...shadow, angle: Number(e.target.value) })}
                className="w-full accent-[var(--accent)] cursor-pointer h-1.5"
              />
            </div>
          </div>

          {/* Softness Blur (0 to 20px) */}
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-0.5">
            <span>Softness / Blur</span>
            <span className="font-mono text-[var(--text-main)] font-bold">{shadow.blur ?? 4}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={shadow.blur ?? 4}
            onChange={(e) => setShadow({ ...shadow, blur: Number(e.target.value) })}
            className="w-full accent-[var(--accent)] cursor-pointer h-1.5"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Outline Enable & Color */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={outline.enabled ?? false}
                onChange={(e) => setOutline({ ...outline, enabled: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-[var(--accent)] cursor-pointer"
              />
              <span className="text-[10.5px] font-semibold text-[var(--text-main)]">Enable Outline</span>
            </label>

            {/* Color Swatch */}
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={outline.color || '#000000'}
                onChange={(e) => setOutline({ ...outline, color: e.target.value })}
                className="w-5 h-5 rounded-xs border border-[var(--border)] cursor-pointer p-0 bg-transparent"
                title="Choose outline color"
              />
              <span className="text-[9.5px] font-mono text-[var(--text-muted)]">
                {outline.color || '#000000'}
              </span>
            </div>
          </div>

          {/* Quick Color Palette */}
          <div className="flex items-center gap-1 justify-between py-0.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setOutline({ ...outline, color: c })}
                style={{ backgroundColor: c }}
                className={`w-4 h-4 rounded-full border border-black/30 transition-transform cursor-pointer ${
                  outline.color?.toUpperCase() === c.toUpperCase() ? 'scale-120 ring-1 ring-[var(--accent)]' : 'hover:scale-110'
                }`}
                title={c}
              />
            ))}
          </div>

          {/* Opacity Slider (0 to 100) */}
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Opacity / Intensity</span>
            <span className="font-mono text-[var(--text-main)] font-bold">{outline.opacity ?? 90}%</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={outline.opacity ?? 90}
              onChange={(e) => setOutline({ ...outline, opacity: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={outline.opacity ?? 90}
              onChange={(e) =>
                setOutline({ ...outline, opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
              className="w-10 h-5 px-1 font-mono text-[10px] bg-[var(--bg-subtle)] border border-[var(--border)] rounded text-center text-[var(--text-main)]"
            />
          </div>

          {/* Thickness / Size (0 to 20px) */}
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-0.5">
            <span>Thickness / Spread</span>
            <span className="font-mono text-[var(--text-main)] font-bold">{outline.size ?? 2}px</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="15"
              value={outline.size ?? 2}
              onChange={(e) => setOutline({ ...outline, size: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5"
            />
            <input
              type="number"
              min="1"
              max="15"
              value={outline.size ?? 2}
              onChange={(e) =>
                setOutline({ ...outline, size: Math.max(1, Math.min(15, Number(e.target.value) || 1)) })
              }
              className="w-10 h-5 px-1 font-mono text-[10px] bg-[var(--bg-subtle)] border border-[var(--border)] rounded text-center text-[var(--text-main)]"
            />
          </div>

          {/* Glow (0 to 20px) */}
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-0.5">
            <span>Glow Diffusion</span>
            <span className="font-mono text-[var(--text-main)] font-bold">{outline.glow ?? 3}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={outline.glow ?? 3}
            onChange={(e) => setOutline({ ...outline, glow: Number(e.target.value) })}
            className="w-full accent-[var(--accent)] cursor-pointer h-1.5"
          />
        </div>
      )}

      {/* Preset Quick Chips */}
      <div className="pt-2 mt-2 border-t border-[var(--border)]">
        <div className="flex items-center justify-between mb-1 text-[9px] font-mono uppercase text-[var(--text-muted)]">
          <span>Quick Presets</span>
          <button
            type="button"
            onClick={() => applyPreset('reset')}
            className="hover:text-[var(--text-main)] flex items-center gap-0.5 cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset</span>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => applyPreset('subtle_shadow')}
            className="px-1 py-0.5 text-[9px] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded text-[var(--text-muted)] hover:text-[var(--text-main)] truncate cursor-pointer"
          >
            Subtle
          </button>
          <button
            type="button"
            onClick={() => applyPreset('deep_shadow')}
            className="px-1 py-0.5 text-[9px] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded text-[var(--text-muted)] hover:text-[var(--text-main)] truncate cursor-pointer"
          >
            Deep
          </button>
          <button
            type="button"
            onClick={() => applyPreset('clean_outline')}
            className="px-1 py-0.5 text-[9px] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded text-[var(--text-muted)] hover:text-[var(--text-main)] truncate cursor-pointer"
          >
            Outline
          </button>
          <button
            type="button"
            onClick={() => applyPreset('neon_glow')}
            className="px-1 py-0.5 text-[9px] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded text-blue-500 font-semibold truncate cursor-pointer"
          >
            Neon
          </button>
        </div>
      </div>

      {/* Action Buttons: Cancel and Apply */}
      <div className="flex items-center justify-end gap-1.5 pt-2 mt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 text-[10.5px] rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(shadow, outline);
            onClose();
          }}
          className="px-3 py-1 text-[10.5px] font-semibold rounded-md bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
        >
          <Check className="w-3 h-3 stroke-[3]" />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
};
