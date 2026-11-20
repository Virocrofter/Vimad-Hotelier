import { chromium } from 'playwright';
const WEB = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(WEB + '/auth/login');
await page.locator('#tenantSlug').fill('demo-hotel');
await page.locator('#email').fill('admin@demo.com');
await page.locator('#password').fill('admin123');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/app/**', { timeout: 20000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: '.vimad-evidence/sh0204/01-dashboard-graduated.png', fullPage: false });
const checks = {
  worklist: await page.locator('text=Priority Worklist').count(),
  attention: await page.locator('[aria-label="Items needing attention"]').count(),
};
console.log('dashboard checks:', JSON.stringify(checks));
console.log('=== SHIPPED: SH-02 + SH-04 spot-check ===');
await browser.close();
