import { defineConfig, devices } from '@playwright/test';

const baseURL = String(process.env.V11_PREVIEW_URL ?? '').trim();
if (!baseURL) throw new Error('V11_PREVIEW_URL is required for the protected hosted browser pilot');

export default defineConfig({
  testDir: './hosted-tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 150_000,
  reporter: [['line']],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 30_000
  },
  projects: [
    {
      name: 'hosted-chromium-desktop',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 1000 } }
    }
  ]
});
