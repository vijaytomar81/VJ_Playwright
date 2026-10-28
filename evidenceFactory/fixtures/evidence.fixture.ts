import path from 'node:path';
import fs from 'node:fs/promises';

import {
  test as base,
  expect,
  type TestInfo,
} from '@playwright/test';

import {
  EvidenceFactory,
  FileEvidenceStore,
  EvidenceStatus,
  type Evidence,
} from '../index';

export interface EvidenceFixture {
  add(data: Record<string, unknown>): void;
  screenshot(name: string): Promise<string>;
}

type EvidenceFixtures = {
  evidence: EvidenceFixture;
};

const resultsDir = path.resolve(
  process.env.EVIDENCE_RESULTS_DIR ?? 'results',
);

function getRunId(): string {
  const runId = process.env.EVIDENCE_RUN_ID?.trim();

  if (!runId) {
    throw new Error(
      'EVIDENCE_RUN_ID is required. ' +
      'Provide one shared run ID for the Playwright execution.',
    );
  }

  return runId;
}

function getEvidenceStatus(
  status: TestInfo['status'],
): EvidenceStatus {
  switch (status) {
    case 'passed':
      return EvidenceStatus.PASSED;

    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return EvidenceStatus.FAILED;

    default:
      return EvidenceStatus.NOT_EXECUTED;
  }
}

function safeName(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'screenshot'
  );
}

/*
 * Convert Playwright browser identifiers into
 * readable browser names for evidence reports.
 */
function getBrowserName(
  browserType: string,
  browserChannel: string,
): string {
  if (
    browserChannel === 'msedge' ||
    browserChannel.startsWith('msedge-')
  ) {
    return 'Microsoft Edge';
  }

  if (
    browserChannel === 'chrome' ||
    browserChannel.startsWith('chrome-')
  ) {
    return 'Google Chrome';
  }

  switch (browserType) {
    case 'chromium':
      return 'Chromium';

    case 'firefox':
      return 'Mozilla Firefox';

    case 'webkit':
      return 'WebKit';

    default:
      return browserType;
  }
}

/*
 * Determine whether the test is running with
 * a mobile or desktop device configuration.
 *
 * This uses Playwright's effective isMobile option.
 * It does not identify a specific physical device.
 */
function getDeviceName(
  isMobile: boolean,
  projectName: string,
): string {
  return isMobile
    ? `Mobile (${projectName})`
    : 'Desktop';
}

export const test = base.extend<EvidenceFixtures>({
  evidence: [
    async (
      {
        page,
        browser,
        headless,
        isMobile,
      },
      use,
      testInfo,
    ) => {
      const runId = getRunId();
      const workerId = `worker-${testInfo.parallelIndex}`;
      const attempt = testInfo.retry + 1;

      const businessData: Record<string, unknown> = {};
      const screenshotPaths: string[] = [];

      const factory = new EvidenceFactory<
        Record<string, unknown>
      >({
        runId,
        resultsDir,
        fields: [],
      });

      const store = new FileEvidenceStore<
        Record<string, unknown>
      >({
        runId,
        resultsDir,
        workerId,
      });

      /*
       * Capture actual execution environment.
       *
       * The browser version comes from the running
       * browser, not from a hardcoded configuration.
       */
      const browserType = browser.browserType().name();

      const browserChannel =
        testInfo.project.use.channel ?? 'default';

      const browserName = getBrowserName(
        browserType,
        browserChannel,
      );

      const browserVersion = browser.version();

      const executionMetadata = {
        mode: process.env.TEST_MODE ?? 'E2E',

        device: getDeviceName(
          isMobile,
          testInfo.project.name,
        ),

        browser: browserName,
        browserChannel,
        browserVersion,
        headless,
      };

      /*
       * Store browser metadata separately for each
       * Playwright project and worker.
       *
       * This prevents different browser projects from
       * overwriting each other's metadata.
       */
      const browserMetadata = {
        browser: executionMetadata.browser,
        browserChannel:
          executionMetadata.browserChannel,
        browserVersion:
          executionMetadata.browserVersion,
        headless: executionMetadata.headless,
      };

      const browserMetadataPath = path.join(
        resultsDir,
        runId,
        'metadata',
        `browser-${safeName(testInfo.project.name)}-${workerId}.json`,
      );

      await fs.mkdir(
        path.dirname(browserMetadataPath),
        { recursive: true },
      );

      await fs.writeFile(
        browserMetadataPath,
        JSON.stringify(browserMetadata, null, 2),
        'utf8',
      );

      let screenshotCount = 0;

      async function captureScreenshot(
        name: string,
      ): Promise<string> {
        screenshotCount += 1;

        const filename = [
          safeName(testInfo.testId),
          `attempt-${attempt}`,
          screenshotCount,
          safeName(name),
        ].join('-') + '.png';

        const screenshotPath = path.join(
          resultsDir,
          runId,
          'screenshots',
          filename,
        );

        await fs.mkdir(
          path.dirname(screenshotPath),
          { recursive: true },
        );

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        await testInfo.attach(name, {
          path: screenshotPath,
          contentType: 'image/png',
        });

        screenshotPaths.push(screenshotPath);

        return screenshotPath;
      }

      const evidence: EvidenceFixture = {
        add(data) {
          Object.assign(businessData, data);
        },

        async screenshot(name) {
          return captureScreenshot(name);
        },
      };

      const startedAt = new Date();

      try {
        await use(evidence);
      } finally {
        const status = getEvidenceStatus(
          testInfo.status,
        );

        if (
          status === EvidenceStatus.FAILED &&
          !page.isClosed()
        ) {
          try {
            await captureScreenshot('failure');
          } catch (error) {
            console.warn(
              `Failure screenshot unavailable for "${testInfo.title}".`,
              error,
            );
          }
        }

        const finishedAt = new Date();
        const firstError = testInfo.errors[0];

        const record: Evidence<
          Record<string, unknown>
        > = {
          runId,
          workerId,
          attempt,

          scenarioId: testInfo.testId,
          scenarioName: testInfo.title,

          status,

          startTime: startedAt.toISOString(),
          endTime: finishedAt.toISOString(),
          durationMs: testInfo.duration,

          /*
           * Execution metadata is added automatically
           * to every test case's evidence.
           *
           * It is placed after businessData so tests
           * cannot accidentally override actual
           * execution environment values.
           */
          data: {
            ...businessData,
            ...executionMetadata,
            screenshots: screenshotPaths,
          },

          ...(firstError
            ? {
              error: {
                message:
                  firstError.message ??
                  'Test execution failed',

                ...(firstError.stack
                  ? { stack: firstError.stack }
                  : {}),
              },
            }
            : {}),
        };

        await factory.record(record, store);
      }
    },
    { auto: true },
  ],
});

export { expect };