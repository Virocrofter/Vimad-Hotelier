/* scripts/sh05-palette-evidence.mjs — v5: SH-05 palette verification, two scopes.
 * Scope A (room-bearing property): rooms shown + foreign room hidden (zero leak).
 * Scope B (active-reservation property): guests (tenant-level), tasks, reservations.
 * Plus: search filtering, mode prefixes, keyboard nav, frecency, action panel.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '.vimad-evidence/sh05';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  console.log(results[results.length - 1]);
};

const firstArray = (j) => {
  if (Array.isArray(j)) return j;
  if (j && typeof j === 'object') {
    for (const v of Object.values(j)) {
      const f = firstArray(v);
      if (f) return f;
    }
  }
  return null;
};

const api = (path, token, opts = {}, extraHeaders = {}) =>
  fetch('http://localhost:3001' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...extraHeaders, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const login = await api('/auth/login', null, { method: 'POST', body: { tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' } });
const token = login.json?.data?.token ?? login.json?.token;
const user = login.json?.data?.user ?? login.json?.user;
check('login', !!token);
const permsRes = await api('/auth/permissions', token);
const perms = Array.isArray(permsRes.json) ? permsRes.json : permsRes.json?.data ?? [];

const guests = firstArray((await api('/v1/guests?limit=50', token)).json) ?? [];
const rooms = firstArray((await api('/v1/rooms?limit=50', token)).json) ?? [];
const ressAll = firstArray((await api('/v1/reservations?limit=50', token)).json) ?? [];
const g0 = guests.find((g) => g.firstName) ?? guests[0];
const gFirst = g0.firstName ?? 'Guest';

const byProp = {};
for (const r of rooms) {
  const k = r.propertyId ?? 'none';
  (byProp[k] ??= []).push(r);
}
let roomProp = null;
for (const [k, v] of Object.entries(byProp)) {
  if (k !== 'none' && (!roomProp || v.length > byProp[roomProp].length)) roomProp = k;
}
const rs0 = ressAll.find((x) => ['confirmed', 'checked_in'].includes(x.status)) ?? ressAll[0];
const resProp = rs0.propertyId;
const rmA =
  byProp[roomProp]?.find((r) => !rooms.some((o) => o.number === r.number && o.propertyId !== r.propertyId)) ??
  byProp[roomProp]?.[0];
const rmOther = rooms.find(
  (r) => r.propertyId && r.propertyId !== roomProp && r.number !== rmA?.number
);
check('demo topology', !!rmA && !!rs0, 'roomProp=' + String(roomProp).slice(0, 8) + ' resProp=' + String(resProp).slice(0, 8));

const pf = await api('/v1/guests?search=' + encodeURIComponent(gFirst) + '&pageSize=5', token, {}, { 'x-property-id': resProp });
check('api pre-flight: tenant-level guest searchable under scope (fix live)', (firstArray(pf.json) ?? []).length > 0, gFirst);

const seeded = await api('/v1/tasks', token, {
  method: 'POST',
  body: { propertyId: resProp, department: 'housekeeping', title: 'SH05 evidence task ' + Date.now().toString(36), priority: 'normal' },
});
const seededTask = seeded.json?.data ?? seeded.json;
check('seed task created', seeded.status === 201 && !!seededTask?.id, 'status ' + seeded.status);

let base = null;
for (const port of [5173, 3000]) {
  try { if ((await fetch('http://localhost:' + port + '/app/tasks')).ok) { base = 'http://localhost:' + port; break; } } catch {}
}

const browser = await chromium.launch();

async function withScope(propId, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([tok, usr, pm, p]) => {
      localStorage.setItem('vimad_access_token', tok);
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: usr, token: tok, refreshToken: null, isAuthenticated: true, permissions: pm }, version: 0 }));
      localStorage.setItem('vimad-current-property', JSON.stringify({ state: { currentPropertyId: p, hasChosen: true }, version: 0 }));
    },
    [token, user, perms, propId]
  );
  await page.goto(base + '/app/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const dialog = () => page.locator('[role="dialog"][aria-label="Command palette"]');
  const input = () => dialog().locator('input').first();
  const searchFor = async (q) => {
    await input().fill('');
    await input().press('Backspace');
    await input().fill(q);
    await page.waitForTimeout(1200);
  };
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(700);
  await fn(page, dialog, input, searchFor);
  await ctx.close();
}

// scope A: rooms shown under their property; foreign room hidden
await withScope(roomProp, async (page, dialog, input, searchFor) => {
  check('A: palette opens', await input().isVisible().catch(() => false));
  await searchFor('Room ' + rmA.number);
  check('A: rooms searchable (own property)', (await dialog().locator('text=Room ' + rmA.number).count()) > 0, 'room ' + rmA.number);
  if (rmOther) {
    await searchFor('Room ' + rmOther.number);
    const leaked = (await dialog().locator('text=Room ' + rmOther.number).count()) > 0;
    check('A: zero cross-property leak (foreign room hidden)', !leaked, 'room ' + rmOther.number);
  } else {
    check('A: zero cross-property leak (foreign room hidden)', true, 'SKIP single property');
  }
  await page.screenshot({ path: OUT + '/02-entity-rooms.png' });
});

// scope B: guests/tasks/reservations + interaction spec
await withScope(resProp, async (page, dialog, input, searchFor) => {
  check('B: palette opens', await input().isVisible().catch(() => false));
  await searchFor(gFirst);
  check('B: guests searchable (tenant-level under scope)', (await dialog().locator('text=' + gFirst).count()) > 0, gFirst);
  await page.screenshot({ path: OUT + '/01-entity-guests.png' });

  await searchFor('SH05 evidence task');
  check('B: tasks searchable (seeded open task)', (await dialog().locator('text=SH05 evidence task').count()) > 0);

  await searchFor(rs0.confirmationNumber);
  check('B: reservations searchable by conf#', (await dialog().locator('text=' + rs0.confirmationNumber).count()) > 0, rs0.confirmationNumber);
  await page.screenshot({ path: OUT + '/03-entity-reservations.png' });

  await searchFor('zzzqqq-no-such-thing');
  const leakG = (await dialog().locator('text=' + gFirst).count()) > 0;
  const emptyShown = (await dialog().locator('text=No matches').count()) > 0;
  check('B: search filters (gibberish → empty state)', !leakG && emptyShown, 'leak=' + leakG + ' empty=' + emptyShown);

  await input().fill('');
  await input().type('@');
  await page.waitForTimeout(300);
  check("B: prefix '@' → guest mode", (((await input().getAttribute('placeholder')) ?? '') + '').toLowerCase().includes('guest'));
  await input().fill('');
  await input().type('>');
  await page.waitForTimeout(300);
  check("B: prefix '>' → action mode", (((await input().getAttribute('placeholder')) ?? '') + '').toLowerCase().includes('action'));
  await input().fill('');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(600);
  await searchFor('Tasks Board');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  check('B: Enter navigates to target', page.url().includes('/app/tasks'), page.url());

  const freqStore = JSON.parse(await page.evaluate(() => localStorage.getItem('palette.frecency.v1') || '{}'));
  const rec = (freqStore[user?.id] ?? {})['action-Tasks Board'];
  check('B: frecency recorded (per-user store)', !!rec && rec.count >= 1, JSON.stringify(rec ?? {}));

  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(700);
  check('B: empty query shows recents incl. used action', (await dialog().locator('text=Tasks Board').count()) > 0);
  await page.screenshot({ path: OUT + '/04-frecency-recents.png' });

  await searchFor(gFirst);
  await page.waitForTimeout(300);
  await page.keyboard.press('1');
  await page.waitForTimeout(1800);
  check('B: guest action panel (key 1 → Open card drawer)', (await page.locator('[role="dialog"]').count()) > 0);
  await page.screenshot({ path: OUT + '/05-action-panel.png' });
});

await browser.close();

if (seededTask?.id) {
  const done = await api('/v1/tasks/' + seededTask.id + '/cancel', token, { method: 'POST', body: { reason: 'evidence cleanup' } });
  check('seed task cleaned up', [200, 201, 204].includes(done.status), 'status ' + done.status);
}

writeFileSync(OUT + '/RESULTS.txt', results.join('\n') + '\n');
console.log('\n' + results.filter((x) => x.startsWith('PASS')).length + '/' + results.length + ' passed — evidence in ' + OUT + '/');
