
import './configLayer/execution/loadEnvironment';

import { defineConfig, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { getProjectConfig } from './configLayer/execution/projectsRegistry';

import { evidenceFields } from './configLayer/schema/evidence/evidence-schema';
import { summarySchema } from './configLayer/schema/evidence/summary-schema';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export function createConfig(project: string | undefined) {
  const authMode = process.env.AGENT_PORTAL_AUTH;

  // Resolve consumer-specific test directory.
  const projectConfig = getProjectConfig(project);

  // Product name for the EvidenceFactory Summary heading.
  // Can be overridden using the PRODUCT environment variable.
  const product = process.env.PRODUCT ?? 'Not Known';

  /*
   * EVIDENCEFACTORY RUN DIRECTORY
   *
   * Create one unique directory for this Playwright invocation.
   *
   * All execution evidence and reports are stored under
   * the same run directory.
   *
   * The UUID prevents collisions between concurrent executions,
   * including parallel Jenkins builds.
   */
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const runId = `${timestamp}-${randomUUID()}`;

  const runDirectory = join(
    process.cwd(),
    'test-results',
    `run-${runId}`,
  );

  const screenshotsDirectory = join(
    runDirectory,
    'screenshots',
  );

  const artifactsDirectory = join(
    runDirectory,
    'test-artifacts',
  );

  const playwrightReportDirectory = join(
    runDirectory,
    'playwright-report',
  );

  // Directory creation is owned by Playwright configuration.
  mkdirSync(runDirectory, { recursive: true });
  mkdirSync(screenshotsDirectory, { recursive: true });

  return defineConfig({
    testDir: projectConfig.testDir,

    /*
     * PLAYWRIGHT TEST ARTIFACTS
     *
     * Keep Playwright-managed artifacts separate from
     * screenshots, Excel, and HTML reports.
     */
    outputDir: artifactsDirectory,

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if test.only is present */
    forbidOnly: !!process.env.CI,

    /* Retry configuration */
    retries: 0,

    /* Number of parallel workers */
    workers: 3,

    /*
     * REPORTERS
     *
     * 1. Playwright list reporter
     * 2. Playwright HTML reporter
     * 3. Existing custom HTML + XLSX reporter
     * 4. EvidenceFactory ExcelJS reporter
     */
    reporter: [
      ['list'],

      [
        'html',
        {
          outputFolder: playwrightReportDirectory,
          open: 'never',
        },
      ],

      // Existing reporter: retained during migration.
      // ['./reportingLayer/custom-html-reporter.js'],

      // Schema-driven Excel evidence reporter.
      [
        './reportingLayer/evidenceReporter.ts',
        {
          evidenceSchema: evidenceFields,
          summarySchema,
          product,
          runId,
          outputDirectory: runDirectory,
        },
      ],
    ],

    /* Global setup */
    globalSetup: require.resolve('./global-setup.js'),

    /* Maximum duration per test: 5 minutes */
    timeout: 300000,

    /* Shared browser/test settings */
    use: {
      actionTimeout: 30 * 1000,

      /*
       * Full-page failure screenshots will be captured
       * by automationLayer/common/baseTest.ts.
       *
       * Disable built-in viewport screenshots to avoid
       * capturing the same failure twice.
       */
      screenshot: 'off',

      trace: 'on-first-retry',

      headless: process.env.CI === 'true',

      storageState:
        authMode === 'skip'
          ? undefined
          : 'automationLayer/athena/agentPortalAuth/auth.json',
    },

    /* Browser projects */
    projects: [
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
        },
      },

      // Firefox
      // {
      //   name: 'firefox',
      //   use: { ...devices['Desktop Firefox'] },
      // },

      // WebKit
      // {
      //   name: 'webkit',
      //   use: { ...devices['Desktop Safari'] },
      // },

      // Mobile Chrome
      // {
      //   name: 'Mobile Chrome',
      //   use: { ...devices['Pixel 5'] },
      // },

      // Mobile Safari
      // {
      //   name: 'Mobile Safari',
      //   use: { ...devices['iPhone 12'] },
      // },

      // Microsoft Edge
      // {
      //   name: 'Microsoft Edge',
      //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
      // },

      // Google Chrome
      // {
      //   name: 'Google Chrome',
      //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      // },
    ],

    /* Optional local development server */
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://localhost:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
  });
}
