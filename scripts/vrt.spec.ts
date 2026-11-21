/* DS-06 VRT — one toHaveScreenshot per state-matrix harness cell.
 * Baselines: ../.vimad-vrt (COMMITTED). --update-snapshots changes are
 * review-gated by the normal commit diff — treat baseline diffs like code.
 * Run: npx playwright test -c scripts/playwright.vrt.config.ts
 * Docker (CI parity): npm run vrt:docker — see Dockerfile.vrt. */
import { test, expect } from '@playwright/test';

const BASE = process.env.VRT_BASE_URL ?? 'http://localhost:5173';
const TARGETS = ['button-grid', 'status-chips', 'surface-ladder', 'form-primitives', 'typography'];

test.beforeEach(async ({ page }) => {
  await page.goto(BASE + '/auth/login');
  await page.locator('#tenantSlug').fill('demo-hotel');
  await page.locator('#email').fill('admin@demo.com');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/app/**', { timeout: 20000 });
});

for (const target of TARGETS) {
  test(`vrt: ${target}`, async ({ page }) => {
    await page.goto(BASE + '/app/dev-vrt');
    await page.waitForSelector(`[data-vrt="${target}"]`);
    const el = page.locator(`[data-vrt="${target}"]`);
    await expect(el).toHaveScreenshot(`${target}.png`, { maxDiffPixelRatio: 0.01 });
  });
}
