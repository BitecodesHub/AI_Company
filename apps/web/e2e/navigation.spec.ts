/**
 * Navigation smoke tests.
 * - Every public + app route resolves (no 404), so demoting pages into "More"
 *   never breaks a direct link.
 * - The primary sidebar shows exactly the five "AI company" destinations, with
 *   the rest tucked into a collapsible "More" group.
 */
import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password'];
// All routes must still resolve even though only five appear in the primary nav.
const APP_ROUTES = [
  '/app/dashboard', '/app/agents', '/app/knowledge', '/app/connectors', '/app/settings',
  '/app/workflows', '/app/content', '/app/inbox', '/app/marketplace', '/app/analytics',
  // Surfaces added in Phases E–I — must resolve without 404.
  '/app/approvals', '/app/company', '/app/admin/members', '/app/admin/system',
];

const PRIMARY_LABELS = ['Dashboard', 'Employees', 'Knowledge', 'Connectors', 'Settings'];

test.describe('Public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} returns 200`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('networkidle');
      const hasContent = await page.locator('h1, main, [class*="min-h-screen"]').count();
      expect(hasContent).toBeGreaterThan(0);
    });
  }
});

test.describe('App pages — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'test@bitecodes.com');
    await page.fill('#password', 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 30_000 });
  });

  for (const route of APP_ROUTES) {
    test(`${route} renders without 404`, async ({ page }) => {
      const response = await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(response?.status()).toBe(200);

      const notFoundH2 = await page.evaluate(() => {
        const h2s = Array.from(document.querySelectorAll('h2'));
        return h2s.some((el) => /this page could not be found/i.test(el.textContent ?? ''));
      });
      expect(notFoundH2, `${route} shows 404 page`).toBe(false);

      await expect(page.locator('h1, [class*="p-8"], main').first()).toBeVisible({ timeout: 5_000 });
    });
  }

  test('primary sidebar shows exactly the five destinations', async ({ page }) => {
    await page.goto('/app/dashboard');
    const primary = page.locator('[data-testid="primary-nav"]');
    // Direct-child links are the primary destinations; "More" items are nested.
    const primaryLinks = primary.locator(':scope > a[data-testid^="nav-"]');
    await expect(primaryLinks).toHaveCount(PRIMARY_LABELS.length);
    for (const label of PRIMARY_LABELS) {
      await expect(page.getByTestId(`nav-${label.toLowerCase()}`)).toBeVisible();
    }
  });

  test('the "More" group is collapsible and expands', async ({ page }) => {
    await page.goto('/app/dashboard');
    const toggle = page.getByTestId('more-toggle');
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId('more-nav')).toHaveCount(0); // collapsed by default
    await toggle.click();
    await expect(page.getByTestId('more-nav')).toBeVisible();
  });
});
