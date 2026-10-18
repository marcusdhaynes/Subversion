import { useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { THEME_PRESETS, ThemeMode, ThemePreset } from '../types/theme';

const STORAGE_MODE_KEY = 'subflow_theme_mode';
const STORAGE_DARK_THEME_KEY = 'subflow_active_dark_theme';
const STORAGE_LIGHT_THEME_KEY = 'subflow_active_light_theme';

function applyThemeDirectly(isDark: boolean, theme: ThemePreset) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Temporarily disable all transitions across the entire DOM during theme flip
  // so every single element (header, table, inputs, cards) switches at the exact same instant
  root.classList.add('no-transitions');

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });

  // Force synchronous reflow so all elements commit new theme variables at the exact same time
  void root.offsetHeight;

  requestAnimationFrame(() => {
    root.classList.remove('no-transitions');
  });
}

export function useDarkMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_MODE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [activeDarkThemeId, setActiveDarkThemeId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DARK_THEME_KEY);
      if (stored && THEME_PRESETS.some((t) => t.id === stored && t.mode === 'dark')) {
        return stored;
      }
    } catch {
      // fallback
    }
    return 'star-admin';
  });

  const [activeLightThemeId, setActiveLightThemeId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_LIGHT_THEME_KEY);
      if (stored && THEME_PRESETS.some((t) => t.id === stored && t.mode === 'light')) {
        return stored;
      }
    } catch {
      // fallback
    }
    return 'porcelain-pearl';
  });

  const isDark = mode === 'dark';

  const currentTheme = useMemo<ThemePreset>(() => {
    const targetId = isDark ? activeDarkThemeId : activeLightThemeId;
    const found = THEME_PRESETS.find((t) => t.id === targetId && t.mode === mode);
    if (found) return found;
    return THEME_PRESETS.find((t) => t.mode === mode) || THEME_PRESETS[0];
  }, [isDark, mode, activeDarkThemeId, activeLightThemeId]);

  // Synchronously apply CSS variables to root and update class before paint
  useLayoutEffect(() => {
    try {
      applyThemeDirectly(isDark, currentTheme);
      localStorage.setItem(STORAGE_MODE_KEY, mode);
    } catch {
      // fallback
    }
  }, [mode, isDark, currentTheme]);

  const toggleDarkMode = useCallback(() => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    const nextIsDark = nextMode === 'dark';
    const targetId = nextIsDark ? activeDarkThemeId : activeLightThemeId;
    const targetTheme =
      THEME_PRESETS.find((t) => t.id === targetId && t.mode === nextMode) ||
      THEME_PRESETS.find((t) => t.mode === nextMode) ||
      THEME_PRESETS[0];

    // Synchronously apply theme directly to DOM immediately
    applyThemeDirectly(nextIsDark, targetTheme);
    try {
      localStorage.setItem(STORAGE_MODE_KEY, nextMode);
      localStorage.setItem('subflow_darkmode', nextIsDark ? 'true' : 'false');
    } catch {}

    setMode(nextMode);
  }, [mode, activeDarkThemeId, activeLightThemeId]);

  const selectTheme = useCallback(
    (themeId: string) => {
      const targetTheme = THEME_PRESETS.find((t) => t.id === themeId);
      if (!targetTheme) return;

      const nextIsDark = targetTheme.mode === 'dark';
      applyThemeDirectly(nextIsDark, targetTheme);

      if (targetTheme.mode === 'dark') {
        setActiveDarkThemeId(themeId);
        try {
          localStorage.setItem(STORAGE_DARK_THEME_KEY, themeId);
        } catch {}
        if (mode !== 'dark') setMode('dark');
      } else {
        setActiveLightThemeId(themeId);
        try {
          localStorage.setItem(STORAGE_LIGHT_THEME_KEY, themeId);
        } catch {}
        if (mode !== 'light') setMode('light');
      }

      try {
        localStorage.setItem(STORAGE_MODE_KEY, targetTheme.mode);
        localStorage.setItem('subflow_darkmode', nextIsDark ? 'true' : 'false');
      } catch {}
    },
    [mode]
  );

  return {
    isDark,
    mode,
    currentTheme,
    toggleDarkMode,
    selectTheme,
    availableThemesForMode: THEME_PRESETS.filter((t) => t.mode === mode),
  };
}
