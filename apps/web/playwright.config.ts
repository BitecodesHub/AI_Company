import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,     // keep serial in CI to avoid port conflicts
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env['WEB_URL'] ?? 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Starts the web app. The API (:4000) must run alongside — for deterministic,
  // offline runs start it with AI_GATEWAY_MODE=mock so AI calls return stubs:
  //   AI_GATEWAY_MODE=mock pnpm --filter @bitecodes/api dev
  //   AI_GATEWAY_MODE=mock pnpm --filter @bitecodes/web exec playwright test
  webServer: {
    command: 'PORT=3002 pnpm dev',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    timeout: 60_000,
    env: { AI_GATEWAY_MODE: process.env['AI_GATEWAY_MODE'] ?? 'mock' },
  },
});
