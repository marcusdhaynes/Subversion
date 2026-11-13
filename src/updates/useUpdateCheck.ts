import { useCallback, useEffect, useState } from 'react';
import { checkForUpdate, CURRENT_VERSION, type UpdateInfo } from './updateCheck';

export function useUpdateCheck() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try { setUpdate(await checkForUpdate()); }
    catch { setUpdate(null); }
    finally { setChecking(false); setChecked(true); }
  }, []);

  useEffect(() => { void check(); }, [check]);
  return { currentVersion: CURRENT_VERSION, update, checking, checked, check };
}
