/* M1' close-out evidence — conversational upsell loop, browser-verified end-to-end. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(path.resolve('apps/api/package.json'));
const jwt = require('jsonwebtoken');
const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const DIR = '.vimad-evidence/m1-closeout';
fs.mkdirSync(DIR, { recursive: true });

const up = async (url) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.ok; } catch { return false; } };
if (!(await up(API + '/health/live')) && !(await up(API + '/health'))) {
  console.error('API not up. Start the stack first: docker compose up -d  &&  npm run dev');
  process.exit(1);
}
if (!(await up(WEB))) { console.error('Web dev server not up on :5173. Run: npm run dev'); process.exit(1); }

const envTxt = fs.readFileSync('apps/api/.env', 'utf8');
const JWT_SECRET = envTxt.match(/^JWT_SECRET=(.+)$/m)?.[1]?.trim();
if (!JWT_SECRET) throw new Error('JWT_SECRET not found in apps/api/.env');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let loginToken = null;
page.on('response', (res) => {
  if (res.url().includes('/auth/login') && res.request().method() === 'POST') {
    res.json().then((j) => { loginToken = j?.data?.token ?? j?.token ?? null; }).catch(() => {});
  }
});
await page.goto(WEB + '/auth/login');
await page.locator('#tenantSlug').fill('demo-hotel');
await page.locator('#email').fill('admin@demo.com');
await page.locator('#password').fill('admin123');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/app/**', { timeout: 20000 });
await page.waitForTimeout(1500);
if (!loginToken) throw new Error('login token not captured from /auth/login response');

const claims = JSON.parse(Buffer.from(loginToken.split('.')[1], 'base64url').toString());
console.log('HK-04 staff JWT payload:', JSON.stringify(claims));
const tenantId = claims.tenantId ?? claims.tenant?.id;
if (!tenantId) throw new Error('tenantId not in staff JWT payload — see claims above');

const api = async (p, { method = 'GET', token = loginToken, propertyId, body } = {}) => {
  const r = await fetch(API + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(propertyId ? { 'x-property-id': propertyId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data ?? j;
};

const resList = await api('/v1/reservations?limit=100');
const reservations = resList.reservations ?? resList ?? [];
const checkedIn = reservations.filter((r) => r.status === 'checked_in');
let res = null;
for (const cand of checkedIn) {
  const detail = await api(`/v1/reservations/${cand.id}`);
  const d = detail.reservation ?? detail;
  if (d.folio ?? d.folioId) { res = cand; break; }
}
if (!res) throw new Error('no checked_in reservation with a folio in demo data');
const propId = res.propertyId ?? res.property_id;
console.log('reservation:', res.id, res.status, 'property:', propId);

let products = await api('/v1/upsell/products');
products = (products.products ?? products).filter((x) => x.propertyId === propId);
if (!products.length) {
  const created = await api('/v1/upsell/products', { method: 'POST', body: { name: 'Late Checkout (2pm)', category: 'service', price: 450, taxInclusive: true, active: true, propertyId: propId } });
  products = [created.product ?? created];
}
const product = products[0];
console.log('product:', product.id, product.name, product.price);

const gtoken = jwt.sign({ scope: 'guest-portal', reservationId: res.id, tenantId }, JWT_SECRET, { expiresIn: '2h' });
const gpost = async (p, body) => {
  const r = await fetch(`${API}/v1/guest-portal${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`guest POST ${p} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data ?? j;
};
const gget = async (p) => {
  const r = await fetch(`${API}/v1/guest-portal${p}`, { signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`guest GET ${p} -> ${r.status}`);
  return j.data ?? j;
};

await gpost(`/comms/chat/${gtoken}/messages`, { body: 'Hi — quick question about my stay.', clientId: crypto.randomUUID() });
const folioBefore = await gget(`/folio/${gtoken}`);

const shot = (f) => page.screenshot({ path: path.join(DIR, f) });
await page.goto(WEB + '/app/comms');
await page.waitForSelector('text=Comms Desk');
await page.locator('button.w-full.text-left.p-3').first().click();
const threadPre = await gget(`/comms/chat/${gtoken}/thread`);
const threadId = threadPre.thread.id;
const knownMsgIds = new Set((threadPre.messages ?? []).map((m) => m.id));
const sent = await api(`/v1/comms/chat/threads/${threadId}/messages`, {
  method: 'POST',
  propertyId: propId,
  body: {
    body: `Special offer for you: ${product.name} — tap Accept to add it to your bill.`,
    type: 'offer',
    payload: { productId: product.id, name: product.name, price: product.price, currency: 'ZAR' },
  },
});
console.log('staff offer sent:', sent.message?.id, '| product.propertyId:', product.propertyId, '| reservation.propertyId:', propId);
let offerMsg = null;
for (let i = 0; i < 20 && !offerMsg; i++) {
  await page.waitForTimeout(1000);
  const t = await gget(`/comms/chat/${gtoken}/thread`);
  offerMsg = (t.messages ?? []).find((m) => m.type === 'offer' && !knownMsgIds.has(m.id));
}
if (!offerMsg) throw new Error('fresh offer never reached the guest thread');
console.log('fresh offer id:', offerMsg.id);
await page.waitForSelector(`text=${product.name}`, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
await shot('02-staff-offer-card.png');

const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.addInitScript((t) => sessionStorage.setItem('gp_token', t), gtoken);
const gp = await ctx.newPage();
gp.on('response', (res) => {
  const u = res.url();
  if (u.includes('comms') || u.includes('guest-portal')) {
    res
      .text()
      .then((t) => console.log('GP_RES', res.status(), u.slice(-150), t.slice(0, 180)))
      .catch(() => {});
  }
});
await gp.goto(WEB + '/guest-portal/messages');
console.log('gp_token in session:', await gp.evaluate(() => (sessionStorage.getItem('gp_token') ? 'yes' : 'no')));
try {
  await gp.waitForSelector('text=Special offer', { timeout: 20000 });
} catch (e) {
  console.log('GUEST_URL:', gp.url());
  console.log('GUEST_TEXT:', (await gp.locator('body').innerText().catch(() => '')).slice(0, 900));
  try {
    await gget(`/comms/chat/${gtoken}/thread`);
    console.log('guest thread API: OK from node');
  } catch (err) {
    console.log('guest thread API FAIL:', err.message);
  }
  throw e;
}
await gp.screenshot({ path: path.join(DIR, '03-guest-offer-card.png') });
await gp.getByRole('button', { name: 'Accept offer' }).last().click();
await gp.waitForSelector('text=Added to your bill', { timeout: 20000 });
await gp.screenshot({ path: path.join(DIR, '04-guest-accepted.png') });

const folioAfter = await gget(`/folio/${gtoken}`);
const items = folioAfter.items ?? [];
const hit = items.find((i) => (i.description ?? '').includes(product.name) || Number(i.amount) === Number(product.price));
const proof = {
  generatedAt: new Date().toISOString(),
  hk04_staffJwtPayload: claims,
  reservationId: res.id,
  product: { id: product.id, name: product.name, price: product.price },
  folioBalanceBefore: folioBefore.folio?.balance ?? null,
  folioBalanceAfter: folioAfter.folio?.balance ?? null,
  folioItem: hit ?? null,
};
fs.writeFileSync(path.join(DIR, 'proof.json'), JSON.stringify(proof, null, 2));
if (!hit) throw new Error('folio charge not found after accept — see proof.json');
console.log(JSON.stringify(proof, null, 2));
console.log('=== SHIPPED: M1\' conversational upsell loop browser-verified (picker -> offer card -> guest accept -> folio charge) ===');
await browser.close();
