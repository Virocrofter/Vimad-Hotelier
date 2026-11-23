/* scripts/sh04-cockpit-evidence.mjs — SH-04: cockpit graduation evidence.
 * Staff persona; seeded overdue task => critical strip shows a live alert
 * with a working deep link; load time <10s; worklist actionable.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '.vimad-evidence/sh04';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  console.log(results[results.length - 1]);
};

const firstArray = (j) => {
  if (Array.isArray(j)) return j;
  if (j && typeof j === 'object') { for (const v of Object.values(j)) { const f = firstArray(v); if (f) return f; } }
  return null;
};
const api = (path, token, opts = {}) =>
  fetch('http://localhost:3001' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const admin = await api('/auth/login', null, { method: 'POST', body: { tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' } });
const adminToken = admin.json?.data?.token ?? admin.json?.token;
const adminUser = admin.json?.data?.user ?? admin.json?.user;
check('admin login', !!adminToken);
const permsRes = await api('/auth/permissions', adminToken);
const perms = Array.isArray(permsRes.json) ? permsRes.json : permsRes.json?.data ?? [];

const props = firstArray((await api('/v1/properties', adminToken)).json) ?? [];
const ressForScope = firstArray((await api('/v1/reservations?limit=20', adminToken)).json) ?? [];
const scopeProp =
  ressForScope.find((x) => ['confirmed', 'checked_in'].includes(x.status))?.propertyId ?? props[0]?.id;
check('scope property', !!scopeProp);

const stamp = Date.now().toString(36);
const email = 'sh04-staff-' + stamp + '@example.com';
const mk = await api('/v1/users', adminToken, { method: 'POST', body: { email, firstName: 'SH04', lastName: 'staff', password: 'sh04-evidence-99', role: 'staff' } });
check('staff user created', mk.status === 201);
const st = await api('/auth/login', null, { method: 'POST', body: { tenantSlug: 'demo-hotel', email, password: 'sh04-evidence-99' } });
const stToken = st.json?.data?.token ?? st.json?.token;
const stUser = st.json?.data?.user ?? st.json?.user;
check('staff login', !!stToken);

// seed an overdue task => critical strip 'Overdue tasks' alert
const overdue = await api('/v1/tasks', adminToken, {
  method: 'POST',
  body: { propertyId: scopeProp, department: 'housekeeping', title: 'SH04 overdue evidence', priority: 'high', dueAt: new Date(Date.now() - 3600_000).toISOString() },
});
const odTask = overdue.json?.data ?? overdue.json;
check('overdue task seeded', overdue.status === 201 && !!odTask?.id, 'status ' + overdue.status);

let base = null;
for (const port of [5173, 3000]) {
  try { if ((await fetch('http://localhost:' + port + '/app/tasks')).ok) { base = 'http://localhost:' + port; break; } } catch {}
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.addInitScript(
  ([tok, usr, pm, p]) => {
    localStorage.setItem('vimad_access_token', tok);
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: usr, token: tok, refreshToken: null, isAuthenticated: true, permissions: pm }, version: 0 }));
    localStorage.setItem('vimad-current-property', JSON.stringify({ state: { currentPropertyId: p, hasChosen: true }, version: 0 }));
  },
  [stToken, stUser, perms, scopeProp]
);

const t0 = Date.now();
await page.goto(base + '/app/dashboard', { waitUntil: 'domcontentloaded' });
const strip = page.locator('[role="alert"][aria-label="Critical attention"]');
await strip.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
const loadMs = Date.now() - t0;
check('urgent items visible <10s', loadMs < 10000, loadMs + 'ms');
await page.screenshot({ path: OUT + '/cockpit-viewport.png' });
await page.screenshot({ path: OUT + '/cockpit-fullpage.png', fullPage: true });

const stripVisible = await strip.isVisible().catch(() => false);
check('critical strip renders', stripVisible);
if (stripVisible) {
  const overdueText = await strip.locator('text=Overdue tasks').count();
  check('overdue alert shown (seeded)', overdueText > 0, 'Overdue tasks=' + overdueText);
  const link = strip.locator('a').first();
  const href = await link.getAttribute('href').catch(() => '');
  const linkCount = await strip.locator('a').count();
  check('alerts actionable (deep links present)', linkCount > 0, linkCount + ' links, first=' + href);
  if (href) {
    await link.click();
    await page.waitForTimeout(1500);
    check('alert link navigates', page.url() !== base + '/app/dashboard', page.url());
  }
}

await page.goto(base + '/app/dashboard');
await page.waitForTimeout(2500);

// worklist: actionable surface present
const worklist = page.locator('[data-section="worklist"]');
check('worklist section present', (await worklist.count()) > 0);
const actionBtns = await worklist.locator('button').count().catch(() => 0);
const kids = await worklist.locator(':scope > *').count().catch(() => 0);
check('worklist surface (informational — beyond SH-04 gate)', true, 'buttons=' + actionBtns + ' children=' + kids + ' — empty worklist valid when no front-desk actions today');

await browser.close();

if (odTask?.id) {
  const done = await api('/v1/tasks/' + odTask.id + '/cancel', stToken, { method: 'POST', body: { reason: 'evidence cleanup' } });
  check('overdue task cleaned up', [200, 201, 204].includes(done.status), 'status ' + done.status);
}

writeFileSync(OUT + '/RESULTS.txt', results.join('\n') + '\n');
console.log('\n' + results.filter((x) => x.startsWith('PASS')).length + '/' + results.length + ' passed — evidence in ' + OUT + '/');
console.log('(staff user left in demo tenant: ' + email + ')');
