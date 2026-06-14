import { defineConfig } from 'vitest/config';

// Scopes `vitest run` to fast unit tests under src/. Playwright e2e specs live in
// e2e/ and are run separately (`playwright test`), so they are excluded here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
