
import './configLayer/execution/loadEnvironment';

import { defineConfig, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

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
   * Create one unique directory for each Playwright execution.
   *
   * Use a UTC timestamp with milliseconds.
   *
   * If two executions start in the same millisecond,
   * append a numeric suffix to avoid folder collisions.
   *
   * Atomic directory creation prevents two concurrent
   * executions from reserving the same new directory.
   *
   * Workers inheriting EVIDENCEFACTORY_RUN_ID reuse
   * the directory belonging to the current execution.
   *
   * Directory creation is owned exclusively by this file.
   */

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const resultsRoot = join(
    process.cwd(),
    'test-results',
  );

  // Ensure the parent directory exists.
  mkdirSync(resultsRoot, { recursive: true });

  let runId = process.env.EVIDENCEFACTORY_RUN_ID;
  let runDirectory: string;

  if (runId) {
    /*
     * Reuse the run directory when the run ID
     * is inherited from the parent process.
     */
    runDirectory = join(
      resultsRoot,
      `run-${runId}`,
    );
  } else {
    /*
     * Atomically reserve a unique run directory.
     *
     * Example:
     * run-2026-11-10T18-04-45-123Z
     * run-2026-11-10T18-04-45-123Z-1
     */

    let counter = 0;

    while (true) {
      runId = counter === 0
        ? timestamp
        : `${timestamp}-${counter}`;

      runDirectory = join(
        resultsRoot,
        `run-${runId}`,
      );

      try {
        // Exclusive directory reservation.
        // Do not use recursive:true here.
        mkdirSync(runDirectory);
        break;
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== 'EEXIST'
        ) {
          throw error;
        }

        counter++;
      }
    }

    // Share the run ID with child processes.
    process.env.EVIDENCEFACTORY_RUN_ID = runId;
  }

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

  // Screenshot directory is created only by configuration.
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
      //   use: {
      //     ...devices['Desktop Edge'],
      //     channel: 'msedge',
      //   },
      // },

      // Google Chrome
      // {
      //   name: 'Google Chrome',
      //   use: {
      //     ...devices['Desktop Chrome'],
      //     channel: 'chrome',
      //   },
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
