import { env } from '../config/env.js';
import { Listing } from '../models/index.js';

/** Cache the generated sitemap in-memory so crawlers don't hammer the DB. */
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedXml: { body: string; expiresAt: number } | null = null;

/** Escape a value for safe interpolation into XML text/attribute content. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function customerUrl(path: string): string {
  const base = env.CUSTOMER_APP_URL.replace(/\/+$/, '');
  return `${base}${path}`;
}

interface UrlEntry {
  loc: string;
  lastmod?: Date | null;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
}

function urlEntryXml(entry: UrlEntry): string {
  const parts = [`    <loc>${esc(entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod.toISOString()}</lastmod>`);
  if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/**
 * Build the public sitemap: home, search, and every live listing.
 * Only PUBLISHED, non-deleted listings are included.
 */
export async function buildSitemapXml(): Promise<string> {
  const now = Date.now();
  if (cachedXml && cachedXml.expiresAt > now) return cachedXml.body;

  const listings = await Listing.find({ status: 'PUBLISHED', deletedAt: null })
    .select('slug updatedAt')
    .sort({ updatedAt: -1 })
    .limit(5000)
    .lean();

  const entries: UrlEntry[] = [
    { loc: customerUrl('/'), changefreq: 'weekly', priority: '1.0' },
    { loc: customerUrl('/search'), changefreq: 'weekly', priority: '0.9' },
  ];

  for (const listing of listings) {
    entries.push({
      loc: customerUrl(`/listing/${encodeURIComponent(listing.slug)}`),
      lastmod: listing.updatedAt,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(urlEntryXml)
    .join('\n')}\n</urlset>\n`;

  cachedXml = { body, expiresAt: Date.now() + CACHE_TTL_MS };
  return body;
}

/** robots.txt pointing crawlers at the customer app and the sitemap. */
export function buildRobotsTxt(): string {
  const sitemapUrl = customerUrl('/api/sitemap.xml');
  return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /partner/\nSitemap: ${sitemapUrl}\n`;
}
