import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Check, RotateCcw, Palette } from 'lucide-react';
import { useInactivityAutoClose } from '../hooks/useInactivityAutoClose';
import { CHARACTER_PALETTE } from '../types/subtitle';

export interface InlineColorWheelProps {
  color?: string;
  onChange: (hexColor: string) => void;
  title?: string;
  initialColor?: string;
  className?: string;
  onClose?: () => void;
  showApplyButton?: boolean;
}

export interface ColorWheelPickerProps {
  initialColor?: string;
  onChange: (hexColor: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
  title?: string;
}

// Convert HSL (0-360, 0-100, 0-100) to Hex (#RRGGBB)
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Convert Hex to HSL (0-360, 0-100, 0-100)
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length < 6) {
    return { h: 0, s: 0, l: 100 }; // fallback to white
  }

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const COMMON_SUBTITLE_COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Warm Gold', hex: '#FACC15' },
  { name: 'Cyan', hex: '#00FFFF' },
  { name: 'Neon Green', hex: '#22C55E' },
  { name: 'Bright Orange', hex: '#FB923C' },
  { name: 'Pink', hex: '#F472B6' },
  { name: 'Light Gray', hex: '#D1D5DB' },
];

/**
 * Reusable, self-contained chromatic color wheel with full controls:
 * Canvas wheel + Hue/Sat/Light sliders + Hex Input + Live Swatch + Presets
 */
