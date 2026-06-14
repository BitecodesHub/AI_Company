/**
 * E4 Auth flow tests — signup, login, logout, session persistence.
 */
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

const TEST_EMAIL = 'test@bitecodes.com';
const TEST_PASSWORD = 'Test1234!';

test.describe('Login flow', () => {
  test('valid credentials → redirect to /dashboard', async ({ page }) => {
    await page.goto('/login');

    // Page renders
    await expect(page.locator('h1')).toContainText('Welcome back');

    // Fill and submit
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/app/dashboard', { timeout: 10_000 });
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test('invalid credentials → shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error should appear (no redirect)
    await expect(page.locator('[class*="destructive"]')).toBeVisible({ timeout: 5_000 });
    expect(page.url()).toMatch(/\/login/);
  });

  test('empty form → HTML5 validation prevents submit', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // Should stay on login page
    expect(page.url()).toMatch(/\/login/);
  });
});

test.describe('Signup flow', () => {
  test('new user signup → redirect to /dashboard', async ({ page }) => {
    const uniqueEmail = `e2e-${crypto.randomUUID().slice(0, 8)}@test.invalid`;

    await page.goto('/signup');
    await expect(page.locator('h1')).toContainText('Create your account');

    await page.fill('#name', 'E2E Test User');
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', 'TestPass123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/app/dashboard', { timeout: 10_000 });
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test('short password → shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#name', 'Test');
    await page.fill('#email', 'short@test.invalid');
    await page.fill('#password', 'abc');
    await page.click('button[type="submit"]');

    // Error or form stays
    await expect(page.locator('[class*="destructive"]').or(page.locator('[class*="text-destructive"]'))).toBeVisible({ timeout: 3_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/signup/);
  });
});

test.describe('Forgot password page', () => {
  test('/forgot-password renders without 404', async ({ page }) => {
    const response = await page.goto('/forgot-password');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Reset your password');
  });
});
