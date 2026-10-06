import { defineConfig, devices } from '@playwright/test';

export default defineConfig({

  /*
   * We currently have framework/configuration tests here.
   * UI automation will later live under automationLayer/tests.
   */
  testDir: '.',

  /*
   * Prevent Playwright from treating files outside our
   * intended test locations as tests.
   */
  testMatch: [
    'tests/**/*.spec.ts',
    'automationLayer/tests/**/*.spec.ts',
  ],

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never',
    }],
  ],

  use: {
    trace: 'on-first-retry',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',
  },

  projects: [

    /*
     * Framework-level tests.
     *
     * These execute once and do not need
     * Chromium / Firefox / WebKit duplication.
     */
    {
      name: 'framework',

      testMatch: [
        'tests/config/**/*.spec.ts',
        'tests/framework/**/*.spec.ts',
      ],

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /*
     * UI automation.
     *
     * These tests execute against Chromium.
     *
     * BrowserStack and additional browser projects
     * will be added later.
     */
    {
      name: 'chromium',

      testMatch: [
        'automationLayer/tests/**/*.spec.ts',
      ],

      use: {
        ...devices['Desktop Chrome'],
      },
    },

  ],

});