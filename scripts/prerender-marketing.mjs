#!/usr/bin/env node
/* scripts/prerender-marketing.mjs — Foundation C1 (2026-11-27)
 * Post-build SEO prerender for the marketing site. Serves apps/web/dist on an
 * ephemeral port, renders every marketing route in real Chrome (playwright),
 * writes a static snapshot per route (dist/<route>/index.html), then emits
 * sitemap.xml + robots.txt into dist. RUN AFTER: cd apps/web && npm run build.
 * SITEMAP_BASE env overrides the absolute origin (default https://vimad.io,
 * the blueprint §5 domain decision).
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'apps/web/dist');
const BASE = (process.env.SITEMAP_BASE || 'https://vimad.io').replace(/\/$/, '');
const PORT = 4199;

const ROUTES = [
  '/',
  '/pricing',
  '/features',
  '/solutions',
  '/solutions/boutique-hotels',
  '/solutions/hotel-chains',
  '/solutions/contactless-checkin',
  '/solutions/ai-revenue-management',
  '/alternatives',
  '/alternatives/cloudbeds',
  '/alternatives/hilton-onq',
  '/alternatives/opera-5',
  '/case-studies',
  '/blog',
  '/contact',
  '/demo',
  '/get-quote',
  '/switch',
  '/alternatives',
  '/about',
  '/partners',
  '/integrations',
  '/help',
  '/status',
  '/api-docs',
  '/security',
  '/privacy',
  '/gdpr',
  '/pci-dss',
  '/terms',
  '/system-requirements',
];

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const indexFor = (route) =>
  route === '/' ? join(DIST, 'index.html') : join(DIST, route.slice(1), 'index.html');

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file;
  if (ROUTES.includes(urlPath) && existsSync(indexFor(urlPath))) {
    file = indexFor(urlPath);
  } else {
    const candidate = join(DIST, urlPath);
    file =
      existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(DIST, 'index.html');
  }
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext()).newPage();
const failures = [];
let snapshotted = 0;
const today = new Date().toISOString().slice(0, 10);

for (const route of ROUTES) {
  try {
    const resp = await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(400);
    const status = resp?.status() ?? 0;
    if (status >= 400) {
      failures.push(`${route} HTTP ${status}`);
      continue;
    }
    const html = await page.content();
    const out = indexFor(route);
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(out, html);
    snapshotted++;
  } catch (err) {
    failures.push(`${route} ${String(err).slice(0, 120)}`);
  }
}

const urls = ROUTES.map(
  (r) => `  <url><loc>${BASE}${r === '/' ? '/' : r + '/'}</loc><lastmod>${today}</lastmod></url>`
).join('\n');
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);
writeFileSync(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# Sitemap: <absolute URL> — added when the domain goes live (base: ${BASE})\n`
);

await browser.close();
server.close();

console.log(`prerender: ${snapshotted}/${ROUTES.length} routes snapshotted to apps/web/dist`);
if (failures.length > 0) {
  console.error('PRERENDER FAILURES:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('sitemap.xml + robots.txt written to apps/web/dist');
