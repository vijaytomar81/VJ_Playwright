import { defineConfig, devices } from '@playwright/test';

export default defineConfig({

  /*
   * Framework and application automation test locations.
   */
  testDir: '.',

  testMatch: [
    'tests/**/*.spec.ts',
    'automationLayer/tests/**/*.spec.ts',
  ],

  /*
   * EvidenceFactory regression tests are executed
   * separately using playwright.evidence.config.ts.
   *
   * Exclude them from normal automation execution.
   */
  testIgnore: [
    'tests/framework/evidence-factory/**/*.spec.ts',
  ],

  /*
   * Allow independent tests to execute in parallel.
   */
  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never',
      },
    ],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [

    /*
     * General framework and configuration tests.
     *
     * EvidenceFactory validation tests are excluded
     * by the global testIgnore configuration.
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
     * Actual application UI automation tests.
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
