/* scripts/sh01-permission-evidence.mjs — v3: SH-01 permission-gated create menu.
 * Control: admin (all actions). Subject: staff (partial perms).
 * Spec assertion: each create action is visible IFF its perm is held.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '.vimad-evidence/sh01';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  console.log(results[results.length - 1]);
};

const SPEC = {
  'New Reservation': 'reservation:create',
  'Add Guest': 'guest:create',
  'Create Task': 'task:create',
  'Post Charge / Take Payment': 'folio:payment',
  'Walk-In Check-in': 'reservation:checkin',
};

const api = (path, token, opts = {}) =>
  fetch(`http://localhost:3001${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const login = async (email, password) => {
  const { json } = await api('/auth/login', null, { method: 'POST', body: { tenantSlug: 'demo-hotel', email, password } });
  return { token: json?.data?.token ?? json?.token, user: json?.data?.user ?? json?.user };
};
const permsOf = async (token) => {
  const { json } = await api('/auth/permissions', token);
  const p = Array.isArray(json) ? json : json?.data ?? json?.permissions ?? [];
  return Array.isArray(p) ? p : [];
};

const admin = await login('admin@demo.com', 'admin123');
check('admin login', !!admin.token);

const stamp = Date.now().toString(36);
const staffEmail = `st-${stamp}@example.com`;
const mk = await api('/v1/users', admin.token, {
  method: 'POST',
  body: { email: staffEmail, firstName: 'Evidence', lastName: 'Staff', password: 'st-evidence-1234', role: 'staff' },
});
const staffUser = mk.json?.data ?? mk.json;
check('staff user created', mk.status === 201 && !!staffUser?.id, `status ${mk.status}`);

const staff = await login(staffEmail, 'st-evidence-1234');
check('staff login', !!staff.token);

const adminPerms = await permsOf(admin.token);
const staffPerms = await permsOf(staff.token);
console.log('staff perms:', JSON.stringify(staffPerms));
check('admin holds all five create perms', Object.values(SPEC).every((p) => adminPerms.includes(p)));
check('staff permission set differs from admin', JSON.stringify(staffPerms) !== JSON.stringify(adminPerms));

let base = null;
for (const port of [5173, 3000]) {
  try { if ((await fetch(`http://localhost:${port}/app/tasks`)).ok) { base = `http://localhost:${port}`; break; } } catch {}
}
check('dev server', !!base, base ?? 'none');

const browser = await chromium.launch();
async function paletteRun(tag, token, user, perms) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([tok, usr, pm]) => {
      localStorage.setItem('vimad_access_token', tok);
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: usr, token: tok, refreshToken: null, isAuthenticated: true, permissions: pm }, version: 0 }));
    },
    [token, user, perms]
  );
  await page.goto(`${base}/app/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(600);
  let opened = await page.locator('input[placeholder*="Search guests"]').isVisible().catch(() => false);
  if (!opened) {
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(600);
    opened = await page.locator('input[placeholder*="Search guests"]').isVisible().catch(() => false);
  }
  console.log(`${tag} palette opened:`, opened);
  await page.screenshot({ path: `${OUT}/0${tag === 'admin' ? '1' : '2'}-palette-${tag}.png` });
  const counts = {};
  for (const label of Object.keys(SPEC)) counts[label] = await page.locator(`text=${label}`).count();
  await ctx.close();
  return { opened, counts };
}

const a = await paletteRun('admin', admin.token, admin.user, adminPerms);
check('admin palette opened', a.opened);
check('admin sees all five create actions', a.opened && Object.keys(SPEC).every((l) => a.counts[l] > 0), JSON.stringify(a.counts));

const h = await paletteRun('staff', staff.token, staff.user, staffPerms);
check('staff palette opened', h.opened);
let mirrorOk = true;
const detail = [];
for (const [label, perm] of Object.entries(SPEC)) {
  const expect = staffPerms.includes(perm) || staffPerms.includes('*');
  const actual = h.counts[label] > 0;
  if (expect !== actual) mirrorOk = false;
  detail.push(`${label}:${actual ? 'shown' : 'hidden'}(perm-${expect ? 'held' : 'denied'})`);
}
check('staff: palette mirrors permission set exactly', h.opened && mirrorOk, detail.join(' '));

await browser.close();
console.log(`(staff user left in demo tenant: ${staffEmail})`);
writeFileSync(`${OUT}/RESULTS.txt`, results.join('\n') + '\n');
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed — evidence in ${OUT}/`);
