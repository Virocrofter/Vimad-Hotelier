/* DS-07 — axe a11y scan over the staff app's key surfaces.
 * WCAG 2.2 ruleset (runOnly wcag2a+wcag2aa via tags); fails on critical/serious.
 * Run: npm run a11y  (from apps/web). Report: docs/design-system/a11y-report.json */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs';

const WEB = 'http://localhost:5173';
const PAGES = [
  ['/app/dashboard', 'dashboard'],
  ['/app/reservations', 'reservations'],
  ['/app/exceptions', 'exceptions'],
  ['/app/billing', 'billing'],
  ['/app/ar', 'ar'],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(WEB + '/auth/login');
await page.locator('#tenantSlug').fill('demo-hotel');
await page.locator('#email').fill('admin@demo.com');
await page.locator('#password').fill('admin123');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/app/**', { timeout: 20000 });
await page.waitForTimeout(2000);

const report = {
  generatedAt: new Date().toISOString(),
  pages: {},
  totals: { critical: 0, serious: 0, moderate: 0, minor: 0 },
};

for (const [path, name] of PAGES) {
  await page.goto(WEB + path);
  await page.waitForTimeout(2500);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of results.violations) {
    counts[v.impact] = (counts[v.impact] ?? 0) + v.nodes.length;
    report.totals[v.impact] = (report.totals[v.impact] ?? 0) + v.nodes.length;
  }
  report.pages[name] = {
    url: path,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.map((n) => n.target.join(' ')),
    })),
    counts,
  };
  console.log(name, JSON.stringify(counts));
}

const reportUrl = new URL('../docs/design-system/a11y-report.json', import.meta.url);
fs.mkdirSync(new URL('../docs/design-system/', import.meta.url), { recursive: true });
fs.writeFileSync(reportUrl, JSON.stringify(report, null, 2));
console.log('TOTALS', JSON.stringify(report.totals));
const blocked = (report.totals.critical ?? 0) + (report.totals.serious ?? 0);
console.log(
  blocked > 0
    ? `=== ${blocked} critical/serious violation(s) — gate would FAIL ===`
    : '=== a11y gate green ==='
);
await browser.close();
process.exit(blocked > 0 ? 1 : 0); // DS-07 gate armed: build fails on critical/serious
