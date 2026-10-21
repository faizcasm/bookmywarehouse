import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { buildRobotsTxt, buildSitemapXml } from '../services/sitemap.service.js';

/**
 * Public, unauthenticated GET routes that must answer at the domain root on
 * any deployment (sitemap.xml / robots.txt) as well as under /api/ on Vercel,
 * where the API service is only reachable via the /api/* rewrite.
 */
export function publicRoutes(): Router {
  const router = Router();

  const sitemap = asyncHandler(async (_req, res) => {
    const xml = await buildSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
    res.send(xml);
  });

  const robots = asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
    res.send(buildRobotsTxt());
  });

  router.get('/sitemap.xml', sitemap);
  router.get('/api/sitemap.xml', sitemap);
  router.get('/robots.txt', robots);
  router.get('/api/robots.txt', robots);

  return router;
}
