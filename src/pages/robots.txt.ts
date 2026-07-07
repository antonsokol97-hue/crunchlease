import type { APIRoute } from 'astro';
import { DOMAIN } from '../config';

// Dynamic so the sitemap URL always tracks config.DOMAIN (SPEC.md §5/§8).
// Embed routes are excluded from indexing via <meta name="robots" content="noindex">
// on the page itself, not via Disallow here — disallowing crawl would hide
// that noindex tag from Google and risk the URL surfacing anyway.
export const GET: APIRoute = () => {
  const sitemapUrl = new URL('/sitemap-index.xml', DOMAIN).toString();
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
