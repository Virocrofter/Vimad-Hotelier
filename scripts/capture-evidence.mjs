import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = '.vimad-evidence';
fs.mkdirSync(OUT, { recursive: true });

const widths = [1440, 1024, 390];
const themes = ['light', 'dark'];

const browser = await chromium.launch({ channel: 'chrome' });
const report = [];

for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => {
    for (const k of ['vimad-theme', 'theme', 'hq-theme', 'app-theme']) {
      try { localStorage.setItem(k, t); } catch {}
    }
  }, theme);

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const email = page.locator('input[type="email"]').first();
  const passw = page.locator('input[type="password"]').first();
  if ((await email.count()) && (await passw.count())) {
    const slugInput = page.locator('input').first();
    if (await slugInput.count()) await slugInput.fill('demo-hotel');
    await email.fill('admin@vimad.test');
    await passw.fill('admin123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/app/, { timeout: 15000 }).catch(() => {});
  }
  await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const rendered = await page.evaluate(() => document.querySelectorAll('a,button,input,select,[role]').length);
  if (!rendered) { console.log('BLANK PAGE — aborting ' + theme); process.exit(1); }
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log(theme + ' body bg: ' + bodyBg + (theme === 'dark' && bodyBg.includes('244, 247, 248') ? '  <-- NOT SWITCHING' : ''));

  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/hq0-${theme}-${w}.png` });
    console.log(`shot: hq0-${theme}-${w}.png`);
  }

  const kb = await page.evaluate(() => {
    const sels = 'a[href],button:not([disabled]),input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';
    return document.querySelectorAll(sels).length;
  });
  report.push(`${theme}: ${kb} focusable stops`);

  const contrast = await page.evaluate(() => {
    const lum = (c) => {
      const m = String(c).match(/[\d.]+/g);
      if (!m || m.length < 3) return null;
      const ch = m.slice(0, 3).map((x) => {
        const v = parseFloat(x) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const bg = getComputedStyle(document.body).backgroundColor;
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const l1 = lum(getComputedStyle(el).color);
      const l2 = lum(bg);
      if (l1 == null || l2 == null) return null;
      const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
      return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    };
    return {
      body: probe('.hq-text-body') ?? probe('p'),
      muted: probe('[class*="text-muted"]'),
      revenue: probe('.hq-revenue'),
      surface: bg,
    };
  });
  report.push(`${theme} contrast ${JSON.stringify(contrast)} (need >=4.5 body, >=3 large/revenue)`);
  await ctx.close();
}
await browser.close();
console.log('--- keyboard + contrast ---');
console.log(report.join('\n'));
