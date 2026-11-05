import { defineConfig, devices } from '@playwright/test';

/**
 * EvidenceFactory validation configuration.
 *
 * This configuration is separate from the main
 * application automation configuration.
 *
 * It supports:
 *
 * 1. Evidence collection across 4 workers.
 * 2. Retry preservation and Excel reporting.
 * 3. Failure recovery and safe cleanup.
 * 4. Scale validation with 40 scenarios.
 *
 * Run using:
 *
 * npx playwright test --config=playwright.evidence.config.ts
 */
export default defineConfig({

  /*
   * EvidenceFactory test directory.
   */
  testDir: './tests/framework/evidence-factory',

  testMatch: '**/*.spec.ts',

  /*
   * Parallel execution is enabled globally.
   *
   * Individual projects can override this.
   */
  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  /*
   * Four workers for evidence validation.
   */
  workers: 4,

  reporter: [
    [
      'html',
      {
        outputFolder: 'playwright-evidence-report',
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
     * Independent EvidenceFactory tests.
     *
     * These tests do not depend on shared
     * evidence collection or finalization.
     */
    {
      name: 'evidence-framework',

      testMatch: [
        'evidence-finalization-failure.spec.ts',
      ],

      workers: 1,

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /*
     * Four-scenario evidence collection.
     *
     * Includes a simulated retry for TC-003.
     */
    {
      name: 'evidence-collection',

      testMatch: [
        'evidence-factory-excel.spec.ts',
      ],

      workers: 4,

      fullyParallel: true,

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /*
     * Four-scenario evidence finalization.
     *
     * Executes after evidence-collection.
     */
    {
      name: 'evidence-report',

      testMatch: [
        'evidence-report.spec.ts',
      ],

      dependencies: [
        'evidence-collection',
      ],

      workers: 1,

      fullyParallel: false,

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /*
     * Scale evidence collection.
     *
     * 40 scenarios across 4 workers.
     */
    {
      name: 'evidence-scale',

      testMatch: [
        'evidence-factory-scale.spec.ts',
      ],

      workers: 4,

      fullyParallel: true,

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /*
     * Scale evidence finalization.
     *
     * Executes after all 40 scale scenarios.
     */
    {
      name: 'evidence-scale-report',

      testMatch: [
        'evidence-scale-report.spec.ts',
      ],

      dependencies: [
        'evidence-scale',
      ],

      workers: 1,

      fullyParallel: false,

      use: {
        ...devices['Desktop Chrome'],
      },
    },

  ],

});
