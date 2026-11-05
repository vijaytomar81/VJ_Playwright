import { defineConfig, devices } from '@playwright/test';

import {
  evidenceFields,
} from './configLayer/schema/evidence/evidence-schema';

import {
  summarySchema,
} from './configLayer/schema/evidence/summary-schema';

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
   */
  testIgnore: [
    'tests/framework/evidence-factory/**/*.spec.ts',
  ],

  /*
   * Parallel execution.
   */
  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  /*
   * Consumer-owned EvidenceFactory schemas.
   */
  metadata: {
    evidence: {
      evidenceFields,
      summarySchema,
    },
  },

  /*
   * EvidenceFactory execution lifecycle.
   */
  globalSetup:
    './evidenceFactory/fixtures/evidence.setup.ts',

  globalTeardown:
    './evidenceFactory/fixtures/evidence.finalize.ts',

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
     * Framework and configuration tests.
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
     * Google Chrome.
     *
     * Uses the installed Google Chrome browser.
     */
    {
      name: 'chrome',

      testMatch: [
        'automationLayer/tests/**/*.spec.ts',
      ],

      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },

    /*
     * Microsoft Edge.
     *
     * Uses the installed Microsoft Edge browser.
     */
    {
      name: 'edge',

      testMatch: [
        'automationLayer/tests/**/*.spec.ts',
      ],

      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
      },
    },

    /*
     * Mozilla Firefox.
     *
     * Uses Playwright's Firefox build.
     */
    {
      name: 'firefox',

      testMatch: [
        'automationLayer/tests/**/*.spec.ts',
      ],

      use: {
        ...devices['Desktop Firefox'],
      },
    },

    /*
     * WebKit.
     *
     * Uses Playwright's WebKit browser engine.
     * This is Safari-compatible testing, not
     * execution of the installed Safari application.
     */
    {
      name: 'webkit',

      testMatch: [
        'automationLayer/tests/**/*.spec.ts',
      ],

      use: {
        ...devices['Desktop Safari'],
      },
    },

    /*
     * Chromium.
     *
     * Uses Playwright's bundled Chromium browser.
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