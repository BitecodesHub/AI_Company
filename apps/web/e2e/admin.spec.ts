/**
 * Admin panel + session context E2E.
 *
 * Verifies the real session drives the UI (the sidebar shows the Admin entry for
 * an owner) and that the admin Members/Invitations pages render with their
 * sub-nav. Behaviour, not just 200s. Requires the running stack (web + api).
 */
import { test, expect } from '@playwright/test';

test.describe('Admin panel — authenticated owner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'test@bitecodes.com');
    await page.fill('#password', 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 30_000 });
  });

  test('owner sees the Admin entry in the sidebar', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page.getByTestId('nav-admin')).toBeVisible({ timeout: 10_000 });
  });

  test('primary nav still shows exactly five destinations (Admin is separate)', async ({ page }) => {
    await page.goto('/app/dashboard');
    const primary = page.locator('[data-testid="primary-nav"]');
    const primaryLinks = primary.locator(':scope > a[data-testid^="nav-"]');
    await expect(primaryLinks).toHaveCount(5);
  });

  test('Members page renders with the admin sub-nav', async ({ page }) => {
    await page.goto('/app/admin/members');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-subnav')).toBeVisible();
    await expect(page.getByTestId('admin-members')).toBeVisible();
    // The owner themselves must appear in the members table.
    await expect(page.locator('text=test@bitecodes.com').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Invitations tab loads the invite form', async ({ page }) => {
    await page.goto('/app/admin/invitations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-invitations')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
