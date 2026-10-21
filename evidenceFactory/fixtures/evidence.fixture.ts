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

export const test = base.extend<EvidenceFixtures>({
  evidence: [
    async ({ page, browser, headless }, use, testInfo) => {
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
       * Capture actual browser information.
       *
       * Each worker writes its own metadata file
       * to avoid conflicts during parallel execution.
       */
      const browserMetadata = {
        browser: browser.browserType().name(),
        browserChannel:
          testInfo.project.use.channel ?? 'default',
        browserVersion: browser.version(),
        headless,
      };

      const browserMetadataPath = path.join(
        resultsDir,
        runId,
        'metadata',
        `browser-${workerId}.json`,
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

          data: {
            ...businessData,
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