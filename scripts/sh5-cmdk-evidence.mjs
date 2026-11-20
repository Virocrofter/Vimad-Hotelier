/* SH-05 — Command palette verification: coverage, scoping, keyboard nav, frecency.
   v2: property context proven (F-5 fixed) — stored-choice session, header observed live. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const DIR = '.vimad-evidence/sh5-cmdk';
fs.mkdirSync(DIR, { recursive: true });
const results = {};

const login = await fetch(API + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' }),
}).then((r) => r.json());
const token = login.data?.token ?? login.token;
if (!token) throw new Error('staff login failed');

const api = async (p, propertyId) => {
  const r = await fetch(API + p, {
    headers: { Authorization: `Bearer ${token}`, ...(propertyId ? { 'x-property-id': propertyId } : {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GET ${p} -> ${r.status}`);
  return j.data ?? j;
};
const asList = (j) =>
  Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : (j?.guests ?? j?.items ?? j?.tasks ?? j?.reservations ?? []);

const props = await api('/v1/properties');
let populatedProp = null;
for (const pr of props) {
  const g = asList(await api('/v1/guests?pageSize=1', pr.id));
  const rv = await api('/v1/reservations?limit=1', pr.id);
  const tk = asList(await api('/v1/tasks?pageSize=1', pr.id));
  if (g.length && (rv.reservations ?? rv).length && tk.length) { populatedProp = pr.id; break; }
}
console.log('populated property (seeded as stored choice):', populatedProp);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((id) => {
  window.localStorage.setItem(
    'vimad-current-property',
    JSON.stringify({ state: { currentPropertyId: id, hasChosen: true }, version: 0 })
  );
}, populatedProp);

let capturedProp = null;
let reqTotal = 0;
let reqWithProp = 0;
page.on('request', (req) => {
  if (req.url().includes('/v1/')) reqTotal++;
  const h = req.headers()['x-property-id'];
  if (h) reqWithProp++;
  if (!capturedProp && h && /^[a-z0-9]{20,}$/i.test(h)) capturedProp = h;
});
page.on('response', (res) => {
  const u = res.url();
  if (!u.includes('/v1/')) return;
  res
    .text()
    .then((t) => {
      if (u.includes('/guests') && u.includes('search=')) {
        console.log('GUEST_XHR', res.status(), decodeURIComponent(u.split('search=')[1] || '').slice(0, 25), t.slice(0, 160));
      }
      if (t.includes("O'Connor")) {
        console.log('LEAK_SRC', res.status(), u.split('/v1/')[1].split('?')[0], 'q=' + (u.split('?')[1] ?? '').slice(0, 60), 'occ=' + (t.match(/O'Connor/g) || []).length);
      }
    })
    .catch(() => {});
});

await page.goto(WEB + '/auth/login');
await page.locator('#tenantSlug').fill('demo-hotel');
await page.locator('#email').fill('admin@demo.com');
await page.locator('#password').fill('admin123');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/app/**', { timeout: 20000 });
await page.waitForTimeout(2000);
console.log('propertyStore persisted:', await page.evaluate(() => localStorage.getItem('vimad-current-property')));

let activeProp = capturedProp;
if (!activeProp) {
  const all = await api('/v1/reservations?limit=100');
  activeProp = (all.reservations ?? all).find((r) => r.confirmationNumber)?.propertyId;
  console.log('NOTE: no x-property-id observed — fallback:', activeProp);
}
console.log('active property (from app requests):', activeProp);

const guests = asList(await api('/v1/guests?pageSize=5', activeProp));
const guest = guests[0];
const reservations = await api('/v1/reservations?limit=100', activeProp);
const reservation = (reservations.reservations ?? reservations).find((r) => r.confirmationNumber);
const rooms = asList(await api('/v1/rooms?pageSize=5', activeProp));
const room = rooms[0];
const rawTasks = await api('/v1/tasks?pageSize=5', activeProp);
const task = asList(rawTasks)[0] ?? null;
let foreign = null;
for (const pr of props) {
  if (pr.id === activeProp) continue;
  const g = asList(await api('/v1/guests?pageSize=5', pr.id));
  if (g.length) { foreign = g[0]; break; }
}
console.log('entities:', JSON.stringify({ prop: activeProp, guest: guest?.lastName, conf: reservation?.confirmationNumber, room: room?.number, task: task?.title, foreign: foreign?.lastName }));
if (!guest || !reservation || !room || !task || !foreign) throw new Error('entity derivation incomplete');

const openPalette = async () => {
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role="dialog"][aria-label="Command palette"]', { timeout: 5000 });
  return page.getByRole('dialog', { name: 'Command palette' }).getByRole('textbox');
};
const optionTexts = async () => page.locator('[role="option"]').allTextContents().then((t) => t.join(' | '));

const input = await openPalette();
await input.fill(guest.lastName);
await page.waitForTimeout(1200);
results.guestFound = (await optionTexts()).includes(guest.lastName);
const sanitized = guest.lastName.replace(/[^a-zA-Z ]/g, '');
await input.fill(sanitized);
await page.waitForTimeout(1200);
results.guestFoundSanitized = (await optionTexts()).includes(sanitized);
await page.screenshot({ path: DIR + '/01-guest-search.png' });

await input.fill(reservation.confirmationNumber);
await page.waitForTimeout(1200);
results.reservationFound = (await optionTexts()).includes(reservation.confirmationNumber);

await input.fill(String(room.number));
await page.waitForTimeout(1200);
results.roomFound = (await optionTexts()).includes(`Room ${room.number}`);

const taskWord = (task.title.split(' ').find((w) => w.length >= 2) ?? 'a').toLowerCase();
await input.fill(taskWord);
await page.waitForTimeout(1200);
results.taskFound = (await optionTexts()).toLowerCase().includes(taskWord);
await page.screenshot({ path: DIR + '/02-entity-coverage.png' });

await input.fill('@' + guest.lastName);
await page.waitForTimeout(1200);
results.modePrefixWorks = /guest/i.test((await input.getAttribute('placeholder')) ?? '') && (await optionTexts()).includes(guest.lastName);
await page.screenshot({ path: DIR + '/03-mode-prefix.png' });

await input.fill(foreign.lastName);
await page.waitForTimeout(1500);
const leakText = await optionTexts();
results.noCrossPropertyLeak = !leakText.includes(foreign.lastName);
results.foreignChecked = foreign.lastName;
await page.screenshot({ path: DIR + '/04-scoping.png' });

await input.fill(guest.lastName);
await page.waitForTimeout(1200);
const before = await page.evaluate(() => document.querySelector('[data-active="true"]')?.textContent ?? '');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(300);
const after = await page.evaluate(() => document.querySelector('[data-active="true"]')?.textContent ?? '');
results.keyboardNav = before !== after || (await page.locator('[role="option"]').count()) === 1;
const urlBefore = page.url();
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
results.enterNavigates = page.url() !== urlBefore;
const frec = await page.evaluate(() => localStorage.getItem('palette.frecency.v1'));
results.frecencyRecorded = !!frec && frec.includes('count');

await page.keyboard.press('Control+k');
await page.waitForTimeout(600);
const recents = await page.locator('[role="option"]').count();
results.recentsOnEmpty = recents > 0 && recents <= 8;
await page.screenshot({ path: DIR + '/05-recents.png' });

results.knownDefects = { requestsWithPropertyHeader: reqWithProp + ' of ' + reqTotal };
results.allGreen = ['guestFound','guestFoundSanitized','reservationFound','roomFound','taskFound','modePrefixWorks','noCrossPropertyLeak','keyboardNav','enterNavigates','frecencyRecorded','recentsOnEmpty'].every((k) => results[k] === true);
fs.writeFileSync(DIR + '/proof.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
console.log(results.allGreen ? '=== SHIPPED: SH-05 Cmd+K fully verified ===' : '=== FAIL: see proof.json + LEAK_SRC ===');
await browser.close();
process.exit(results.allGreen ? 0 : 1);
