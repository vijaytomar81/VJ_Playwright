import { defineConfig, devices } from '@playwright/test';
import { loadEnvironment } from './configLayer/execution/loadEnvironment';
import { getProjectConfig } from './configLayer/execution/projectsRegistry';
import { parseRetries, videoOption } from './configLayer/execution/playwrightArtifacts';
import {
  ACTION_TIMEOUT,
  EXPECT_TIMEOUT,
  NAVIGATION_TIMEOUT,
} from './configLayer/execution/timeouts';

import { initializeEvidenceRun } from './configLayer/evidenceFactory/evidenceRunDirectory';
import { getEvidenceReporterConfig } from './configLayer/evidenceFactory/reporterConfig';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export function createConfig(project: string | undefined) {
  const { testDir } = getProjectConfig(project);
  loadEnvironment(project);

  const env = process.env.ENV ?? 'dev';
  const authMode = process.env.AGENT_PORTAL_AUTH;
  const retries = parseRetries();

  /*
   * EvidenceFactory initializes the run for every invocation,
   * including Common Job discovery.
   *
   * The runner supplies EVIDENCEFACTORY_RUN_ID so discovery
   * and execution use the same run directory.
   */
  const paths = initializeEvidenceRun();

  /*
   * Discovery collects test inventory only.
   * Execution uses the configured EvidenceFactory reporters.
   */
  const discoveryOnly =
    process.env.EVIDENCEFACTORY_DISCOVERY_ONLY === 'true';

  const reporter = discoveryOnly
    ? [['list']]
    : getEvidenceReporterConfig({
      paths,
      product: project ?? 'Not Known',
    });

  return defineConfig({
    testDir,
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* 0 unless RETRIES is set: a retried purchase could pay twice. Needed for VIDEO_MODE=on-first-retry. */
    retries,
    /* Opt out of parallel tests on CI. */
    workers: 3,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: reporter as ReturnType<typeof getEvidenceReporterConfig>,
    /*
     * Store Playwright test artifacts inside the current
     * EvidenceFactory run directory.
     */
    outputDir: paths.artifactsDirectory,
    globalSetup: require.resolve('./global-setup.ts'),
    timeout: 300000, // 5 minutes for all tests
    expect: { timeout: EXPECT_TIMEOUT },
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
      /* Base URL to use in actions like `await page.goto('')`. */
      // baseURL: 'http://localhost:3000',

      trace: 'on-first-retry',
      /* Capture a screenshot right after a test fails, saved under test-results/ */
      // screenshot: 'only-on-failure',
      /* VIDEO_MODE: off (default), on, retain-on-failure, on-first-retry. See docs/Reporting.md. */
      video: videoOption(retries),
      /* Without these, a single stuck click/waitFor/goto waits out the whole 5-minute test
         timeout (e.g. when an environment shows an error page). Calls that pass their own
         `timeout` keep it. Raise per call for genuinely slow steps rather than here. */
      actionTimeout: ACTION_TIMEOUT,
      navigationTimeout: NAVIGATION_TIMEOUT,
      headless: process.env.CI === 'true',

      storageState:
        authMode === 'skip' ? undefined : `automationLayer/athena/agentPortalAuth/auth.json`,
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
