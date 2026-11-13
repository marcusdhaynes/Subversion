import React from 'react';
import { applyUpdate } from './updateCheck';
import { useUpdateCheck } from './useUpdateCheck';

/**
 * Permanent Updates section — rendered at the very BOTTOM of Settings.
 * Shows current version, available version, What's New, Check and Update.
 */
export function UpdatesSection() {
  const { currentVersion, update, checking, checked, check } = useUpdateCheck();
  return (
    <section aria-label="Updates" style={{ borderTop: '1px solid rgba(127,127,127,0.3)', paddingTop: 16, marginTop: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Updates</h3>
      <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>Current version: <strong>{currentVersion === 'unknown' ? 'Unknown' : `v${currentVersion}`}</strong></div>
        <div>Available version: <strong>{update ? `v${update.version}` : checked && !checking ? 'None — you are up to date' : '—'}</strong></div>
      </div>
      {update && update.notes ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>What's New</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: '4px 0 0', fontFamily: 'inherit' }}>{update.notes}</pre>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => void check()} disabled={checking}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {update ? (
          <button type="button" onClick={() => applyUpdate(update)}>Update to v{update.version}</button>
        ) : null}
      </div>
    </section>
  );
}
export default UpdatesSection;
