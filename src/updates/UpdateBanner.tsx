import React, { useState } from 'react';
import { applyUpdate, dismissVersion, isDismissed } from './updateCheck';
import { useUpdateCheck } from './useUpdateCheck';

/**
 * Uniform update ribbon: thin, top-center, very low height, neutral /
 * theme-aware styling. The ribbon itself is the button (click = update).
 * The × dismisses it permanently for that version
 * (localStorage `updates:dismissed:<version>`). No Update/Later buttons.
 * Full details live only in Settings → Updates (bottom).
 */
export function UpdateBanner() {
  const { update } = useUpdateCheck();
  const [hidden, setHidden] = useState(false);
  if (!update || hidden || isDismissed(update.version)) return null;

  return (
    <div style={{ position: 'fixed', top: 8, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        role="button"
        tabIndex={0}
        title="Click to update"
        onClick={() => applyUpdate(update)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyUpdate(update); } }}
        style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8,
          height: 24, padding: '0 6px 0 12px', borderRadius: 999,
          fontSize: 12, lineHeight: '24px', cursor: 'pointer', userSelect: 'none',
          color: 'inherit', background: 'rgba(127,127,127,0.16)',
          border: '1px solid rgba(127,127,127,0.35)', backdropFilter: 'blur(6px)',
        }}
      >
        <span>Update available · v{update.version}</span>
        <button
          type="button"
          aria-label={`Dismiss update v${update.version}`}
          onClick={(e) => { e.stopPropagation(); dismissVersion(update.version); setHidden(true); }}
          style={{ pointerEvents: 'auto', border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.7 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
export default UpdateBanner;
