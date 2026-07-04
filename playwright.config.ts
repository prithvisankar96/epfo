import { defineConfig, devices } from '@playwright/test';

// E2E suite runs entirely against the MockProvider (§9 M1/M2).
// Mobile-first: the primary project is a 360px-wide viewport.

const PORT = 3100;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // shared in-memory session/rate-limit state
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Use the environment's pre-installed Chromium when the bundled
    // browser revision isn't present (e.g. Claude Code remote env).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 740 },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      PF_PROVIDER: 'mock',
      MOCK_DELAY_MS: '50',
      SESSION_SECRET: 'e2e-test-secret-not-for-production',
      RATE_LIMIT_MAX_INITIATES: '1000',
      CONSENT_LOG_PATH: './data/e2e-consent-log.jsonl',
    },
  },
});
