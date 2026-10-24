/**
 * Design tokens ported 1:1 from the web theme (packages/ui/src/tokens.css).
 *
 * One night palette is used for both light and dark in illustration; the chrome
 * (surfaces, text, brand, status) flips with the theme. Keeping the same hex
 * values as the web CSS guarantees the mobile app is visually identical to the
 * customer/partner/admin SPAs.
 */

export type ThemeName = 'light' | 'dark';

export interface ThemeTokens {
  name: ThemeName;
  // Surfaces
  bg: string;
  bgPage: string;
  surface: string;
  surface2: string;
  surface3: string;
  surfaceElevated: string;
  // Text
  fg: string;
  fgStrong: string;
  muted: string;
  faint: string;
  // Lines
  line: string;
  lineStrong: string;
  // Brand
  brand: string;
  brandHover: string;
  brandActive: string;
  brandFg: string;
  brandSoft: string;
  brandSoftFg: string;
  // Accent
  accent: string;
  accentSoft: string;
  accentSoftFg: string;
  // Status
  success: string;
  successSoft: string;
  successSoftFg: string;
  warning: string;
  warningSoft: string;
  warningSoftFg: string;
  danger: string;
  dangerSoft: string;
  dangerSoftFg: string;
  info: string;
  infoSoft: string;
  infoSoftFg: string;
  neutralSoft: string;
  neutralSoftFg: string;
  // Radii
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusXl: number;
  radius2xl: number;
}

const shared = {
  brand: '#10b981',
  brandHover: '#34d399',
  brandActive: '#6ee7b7',
  success: '#10b981',
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radius2xl: 28,
};

export const lightTheme: ThemeTokens = {
  name: 'light',
  bg: '#ffffff',
  bgPage: '#f8fafc',
  surface: '#ffffff',
  surface2: '#f8fafc',
  surface3: '#f1f5f9',
  surfaceElevated: '#ffffff',
  fg: '#0f172a',
  fgStrong: '#020617',
  muted: '#475569',
  faint: '#94a3b8',
  line: '#e2e8f0',
  lineStrong: '#cbd5e1',
  ...shared,
  brandFg: '#ffffff',
  brandSoft: 'rgba(16, 185, 129, 0.12)',
  brandSoftFg: '#047857',
  accent: '#2563eb',
  accentSoft: 'rgba(59, 130, 246, 0.12)',
  accentSoftFg: '#1e40af',
  successSoft: '#ecfdf5',
  successSoftFg: '#065f46',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  warningSoftFg: '#92400e',
  danger: '#ef4444',
  dangerSoft: '#fef2f2',
  dangerSoftFg: '#991b1b',
  info: '#3b82f6',
  infoSoft: '#eff6ff',
  infoSoftFg: '#1e40af',
  neutralSoft: '#f1f5f9',
  neutralSoftFg: '#64748b',
};

export const darkTheme: ThemeTokens = {
  name: 'dark',
  bg: '#101010',
  bgPage: '#0a0a0a',
  surface: '#181818',
  surface2: '#1c1c1c',
  surface3: '#262626',
  surfaceElevated: '#202020',
  fg: '#f5f5f5',
  fgStrong: '#fafafa',
  muted: '#a1a1aa',
  faint: '#71717a',
  line: '#27272a',
  lineStrong: '#3f3f46',
  ...shared,
  brandFg: '#052e16',
  brandSoft: 'rgba(16, 185, 129, 0.12)',
  brandSoftFg: '#a7f3d0',
  accent: '#60a5fa',
  accentSoft: 'rgba(59, 130, 246, 0.12)',
  accentSoftFg: '#93c5fd',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  successSoftFg: '#a7f3d0',
  warning: '#fbbf24',
  warningSoft: 'rgba(251, 191, 36, 0.12)',
  warningSoftFg: '#fde047',
  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  dangerSoftFg: '#fca5a5',
  info: '#60a5fa',
  infoSoft: 'rgba(96, 165, 250, 0.12)',
  infoSoftFg: '#93c5fd',
  neutralSoft: '#27272a',
  neutralSoftFg: '#a1a1aa',
};

/** Typography scale (Inter). Weights map to the loaded Inter faces or system fallback. */
export const typography = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/** Spacing scale (4pt base). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Elevation shadows (iOS shadow + Android elevation). */
export const shadows = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
} as const;

export const themes: Record<ThemeName, ThemeTokens> = {
  light: lightTheme,
  dark: darkTheme,
};
