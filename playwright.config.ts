import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 480, height: 720 },
  },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
