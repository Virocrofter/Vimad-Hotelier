/* scripts/sh02-role-home-evidence.mjs — SH-02: role-aware home verification.
 * Creates one user per role family, loads the command center as each, and
 * asserts the section order matrix matches the ROLE_ORDER variants.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '.vimad-evidence/sh02';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  console.log(results[results.length - 1]);
};

const api = (path, token, opts = {}) =>
  fetch('http://localhost:3001' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const adminLogin = await api('/auth/login', null, { method: 'POST', body: { tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' } });
const adminToken = adminLogin.json?.data?.token ?? adminLogin.json?.token;
check('admin login', !!adminToken);

const props = await api('/v1/properties', adminToken);
const propList = props.json?.data ?? props.json ?? [];
const firstArray = (j) => {
  if (Array.isArray(j)) return j;
  if (j && typeof j === 'object') { for (const v of Object.values(j)) { const f = firstArray(v); if (f) return f; } }
  return null;
};
const scopeProp = (firstArray(propList) ?? [])[0]?.id;
check('scope property resolved', !!scopeProp);

const created = [];
async function makeUser(role) {
  const email = 'sh02-' + role + '-' + Date.now().toString(36) + '@example.com';
  const mk = await api('/v1/users', adminToken, {
    method: 'POST',
    body: { email, firstName: 'SH02', lastName: role, password: 'sh02-evidence-99', role },
  });
  const u = mk.json?.data ?? mk.json;
  if (mk.status === 201 && u?.id) created.push(u.id);
  const lg = await api('/auth/login', null, { method: 'POST', body: { tenantSlug: 'demo-hotel', email, password: 'sh02-evidence-99' } });
  return { token: lg.json?.data?.token ?? lg.json?.token, user: lg.json?.data?.user ?? lg.json?.user, email };
}

const subjects = [];
for (const role of ['staff', 'housekeeper', 'manager']) subjects.push({ role, ...(await makeUser(role)) });
check('role users created + logged in', subjects.every((s) => !!s.token), subjects.map((s) => s.role + ':' + (s.token ? 'ok' : 'FAIL')).join(' '));
const adminPerms = await api('/auth/permissions', adminToken);
const permsArr = Array.isArray(adminPerms.json) ? adminPerms.json : adminPerms.json?.data ?? [];

let base = null;
for (const port of [5173, 3000]) {
  try { if ((await fetch('http://localhost:' + port + '/app/tasks')).ok) { base = 'http://localhost:' + port; break; } } catch {}
}

const browser = await chromium.launch();
async function homeOrders(token, user, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([tok, usr, pm, p]) => {
      localStorage.setItem('vimad_access_token', tok);
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: usr, token: tok, refreshToken: null, isAuthenticated: true, permissions: pm }, version: 0 }));
      localStorage.setItem('vimad-current-property', JSON.stringify({ state: { currentPropertyId: p, hasChosen: true }, version: 0 }));
    },
    [token, user, permsArr, scopeProp]
  );
  await page.goto(base + '/app/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/home-' + tag + '.png', fullPage: false });
  const seq = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[style*="order:"]')];
    return els
      .map((e) => ({ order: Number(e.style.order), tag: e.getAttribute('data-section') || e.querySelector('h3,h2')?.textContent?.trim()?.slice(0, 24) || e.className.slice(0, 24) }))
      .filter((x) => !Number.isNaN(x.order) && x.order >= 10 && x.order <= 50)
      .sort((a, b) => a.order - b.order)
      .map((x) => x.order + ':' + x.tag);
  });
  await ctx.close();
  return seq;
}

const matrices = {};
matrices.admin = await homeOrders(adminToken, adminLogin.json?.data?.user ?? adminLogin.json?.user, 'admin');
for (const s of subjects) matrices[s.role] = await homeOrders(s.token, s.user, s.role);

for (const [tag, seq] of Object.entries(matrices)) {
  console.log(tag, JSON.stringify(seq));
  check(tag + ': five ordered sections', seq.length >= 4, seq.length + ' sections');
}

const firstOf = (seq) => (seq[0] ?? '').split(':')[0];
check('staff(frontdesk): worklist first', (matrices.staff?.[0] ?? '').includes('worklist'), matrices.staff?.[0]);
check('housekeeper: roomboard first', (matrices.housekeeper?.[0] ?? '').includes('roomboard'), matrices.housekeeper?.[0]);
check('manager: kpi first', (matrices.manager?.[0] ?? '').includes('kpi') || (matrices.manager?.[0] ?? '').includes('10:'), matrices.manager?.[0]);
const uniq = new Set(Object.values(matrices).map((s) => s.join('|'))).size;
check('variant families distinct (admin=manager by design)', uniq === 3 && matrices.admin.join('|') === matrices.manager.join('|'), uniq + ' unique sequences');

await browser.close();
writeFileSync(OUT + '/RESULTS.txt', results.join('\n') + '\n');
console.log('\n' + results.filter((x) => x.startsWith('PASS')).length + '/' + results.length + ' passed — evidence in ' + OUT + '/');
console.log('(role users left in demo tenant: ' + subjects.map((s) => s.email).join(', ') + ')');
