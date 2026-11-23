/* sh06 — split-bill workspace evidence: groups billing page renders bills
 * as cards with the sticky totals bar. Admin walk; screenshots. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '.vimad-evidence/sh06';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, d = '') => {
  results.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
  console.log(results[results.length - 1]);
};
const firstArray = (j) => {
  if (Array.isArray(j)) return j;
  if (j && typeof j === 'object') { for (const v of Object.values(j)) { const f = firstArray(v); if (f) return f; } }
  return null;
};

const login = await fetch('http://localhost:3001/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' }) }).then((r) => r.json());
const token = login?.data?.token ?? login?.token;
const user = login?.data?.user ?? login?.user;
check('login', !!token);
const groups = firstArray(await fetch('http://localhost:3001/v1/groups', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json()).catch(() => ({}))) ?? [];
check('demo group present', groups.length > 0, groups.length + ' groups');
const gid = groups[0]?.id;
if (!gid) { writeFileSync(OUT + '/RESULTS.txt', results.join('\n') + '\n'); process.exit(0); }

const perms = await fetch('http://localhost:3001/auth/permissions', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json()).then((j) => (Array.isArray(j) ? j : j?.data ?? []));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await page.addInitScript(([t, u, p]) => {
  localStorage.setItem('vimad_access_token', t);
  localStorage.setItem('auth-storage', JSON.stringify({ state: { user: u, token: t, refreshToken: null, isAuthenticated: true, permissions: p }, version: 0 }));
}, [token, user, perms]);
await page.goto('http://localhost:5173/app/groups/' + gid + '/billing', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const bar = await page.locator('text=Group total').count();
check('sticky totals bar renders', bar > 0, 'Group total=' + bar);
const cards = await page.locator('text=Move to…').count();
check('bills render as cards with per-item move', cards > 0, cards + ' move selects');
await page.screenshot({ path: OUT + '/split-bill-workspace.png', fullPage: true });
await browser.close();
writeFileSync(OUT + '/RESULTS.txt', results.join('\n') + '\n');
console.log('\n' + results.filter((x) => x.startsWith('PASS')).length + '/' + results.length + ' passed — evidence in ' + OUT + '/');
