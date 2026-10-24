/**
 * Theme context — provides the active ThemeTokens (light/dark) and a setter.
 *
 * The preference is persisted to AsyncStorage under `bmw-theme` (the same key
 * the web apps use) and defaults to the system appearance. Consumers read the
 * token object and use it inline in StyleSheet values, so flipping the theme
 * re-renders with no rebuild.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { STORAGE_KEYS } from '@/constants/config';
import { themes, type ThemeName, type ThemeTokens } from '@/theme/tokens';

interface ThemeContextValue {
  theme: ThemeTokens;
  themeName: ThemeName;
  /** 'system' follows the device; otherwise an explicit override. */
  preference: ThemeName | 'system';
  setPreference: (pref: ThemeName | 'system') => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemeName | 'system'>('system');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEYS.theme)
      .then((stored) => {
        if (!mounted) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = (pref: ThemeName | 'system') => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEYS.theme, pref).catch(() => {});
  };

  const themeName: ThemeName = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = themes[themeName];

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeName,
      preference,
      setPreference,
      toggle: () => setPreference(themeName === 'dark' ? 'light' : 'dark'),
    }),
    [theme, themeName, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx.theme;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within a ThemeProvider');
  return ctx;
}
