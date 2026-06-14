import { test, expect } from '@playwright/test';

test.describe('Agents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'test@bitecodes.com');
    await page.fill('#password', 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 30_000 });
  });

  test('/agents renders without 404', async ({ page }) => {
    const response = await page.goto('/app/agents');
    await page.waitForLoadState('networkidle');
    expect(response?.status()).toBe(200);
    const notFoundH2 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h2')).some(el => /this page could not be found/i.test(el.textContent ?? ''))
    );
    expect(notFoundH2).toBe(false);
    await expect(page.locator('h1')).toContainText('Agent');
  });
});
