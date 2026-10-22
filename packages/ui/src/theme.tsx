import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from './cn';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'bmw-theme';

/** Apply a resolved theme to <html> (data-theme + color-scheme). */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#f8fafc');
}

export function getStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* private mode */
  }
  return 'system';
}

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

interface ThemeContextValue {
  /** What the user chose: light | dark | system. */
  theme: ThemePreference;
  /** What is actually rendered right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  /** Cycles light -> dark -> system. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provides light/dark/system theming with persistence. Expects the inline
 * bootstrap script in index.html to have already set data-theme pre-paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : getStoredTheme()
  );
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(() =>
    typeof window === 'undefined' ? 'light' : systemTheme()
  );

  // Follow OS changes while "system" is selected.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemResolved(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemResolved : theme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, cycleTheme }),
    [theme, resolvedTheme, setTheme, cycleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

const LABELS: Record<ThemePreference, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

/** Compact 3-state toggle (light -> dark -> system) for nav bars. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, cycleTheme } = useTheme();
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`${LABELS[theme]} — click to switch`}
      title={LABELS[theme]}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted',
        'transition-all duration-base ease-smooth hover:border-line-strong hover:text-fg hover:shadow-md',
        'active:scale-95',
        className
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
