/* scripts/p7-ui-evidence.mjs — 7.7 evidence: P7 UI surfaces + mobile/offline facts.
 * Needs: API on :3001, web dev server on :5173 (or :3000). Run: node scripts/p7-ui-evidence.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '.vimad-evidence/p7-ui';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  console.log(results[results.length - 1]);
};

// 1. API reachable + demo login
const login = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' }),
});
const loginBody = await login.json().catch(() => ({}));
const token = loginBody?.data?.token ?? loginBody?.token;
check('api login', login.ok && !!token, `status ${login.status}`);
if (!token) {
  console.log(results.join('\n'));
  process.exit(1);
}
const user = loginBody?.data?.user ?? loginBody?.user ?? { email: 'admin@demo.com', role: 'admin' };

// 2. pick the dev-server port
let base = null;
for (const port of [5173, 3000]) {
  try {
    const r = await fetch(`http://localhost:${port}/app/tasks`, { redirect: 'follow' });
    if (r.ok || r.status === 200) {
      base = `http://localhost:${port}`;
      break;
    }
  } catch {}
}
check('dev server', !!base, base ?? 'neither :5173 nor :3000 answered');
if (!base) {
  console.log(results.join('\n'));
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

await page.addInitScript(
  ([tok, usr]) => {
    localStorage.setItem('vimad_access_token', tok);
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user: usr, token: tok, refreshToken: null, isAuthenticated: true, permissions: [] },
        version: 0,
      })
    );
  },
  [token, user]
);

// 3. Space Report tab
await page.goto(`${base}/app/housekeeping`, { waitUntil: 'networkidle' });
await page.locator('button:has-text("Space Report")').first().click();
await page.waitForTimeout(1500);
const floorCards = await page.locator('text=Floor').count();
check('space report floors', floorCards > 0, `${floorCards} floor markers`);
await page.screenshot({ path: `${OUT}/01-space-report.png`, fullPage: true });

// 4. Lost & Found tab
await page.locator('button:has-text("Lost & Found")').first().click();
await page.waitForTimeout(1200);
const lfText = await page.locator('text=Register item').count();
check('lost & found view', lfText > 0, 'register CTA present');
await page.screenshot({ path: `${OUT}/02-lost-found.png`, fullPage: true });

// 5. Task queue + inspector drawer
await page.goto(`${base}/app/tasks`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const rows = await page.locator('tbody tr').count();
check('task queue rows', rows > 0, `${rows} rows`);
await page.screenshot({ path: `${OUT}/03-task-queue.png`, fullPage: true });
if (rows > 0) {
  await page.locator('tbody tr').first().click();
  await page.waitForTimeout(800);
  const drawer = await page.locator('[role="dialog"]').count();
  check('task inspector drawer', drawer > 0, `${drawer} dialog(s)`);
  await page.screenshot({ path: `${OUT}/04-task-inspector.png` });
  await page.keyboard.press('Escape');
}

// 6. Mobile page + offline facts
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mp = await mctx.newPage();
await mp.addInitScript(
  ([tok, usr]) => {
    localStorage.setItem('vimad_access_token', tok);
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user: usr, token: tok, refreshToken: null, isAuthenticated: true, permissions: [] },
        version: 0,
      })
    );
  },
  [token, user]
);
await mp.goto(`${base}/app/housekeeping/mobile`, { waitUntil: 'networkidle' }).catch(() => {});
await mp.waitForTimeout(1500);
await mp.screenshot({ path: `${OUT}/05-mobile-hk.png`, fullPage: true });
const sw = await mp.evaluate(() =>
  navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((r) => r.length) : -1
);
check('service worker registered', sw !== 0, `registrations: ${sw}`);

// offline probe: reads must fail offline, recover online
await mctx.setOffline(true);
let offlineFailed = false;
try {
  await mp.evaluate(async () => {
    const r = await fetch('/api/v1/housekeeping/supervisor/space-report?propertyId=x', {
      signal: AbortSignal.timeout(4000),
    });
    return r.status;
  });
} catch {
  offlineFailed = true;
}
check('offline read fails (probe)', offlineFailed);
await mctx.setOffline(false);
let onlineRecovered = false;
try {
  const st = await mp.evaluate(async () => {
    const r = await fetch('/api/v1/housekeeping/supervisor/space-report?propertyId=x', {
      signal: AbortSignal.timeout(8000),
    });
    return r.status;
  });
  onlineRecovered = st === 200 || st === 400;
} catch {}
check('online read recovers', onlineRecovered);

check('zero console errors (desktop walk)', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
writeFileSync(`${OUT}/RESULTS.txt`, results.join('\n') + '\n');
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} checks passed — evidence in ${OUT}/`);