export const InlineColorWheel: React.FC<InlineColorWheelProps> = ({
  color = '#FFFFFF',
  onChange,
  title = 'Color Wheel',
  initialColor,
  className = '',
  onClose,
  showApplyButton = false,
}) => {
  const startColor = initialColor || color || '#FFFFFF';
  const initialHsl = useMemo(() => hexToHsl(startColor), [startColor]);

  const [hue, setHue] = useState<number>(initialHsl.h);
  const [saturation, setSaturation] = useState<number>(initialHsl.s);
  const [lightness, setLightness] = useState<number>(initialHsl.l);
  const [hexInput, setHexInput] = useState<string>(startColor.toUpperCase());
  const [isDraggingWheel, setIsDraggingWheel] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if color changes externally from props
  useEffect(() => {
    if (color) {
      const hsl = hexToHsl(color);
      const computedHex = hslToHex(hsl.h, hsl.s, hsl.l);
      const cleanInput = (color.startsWith('#') ? color : `#${color}`).toUpperCase();
      if (cleanInput !== hexInput) {
        setHue(hsl.h);
        setSaturation(hsl.s);
        setLightness(hsl.l);
        setHexInput(cleanInput);
      }
    }
  }, [color]);

  const currentHex = useMemo(() => hslToHex(hue, saturation, lightness), [hue, saturation, lightness]);

  // Update parent and hex display on color change
  const notifyColorChange = useCallback(
    (newHex: string) => {
      setHexInput(newHex);
      onChange(newHex);
    },
    [onChange]
  );

  // Render high-resolution chromatic color wheel onto Canvas
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;
    const cx = radius;
    const cy = radius;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Use current lightness for the wheel rendering to make it dynamic
    const currentL = lightness / 100;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const index = (y * width + x) * 4;

        if (dist <= radius - 2) {
          // Calculate angle (0-360)
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          // Saturation (0-1)
          const s = Math.min(1, dist / (radius - 2));

          // HSL to RGB
          const a = s * Math.min(currentL, 1 - currentL);
          const f = (n: number) => {
            const k = (n + angle / 30) % 12;
            return currentL - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          };

          data[index] = Math.round(f(0) * 255);
          data[index + 1] = Math.round(f(8) * 255);
          data[index + 2] = Math.round(f(4) * 255);
          data[index + 3] = 255;
        } else if (dist <= radius) {
          // Antialiased edge
          const edgeAlpha = Math.max(0, 1 - (dist - (radius - 2)) / 2);
          data[index] = 120;
          data[index + 1] = 120;
          data[index + 2] = 120;
          data[index + 3] = Math.round(edgeAlpha * 180);
        } else {
          data[index + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw reticle indicator for current (hue, saturation)
    const rad = (hue * Math.PI) / 180;
    const satDist = (saturation / 100) * (radius - 2);
    const markerX = cx + satDist * Math.cos(rad);
    const markerY = cy + satDist * Math.sin(rad);

    ctx.save();
    ctx.beginPath();
    ctx.arc(markerX, markerY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = currentHex;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = lightness > 50 ? '#000000' : '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }, [hue, saturation, lightness, currentHex]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Handle pointer on color wheel
  const handleWheelPointer = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = cx - 2;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    const newSat = Math.min(100, Math.max(0, Math.round((dist / maxRadius) * 100)));
    const newHue = Math.round(angle);

    setHue(newHue);
    setSaturation(newSat);
    const updatedHex = hslToHex(newHue, newSat, lightness);
    notifyColorChange(updatedHex);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingWheel(true);
    handleWheelPointer(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingWheel) {
      handleWheelPointer(e);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingWheel(false);
  };

  // Hex input change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setHexInput(val);
    if (/^#?[0-9A-F]{6}$/i.test(val)) {
      const clean = val.startsWith('#') ? val : `#${val}`;
      const hsl = hexToHsl(clean);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      onChange(clean);
    }
  };

  // Quick preset apply
  const handleSelectPreset = (hex: string) => {
    const hsl = hexToHsl(hex);
    setHue(hsl.h);
    setSaturation(hsl.s);
    setLightness(hsl.l);
    notifyColorChange(hex.toUpperCase());
  };

  // Reset to initial
  const handleReset = () => {
    const hsl = hexToHsl(startColor);
    setHue(hsl.h);
    setSaturation(hsl.s);
    setLightness(hsl.l);
    notifyColorChange(startColor.toUpperCase());
  };

  // Dynamic slider gradient styles
  const hueSliderBg =
    'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)';
  const satSliderBg = `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`;
  const lightSliderBg = `linear-gradient(to right, #000000 0%, hsl(${hue}, ${saturation}%, 50%) 50%, #ffffff 100%)`;

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs select-none relative space-y-2.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--text-main)] min-w-0 truncate">
          <Palette className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            title={`Reset to original (${startColor})`}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Circular Chromatic Color Wheel Canvas */}
      <div className="flex justify-center items-center py-0.5">
        <div className="relative rounded-full shadow-inner p-1 bg-black/10">
          <canvas
            ref={canvasRef}
            width={136}
            height={136}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleWheelPointer}
            onTouchMove={handleWheelPointer}
            className="cursor-crosshair rounded-full touch-none block"
            title="Click and drag on wheel to select Hue and Saturation"
          />
        </div>
      </div>

      {/* Associated Sliders Below Wheel */}
      <div className="space-y-1.5 pt-1 border-t border-[var(--border-light)]">
        {/* Hue Slider */}
        <div className="flex items-center gap-2">
          <span className="w-8 font-mono text-[9.5px] font-bold text-[var(--text-muted)]">HUE</span>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => {
              const newH = Number(e.target.value);
              setHue(newH);
              notifyColorChange(hslToHex(newH, saturation, lightness));
            }}
            style={{ background: hueSliderBg }}
            className="flex-1 h-2 rounded-md appearance-none cursor-pointer outline-hidden accent-white"
          />
          <span className="w-7 font-mono text-[9.5px] text-right text-[var(--text-muted)]">{hue}°</span>
        </div>

        {/* Saturation Slider */}
        <div className="flex items-center gap-2">
          <span className="w-8 font-mono text-[9.5px] font-bold text-[var(--text-muted)]">SAT</span>
          <input
            type="range"
            min={0}
            max={100}
            value={saturation}
            onChange={(e) => {
              const newS = Number(e.target.value);
              setSaturation(newS);
              notifyColorChange(hslToHex(hue, newS, lightness));
            }}
            style={{ background: satSliderBg }}
            className="flex-1 h-2 rounded-md appearance-none cursor-pointer outline-hidden accent-white"
          />
          <span className="w-7 font-mono text-[9.5px] text-right text-[var(--text-muted)]">{saturation}%</span>
        </div>

        {/* Lightness Slider */}
        <div className="flex items-center gap-2">
          <span className="w-8 font-mono text-[9.5px] font-bold text-[var(--text-muted)]">LIGHT</span>
          <input
            type="range"
            min={0}
            max={100}
            value={lightness}
            onChange={(e) => {
              const newL = Number(e.target.value);
              setLightness(newL);
              notifyColorChange(hslToHex(hue, saturation, newL));
            }}
            style={{ background: lightSliderBg }}
            className="flex-1 h-2 rounded-md appearance-none cursor-pointer outline-hidden accent-white"
          />
          <span className="w-7 font-mono text-[9.5px] text-right text-[var(--text-muted)]">{lightness}%</span>
        </div>
      </div>

      {/* Color Hex Input & Swatch Preview */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md border border-[var(--border)] shadow-xs shrink-0 transition-transform"
            style={{ backgroundColor: currentHex }}
            title={`Current Color: ${currentHex}`}
          />
          <input
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            placeholder="#FFFFFF"
            maxLength={7}
            className="w-20 h-6 px-1.5 font-mono text-[11px] font-bold rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] outline-hidden focus:ring-1 focus:ring-[var(--accent)] uppercase"
          />
        </div>

        {showApplyButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="h-6 px-2.5 rounded bg-[var(--accent)] hover:opacity-90 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-opacity shadow-2xs"
          >
            <Check className="w-3 h-3" />
            <span>Apply</span>
          </button>
        )}
      </div>

      {/* Subtitle & Character Quick Presets */}
      <div className="pt-1.5 border-t border-[var(--border-light)]">
        <div className="text-[9px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-wider">
          Presets
        </div>
        <div className="flex flex-wrap gap-1">
          {/* Subtitle Common Colors */}
          {COMMON_SUBTITLE_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => handleSelectPreset(c.hex)}
              title={`${c.name} (${c.hex})`}
              className={`w-4.5 h-4.5 rounded-xs border transition-all cursor-pointer hover:scale-120 ${
                currentHex.toLowerCase() === c.hex.toLowerCase()
                  ? 'ring-2 ring-[var(--accent)] border-white scale-110'
                  : 'border-[var(--border)]'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          {/* Character Palette Colors */}
          {CHARACTER_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleSelectPreset(c)}
              title={`Preset (${c})`}
              className={`w-4.5 h-4.5 rounded-full border transition-all cursor-pointer hover:scale-120 ${
                currentHex.toLowerCase() === c.toLowerCase()
                  ? 'ring-2 ring-[var(--accent)] border-white scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Floating Popover Color Wheel Picker
 */
export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  initialColor = '#FFFFFF',
  onChange,
  onClose,
  position,
  title = 'Subtitle Color',
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // 5-second inactivity auto-close with natural smooth fade-out
  const { isClosing, progress } = useInactivityAutoClose({
    isOpen: true,
    timeoutMs: 5000,
    onClose,
    containerRef: popoverRef,
  });

  // Click outside listener
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={`fixed z-50 w-72 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl p-2.5 text-xs select-none relative overflow-hidden transition-all duration-280 ${
        isClosing
          ? 'opacity-0 scale-95 translate-y-1 pointer-events-none'
          : 'animate-in fade-in zoom-in-95 duration-100 opacity-100 scale-100'
      }`}
      style={{
        top: position?.top !== undefined ? Math.min(window.innerHeight - 380, Math.max(10, position.top)) : '20%',
        left: position?.left !== undefined ? Math.min(window.innerWidth - 300, Math.max(10, position.left)) : '30%',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 5-second inactivity subtle progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-light)] overflow-hidden rounded-b-xl pointer-events-none">
        <div
          className="h-full bg-[var(--accent)] opacity-40 transition-[width] duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <InlineColorWheel
        color={initialColor}
        initialColor={initialColor}
        onChange={onChange}
        onClose={onClose}
        title={title}
        showApplyButton={true}
        className="border-0 bg-transparent p-0"
      />
    </div>
  );
};
