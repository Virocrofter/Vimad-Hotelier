import { chromium } from 'playwright';
const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const login = await fetch(API + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantSlug: 'demo-hotel', email: 'admin@demo.com', password: 'admin123' }),
}).then((r) => r.json());
const token = login.data?.token ?? login.token;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE_ERROR:', String(e).slice(0, 180)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE_ERROR:', m.text().slice(0, 180));
});
await page.goto(WEB + '/auth/login');
await page.locator('#tenantSlug').fill('demo-hotel');
await page.locator('#email').fill('admin@demo.com');
await page.locator('#password').fill('admin123');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/app/**', { timeout: 20000 });
await page.goto(WEB + '/app/exceptions');
await page.waitForTimeout(4000);
const selects = page.locator('section[aria-label="Needs attention"] select[aria-label^="Assign"]');
const pickerCount = await selects.count();
await page.screenshot({ path: '.vimad-evidence/ex05/01-assignee-picker.png' });
let assigned = false;
if (pickerCount > 0) {
  const countAssigned = () =>
    fetch(API + '/v1/exceptions?status=all', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => (j.data ?? j).items.filter((i) => i.assigneeId).length);
  const before = await countAssigned();
  await selects.first().selectOption({ index: 1 });
  await page.waitForTimeout(2000);
  assigned = (await countAssigned()) > before;
  await page.screenshot({ path: '.vimad-evidence/ex05/02-assigned.png' });
}
console.log(JSON.stringify({ pickerCount, assigned }));
console.log(pickerCount > 0 && assigned ? '=== SHIPPED: EX-05 picker verified ===' : '=== FAIL ===');
await browser.close();
process.exit(pickerCount > 0 && assigned ? 0 : 1);
