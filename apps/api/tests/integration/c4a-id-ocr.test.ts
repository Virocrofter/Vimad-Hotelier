/* C4′a — Digital-ID OCR: the scan fills the guest's ID fields; POPIA
 * retention erases expired scans.
 * S1: a rendered ID image (Playwright fixture) is scanned — the 13-digit
 *     number fills passportNumber; YYMMDD derives dateOfBirth; the scan row
 *     records extraction + retention expiry.
 * S2: a scan past its expiry is erased by the retention sweep.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const ID_NUMBER = '8001015009087'; // YYMMDD 800101 -> 1980-01-01

async function renderIdImage(): Promise<Buffer> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 980, height: 560 } });
  await page.setContent(
    `<body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;">
       <div style="font-family:monospace;font-size:64px;letter-spacing:6px;color:#000;text-align:center;">
         <div>IDENTITY DOCUMENT</div>
         <div style="font-size:72px;margin-top:18px;">${ID_NUMBER}</div>
           <div style="font-size:44px;margin-top:14px;letter-spacing:1px;">P&lt;ZAFTEST&lt;&lt;C4A&lt;OCR&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
           <div style="font-size:44px;letter-spacing:1px;">L898902C&lt;3ZAF6908061F2606223ZE184226B&lt;&lt;&lt;&lt;&lt;&lt;&lt;14</div>
           <div style="font-size:32px;margin-top:14px;">DATE OF BIRTH 06 AUG 1969</div>
       </div>
     </body>`
  );
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return buf;
}

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'C4', lastName: 'Ocr', email: `c4-${runId}@example.com` },
  });
  ctx.t = t;
  ctx.guest = g;
  ctx.imageBase64 = (await renderIdImage()).toString('base64');
  console.log('C4′a seeded, fixture rendered');
}, 120_000);

describe('C4′a digital-ID OCR', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  it('S1: scan fills passportNumber + dateOfBirth; extraction recorded with retention expiry', async () => {
    const r = await request(app)
      .post('/v1/guest-identity/scans')
      .set(H())
      .send({ guestId: ctx.guest.id, imageBase64: ctx.imageBase64, retentionDays: 30 });
    expect(r.status).toBe(200);
    expect(r.body.data.idNumber).toBe(ID_NUMBER);
    expect(r.body.data.dateOfBirth).toBe('1969-08-06'); /* MRZ-stated, not number-derived */
    expect(r.body.data.status).toBe('processed');

    const guest = await prisma.guest.findFirst({ where: { id: ctx.guest.id } });
    expect(guest.passportNumber).toBe(ID_NUMBER);
    expect(guest.dateOfBirth?.toISOString().slice(0, 10)).toBe(
      '1969-08-06'
    ); /* MRZ-stated, not number-derived */

    const list = await request(app)
      .get('/v1/guest-identity/scans?guestId=' + ctx.guest.id)
      .set(H());
    expect(list.status).toBe(200);
    const row = list.body.data[0];
    expect(row.status).toBe('processed');
    expect(row.extracted.idNumber).toBe(ID_NUMBER);
    expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now());
    console.log('C4′a S1 OK — OCR filled the ID fields');
  }, 120_000);

  it('S2: retention sweep erases expired scans (POPIA)', async () => {
    await prisma.guestIdScan.create({
      data: {
        tenantId: ctx.t,
        guestId: ctx.guest.id,
        key: 'id-scans/expired/fixture.png',
        status: 'processed',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const sweep = await request(app).post('/v1/guest-identity/scans/sweep').set(H());
    expect(sweep.status).toBe(200);
    expect(sweep.body.data.deleted).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.guestIdScan.findMany({
      where: { guestId: ctx.guest.id, key: 'id-scans/expired/fixture.png' },
    });
    expect(remaining.length).toBe(0);
    console.log('C4′a S2 OK — expired scan erased');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
