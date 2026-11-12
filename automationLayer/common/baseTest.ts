import { test as base, expect, type Page } from '@playwright/test';

import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { initializeEvidenceRun } from '../../configLayer/evidenceFactory/evidenceRunDirectory';
import { captureExecutionEnvironmentMetadata } from './executionEnvironmentMetadata';

/**
 * EvidenceFactory custom Playwright fixture.
 *
 * Captures browser metadata and full-page screenshots
 * for unexpected test failures.
 *
 * Supports the original page and popup/new-tab pages.
 *
 * Directory creation is owned by evidenceRunDirectory.ts.
 * This fixture only writes screenshot files.
 *
 * The original screenshot filename is included in the
 * Playwright attachment name for future Excel integration.
 */
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {

        /*
         * Capture browser metadata before the test executes.
         */
        captureExecutionEnvironmentMetadata(page);

        /*
         * Track pages opened during the test.
         *
         * The most recently opened page is preferred
         * when capturing a failure screenshot.
         */
        const pages: Page[] = [page];

        const onPage = (newPage: Page): void => {
            pages.push(newPage);
        };

        page.context().on('page', onPage);

        try {
            // Execute the test using Playwright's standard page fixture.
            await use(page);
        } finally {
            page.context().off('page', onPage);
        }

        /*
         * Capture screenshots only for unexpected failures.
         *
         * This includes failed and timed-out test attempts,
         * but excludes expected failures declared with test.fail().
         */
        if (testInfo.status === testInfo.expectedStatus) {
            return;
        }

        if (
            testInfo.status !== 'failed' &&
            testInfo.status !== 'timedOut'
        ) {
            return;
        }

        /*
         * Prefer the most recently opened page that is still open.
         * If a popup has closed, fall back to the original page
         * or another available page.
         */
        const screenshotPage = [...pages]
            .reverse()
            .find(candidate => !candidate.isClosed());

        if (!screenshotPage) {
            console.warn(
                `EvidenceFactory: Screenshot skipped because all pages are closed: ` +
                testInfo.title,
            );
            return;
        }

        /*
         * Obtain the shared screenshot directory directly
         * from the centralized EvidenceFactory utility.
         */
        const screenshotsDirectory = initializeEvidenceRun().screenshotsDirectory;

        try {
            /*
             * Never create directories here.
             * The screenshots directory must already exist.
             */
            if (
                !existsSync(screenshotsDirectory) ||
                !statSync(screenshotsDirectory).isDirectory()
            ) {
                console.warn(
                    'EvidenceFactory: Screenshot directory does not exist: ' +
                    screenshotsDirectory,
                );
                return;
            }

            /*
             * Generate a stable identifier for each test.
             *
             * This prevents filename collisions when different
             * tests have identical titles.
             */
            const testHash = createHash('sha256')
                .update(testInfo.testId)
                .digest('hex')
                .slice(0, 16);

            const projectName = testInfo.project.name
                .replace(/[^a-zA-Z0-9_-]/g, '_');

            /*
             * Include retry, repeat index, and worker index
             * to distinguish parallel test attempts.
             */
            const screenshotName = [
                'failure',
                projectName,
                testHash,
                `retry-${testInfo.retry}`,
                `repeat-${testInfo.repeatEachIndex}`,
                `worker-${testInfo.workerIndex}`,
            ].join('-') + '.png';

            const screenshotPath = join(
                screenshotsDirectory,
                screenshotName,
            );

            /*
             * Capture the complete page and save directly
             * into the EvidenceFactory screenshots directory.
             *
             * No copying or moving is required.
             */
            await screenshotPage.screenshot({
                path: screenshotPath,
                fullPage: true,
                timeout: 10000,
                animations: 'disabled',
            });

            /*
             * Adding Fullpage screenshpt details into test result.
             */

            testInfo.annotations.push({
                type: 'screenshot',
                description: relative(
                    initializeEvidenceRun().excelReportDirectory,
                    screenshotPath,
                ).replace(/\\/g, '/'),
            });

            /*
             * Attach the screenshot to the Playwright test result.
             *
             * Include the original filename in the attachment name
             * for future Excel screenshot-path integration.
             */
            await testInfo.attach(
                `full-page-failure:${basename(screenshotPath)}`,
                {
                    path: screenshotPath,
                    contentType: 'image/png',
                },
            );

            console.log(
                `EvidenceFactory: Full-page screenshot saved: ${screenshotPath}`,
            );
        } catch (error) {
            /*
             * Screenshot errors must not hide or replace
             * the original test failure.
             */
            console.warn(
                `EvidenceFactory: Unable to capture screenshot for ` +
                `${testInfo.title}:`,
                error,
            );
        }
    },
});

export { expect };
