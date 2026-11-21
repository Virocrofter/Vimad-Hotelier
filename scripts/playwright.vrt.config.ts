/* DS-06 VRT runner config — isolated from any app-level Playwright config. */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'vrt.spec.ts',
  snapshotDir: '../.vimad-vrt',
  timeout: 60_000,
  workers: 1,
  use: { viewport: { width: 1280, height: 900 } },
});
