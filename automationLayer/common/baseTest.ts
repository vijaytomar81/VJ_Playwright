import { test as base, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { captureExecutionEnvironmentMetadata } from './executionEnvironmentMetadata';

/**
 * Custom Playwright fixture.
 *
 * Captures browser metadata and full-page screenshots for
 * unexpected test failures.
 *
 * Supports original page and popup/new-tab pages.
 *
 * Screenshot directory creation is managed by Playwright
 * through testInfo.outputPath().
 *
 * The original screenshot filename is included in the
 * Playwright attachment name for post-execution reporting.
 */
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        captureExecutionEnvironmentMetadata(page);

        const pages: Page[] = [page];

        const onPage = (newPage: Page): void => {
            pages.push(newPage);
        };

        page.context().on('page', onPage);

        try {
            await use(page);
        } finally {
            page.context().off('page', onPage);
        }

        if (testInfo.status === testInfo.expectedStatus) {
            return;
        }

        if (testInfo.status !== 'failed' && testInfo.status !== 'timedOut') {
            return;
        }

        const screenshotPage = [...pages]
            .reverse()
            .find(candidate => !candidate.isClosed());

        if (!screenshotPage) {
            console.warn(
                'Full-page screenshot skipped because all pages are closed: ' +
                testInfo.title
            );

            return;
        }

        try {
            const testHash = createHash('sha256')
                .update(testInfo.testId)
                .digest('hex')
                .slice(0, 16);

            const projectName = testInfo.project.name
                .replace(/[^a-zA-Z0-9_-]/g, '_');

            const screenshotName = [
                'failure',
                projectName,
                testHash,
                `retry-${testInfo.retry}`,
                `repeat-${testInfo.repeatEachIndex}`,
                `worker-${testInfo.workerIndex}`,
            ].join('-') + '.png';

            const screenshotPath = testInfo.outputPath(screenshotName);

            await screenshotPage.screenshot({
                path: screenshotPath,
                fullPage: true,
                timeout: 10000,
                animations: 'disabled',
            });

            await testInfo.attach(
                `full-page-failure:${basename(screenshotPath)}`,
                {
                    path: screenshotPath,
                    contentType: 'image/png',
                }
            );

            console.log(
                `Full-page screenshot saved: ${screenshotPath}`
            );
        } catch (error) {
            console.warn(
                `Unable to capture full-page screenshot for ${testInfo.title}:`,
                error
            );
        }
    },
});

export { expect };
export type * from '@playwright/test';