import type { ListingType } from './types';

/**
 * Deterministic, category-themed SVG cover used when a listing has no
 * uploaded photos. Rendered at 800x500 and encoded with encodeURIComponent
 * (non-ASCII safe). The (type + title) hash varies accent placement so every
 * listing looks distinct. Keep in sync with the seed generator in
 * apps/api/src/seed/seed.ts.
 */

const COVER_THEMES: Record<ListingType, { from: string; to: string; grid: boolean; glyph: string }> = {
  // Deep navy → electric blue, subtle grid lines, warehouse/box glyph.
  WAREHOUSE: {
    from: '#0b1f4d',
    to: '#2f7bff',
    grid: true,
    glyph: 'M6 46 L50 14 L94 46 M16 46 V86 H84 V46 M36 86 V62 H64 V86 M36 74 H64',
  },
  // Indigo → teal, forklift-ish glyph.
  EQUIPMENT: {
    from: '#312e81',
    to: '#0d9488',
    grid: false,
    glyph:
      'M10 70 V40 H44 L56 56 H68 M72 74 V12 M72 74 H94 M72 44 H84 ' +
      'M16 78 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M46 78 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0',
  },
  // Navy → amber, gear glyph.
  SERVICE: {
    from: '#132a52',
    to: '#f59e0b',
    grid: false,
    glyph:
      'M32 50 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 M43 50 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 ' +
      'M50 32 V22 M50 68 V78 M32 50 H22 M68 50 H78 ' +
      'M37 37 L30 30 M63 37 L70 30 M63 63 L70 70 M37 63 L30 70',
  },
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function titleInitials(title: string): string {
  return (
    title
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** Category-themed cover art; the (type + title) hash varies accents so every listing looks distinct. */
export function placeholderCover(type: ListingType, title: string): string {
  const theme = COVER_THEMES[type] ?? COVER_THEMES.WAREHOUSE;
  const hash = hashSeed(`${type}:${title}`);
  const initials = titleInitials(title);
  const accentCx = 120 + (hash % 220);
  const accentCy = 400 - ((hash >>> 5) % 180);
  const accentR = 130 + ((hash >>> 11) % 90);
  const glyphX = 460 + ((hash >>> 7) % 50);
  const glyphY = 100 + ((hash >>> 13) % 40);
  const glyphScale = (2 + ((hash >>> 17) % 6) * 0.1).toFixed(2);
  const gradient = (hash & 1) === 1
    ? '<linearGradient id="c" x1="1" y1="0" x2="0" y2="1">'
    : '<linearGradient id="c" x1="0" y1="0" x2="1" y2="1">';
  const grid = theme.grid
    ? `<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="translate(${hash % 40} ${(hash >>> 4) % 40})">` +
      '<path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/></pattern>' +
      '<rect width="800" height="500" fill="url(#grid)"/>'
    : '';
  const chipWidth = 56 + initials.length * 22;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">' +
    `<defs>${gradient}` +
    `<stop offset="0" stop-color="${theme.from}"/><stop offset="1" stop-color="${theme.to}"/>` +
    `</linearGradient>${grid}</defs>` +
    '<rect width="800" height="500" fill="url(#c)"/>' +
    `<circle cx="${accentCx}" cy="${accentCy}" r="${accentR}" fill="rgba(255,255,255,0.07)"/>` +
    `<g transform="translate(${glyphX} ${glyphY}) scale(${glyphScale})" fill="none" stroke="rgba(255,255,255,0.88)" ` +
    `stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="${theme.glyph}"/></g>` +
    `<rect x="40" y="424" width="${chipWidth}" height="44" rx="12" fill="rgba(8,14,30,0.45)"/>` +
    `<text x="${40 + chipWidth / 2}" y="454" text-anchor="middle" font-family="Arial, sans-serif" ` +
    `font-size="22" font-weight="700" letter-spacing="4" fill="rgba(255,255,255,0.92)">${initials}</text>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
