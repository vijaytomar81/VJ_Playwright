
import path from 'node:path';

import './configLayer/execution/loadEnvironment';

import { defineConfig, devices } from '@playwright/test';
import { getProjectConfig } from './configLayer/execution/projectsRegistry';

// EvidenceFactory - consumer-owned schemas
import { evidenceFields } from './configLayer/schema/evidence/evidence-schema';
import { summarySchema } from './configLayer/schema/evidence/summary-schema';

// EvidenceFactory - centralized configuration
import { evidenceConfig } from './configLayer/execution/evidenceConfig';
import { defaultEvidenceConfig } from './evidenceFactory/config/evidence-defaults';

import type {
  EvidenceConfiguration,
} from './evidenceFactory/config/evidence-config';

// EvidenceFactory - automatic run ID initialization
import { initializeEvidenceRunId } from './evidenceFactory/fixtures/evidence.run';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export function createConfig(project: string | undefined) {
  /**
   * Initialize EvidenceFactory run ID.
   *
   * - Preserves an externally supplied EVIDENCE_RUN_ID.
   * - Generates a unique run ID when not supplied.
   * - Includes Jenkins BUILD_NUMBER when available.
   * - Supports Windows, macOS, Linux, CLI and Jenkins.
   */
  initializeEvidenceRunId();

  /**
   * Resolve centralized EvidenceFactory configuration.
   *
   * The consumer supplies only project-specific overrides.
   * All remaining settings come from EvidenceFactory defaults.
   *
   * The storage root is the single parent directory for
   * evidence, reports, metadata and archives.
   */
  const resolvedEvidenceConfig: EvidenceConfiguration = {
    storage: {
      ...defaultEvidenceConfig.storage,
      ...evidenceConfig.storage,
    },

    report: {
      ...defaultEvidenceConfig.report,
      ...evidenceConfig.report,
    },

    archive: {
      ...defaultEvidenceConfig.archive,
      ...evidenceConfig.archive,

      policy: {
        ...defaultEvidenceConfig.archive.policy,
        ...evidenceConfig.archive?.policy,
      },
    },
  };

  /**
   * Synchronize the EvidenceFactory root directory.
   *
   * Existing evidence fixtures, aggregators and global
   * teardown use EVIDENCE_RESULTS_DIR.
   *
   * Example:
   *   custom-test-reports/
   *
   * All run-specific files are stored under:
   *   custom-test-reports/<runId>/
   */
  process.env.EVIDENCE_RESULTS_DIR = path.resolve(
    resolvedEvidenceConfig.storage.resultsDirectory,
  );

  const env = process.env.ENV ?? 'dev';
  const authMode = process.env.AGENT_PORTAL_AUTH;

  return defineConfig({
    testDir: getProjectConfig(project).testDir,

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* Retry on CI and local */
    retries: 0,

    /* Opt out of parallel tests on CI. */
    workers: 3,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
      ['list'],
      ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ['./reportingLayer/custom-html-reporter.js'],
    ],

    /**
     * Existing global setup.
     *
     * global-setup.ts initializes EvidenceFactory before
     * executing existing data generation and authentication.
     */
    globalSetup: require.resolve('./global-setup.ts'),

    /**
     * EvidenceFactory finalization.
     *
     * Consolidates evidence, generates the Excel report,
     * and creates an optional ZIP archive.
     */
    globalTeardown: require.resolve(
      './evidenceFactory/fixtures/evidence.finalize.ts',
    ),

    /**
     * EvidenceFactory schemas and centralized configuration.
     *
     * The resolved configuration is supplied to global setup
     * through Playwright metadata.
     *
     * EvidenceFactory setup then persists the report and
     * archive settings in run-config.json for global teardown.
     */
    metadata: {
      evidence: {
        evidenceFields,
        summarySchema,
        config: resolvedEvidenceConfig,
      },
    },

    timeout: 300000, // 5 minutes for all tests

    /* Shared settings for all the projects below. */
    use: {
      /* Base URL to use in actions like `await page.goto('')`. */
      // baseURL: 'http://localhost:3000',

      /* Collect trace when retrying the failed test. */
      actionTimeout: 30 * 1000,
      screenshot: 'only-on-failure',
      trace: 'on-first-retry',
      headless: process.env.CI === 'true',

      storageState:
        authMode === 'skip'
          ? undefined
          : 'automationLayer/athena/agentPortalAuth/auth.json',
    },

    /* Configure projects for major browsers */
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },

      // {
      //   name: 'firefox',
      //   use: { ...devices['Desktop Firefox'] },
      // },

      // {
      //   name: 'webkit',
      //   use: { ...devices['Desktop Safari'] },
      // },

      /* Test against mobile viewports. */
      // {
      //   name: 'Mobile Chrome',
      //   use: { ...devices['Pixel 5'] },
      // },
      // {
      //   name: 'Mobile Safari',
      //   use: { ...devices['iPhone 12'] },
      // },

      /* Test against branded browsers. */
      // {
      //   name: 'Microsoft Edge',
      //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
      // },
      // {
      //   name: 'Google Chrome',
      //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      // },
    ],

    /* Run your local dev server before starting the tests */
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://localhost:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
  });
}
