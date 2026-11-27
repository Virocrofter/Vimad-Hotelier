#!/usr/bin/env node
/* scripts/generate-marketing-assets.mjs — one-shot generator (Phase 0+ items 5,6)
 * Produces: apps/web/public/og/vimad-default.png (1200×630, WhatsApp/link preview)
 *           apps/web/public/assets/vimad-leave-behind.pdf (A4 sales 1-pager)
 * Uses system Chrome via playwright; no network, no external fonts.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = `${ROOT}apps/web/public`;
mkdirSync(`${PUB}/og`, { recursive: true });
mkdirSync(`${PUB}/assets`, { recursive: true });

const FONT = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:#2B211B; color:#FAF6F0;
         font-family:${FONT}; padding:72px; display:flex; flex-direction:column; justify-content:space-between; }
  .mark { display:flex; align-items:center; gap:16px; }
  .logo { width:56px; height:56px; border-radius:14px; background:#E4572E; color:#FAF6F0;
          display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:800; }
  .brand { font-size:28px; font-weight:700; letter-spacing:0.02em; }
  h1 { font-size:76px; line-height:1.05; font-weight:800; letter-spacing:-0.02em; margin-top:40px; }
  h1 em { color:#E4572E; font-style:normal; }
  .sub { font-size:30px; color:#C9BBA8; margin-top:24px; }
  .foot { display:flex; justify-content:space-between; align-items:flex-end; font-size:22px; color:#A5978B; }
  .tags { display:flex; gap:12px; }
  .tag { border:1px solid #4A3C32; border-radius:999px; padding:8px 20px; color:#C9BBA8; }
</style></head><body>
  <div>
    <div class="mark"><div class="logo">V</div><div class="brand">VIMAD</div></div>
    <h1>One hotel. One system.<br><em>No leaks.</em></h1>
    <div class="sub">The hotel operating system · Durban, South Africa</div>
  </div>
  <div class="foot">
    <div class="tags"><span class="tag">Compass</span><span class="tag">Command</span><span class="tag">Constellation</span><span class="tag">Armada</span></div>
    <div>vimad.io</div>
  </div>
</body></html>`;

const lbHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:${FONT}; color:#2B211B; padding:48px 56px; font-size:12.5px; line-height:1.45; }
  .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #E4572E; padding-bottom:14px; }
  .mark { display:flex; align-items:center; gap:10px; }
  .logo { width:36px; height:36px; border-radius:9px; background:#E4572E; color:#FAF6F0; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:19px; }
  .spine { font-size:21px; font-weight:800; letter-spacing:-0.01em; margin:18px 0 4px; }
  .sub { color:#6B5D50; margin-bottom:16px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0; }
  .box { border:1px solid #E7DFD3; border-radius:10px; padding:12px 14px; }
  .box h3 { font-size:13px; margin-bottom:6px; color:#E4572E; text-transform:uppercase; letter-spacing:0.06em; }
  .box ul { list-style:none; } .box li { padding:1.5px 0 1.5px 14px; position:relative; }
  .box li::before { content:"✓"; position:absolute; left:0; color:#1F7A78; font-weight:700; }
  .tiers { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:14px 0; }
  .tier { border:1px solid #E7DFD3; border-radius:10px; padding:10px; }
  .tier b { font-size:12.5px; } .tier small { color:#6B5D50; display:block; margin:3px 0 6px; }
  .tier ul { list-style:none; font-size:11px; } .tier li { padding:1px 0 1px 11px; position:relative; }
  .tier li::before { content:"·"; position:absolute; left:0; color:#C9A227; font-weight:700; }
  .risk { background:#2B211B; color:#FAF6F0; border-radius:10px; padding:13px 16px; margin:14px 0; }
  .risk b { color:#E4572E; }
  .foot { display:flex; justify-content:space-between; border-top:1px solid #E7DFD3; margin-top:14px; padding-top:10px; color:#6B5D50; font-size:11px; }
  .cta { font-size:13px; font-weight:700; }
</style></head><body>
  <div class="head">
    <div class="mark"><div class="logo">V</div><div><b style="font-size:15px">VIMAD</b><br><span style="color:#6B5D50;font-size:11px">Hotel operating system · Durban</span></div></div>
    <div style="text-align:right;font-size:11px;color:#6B5D50">efeohise@gmail.com<br>+27 65 074 8802 (phone/WhatsApp)</div>
  </div>

  <div class="spine">One hotel. One system. No leaks.</div>
  <div class="sub">Every rand, every room, every guest — running on one truth, priced in rand, supported by the founder.</div>

  <div class="grid">
    <div class="box"><h3>The OTA math</h3><ul>
      <li>Two direct bookings a month ≈ the monthly fee. The other thirty shouldn't pay for someone's yacht.</li>
      <li>Direct booking widget at 0% commission, Paystack deposit included.</li>
      <li>Conversational pre-arrival upsells — verified R145→R495 per stay.</li>
    </ul></div>
    <div class="box"><h3>Built for South Africa</h3><ul>
      <li>TOMSA 1% levy auto-calculated, remittance-ready.</li>
      <li>EFT proof-of-payment matched to the folio automatically.</li>
      <li>Load-shedding shift pack + offline-tolerant front desk.</li>
      <li>POPIA out of the box; SARS-ready books, Xero/Sage CSV.</li>
    </ul></div>
  </div>

  <div class="tiers">
    <div class="tier"><b>Compass</b><small>6–20 rooms</small><ul><li>Front desk + tape chart</li><li>Housekeeping board</li><li>Direct bookings</li><li>Paystack + EFT POP</li><li>TOMSA + SARS export</li></ul></div>
    <div class="tier"><b>Command</b><small>20–80 rooms</small><ul><li>Everything in Compass</li><li>Channel sync (pilot)</li><li>Rate guardrails</li><li>Folio split + City Ledger</li><li>Guest portal upsells</li></ul></div>
    <div class="tier"><b>Constellation</b><small>80+ rooms</small><ul><li>Everything in Command</li><li>Needs Attention queue</li><li>BI roll-ups</li><li>Advanced automations</li><li>Audited rate overrides</li></ul></div>
    <div class="tier"><b>Armada</b><small>2+ properties</small><ul><li>Everything in Constellation</li><li>Multi-property switcher</li><li>Shared guest profiles</li><li>Central reservations</li><li>Chain billing + loyalty</li></ul></div>
  </div>

  <div class="risk"><b>Switch without the risk:</b> we move you on a Tuesday afternoon, you run parallel for 30 days, and if Vimad doesn't win we move you back — free. Your guests' money lands in your own Paystack account; we never touch it. Export everything, any time.</div>

  <div class="foot">
    <div class="cta">Book the walk-in demo: +27 65 074 8802 · efeohise@gmail.com</div>
    <div>VIMAD (Pty) Ltd · CIPC Reg 2026/949106/07</div>
  </div>
</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
  await page.setContent(ogHtml, { waitUntil: 'load' });
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.screenshot({
    path: `${PUB}/og/vimad-default.png`,
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  console.log('og: apps/web/public/og/vimad-default.png (1200x630)');

  await page.setContent(lbHtml, { waitUntil: 'load' });
  await page.pdf({
    path: `${PUB}/assets/vimad-leave-behind.pdf`,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  console.log('pdf: apps/web/public/assets/vimad-leave-behind.pdf (A4)');
} finally {
  await browser.close();
}
