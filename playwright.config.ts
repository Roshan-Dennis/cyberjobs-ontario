import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end click-through of the exported site.
 *
 *   npm run fixture && npm run build:static && npm run e2e
 *
 * Runs against `out/` served the way GitHub Pages serves it, so base-path and
 * trailing-slash mistakes fail here instead of in production.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173/cyberjobs-ontario/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://localhost:4173/cyberjobs-ontario/',
    reuseExistingServer: !process.env.CI,
  },
});
