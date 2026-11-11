
import { test as base, expect } from '@playwright/test';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { captureBrowserMetadata } from './browserMetadata';

/**
 * EvidenceFactory custom Playwright fixture.
 *
 * Captures browser metadata and full-page screenshots
 * for unexpected test failures.
 *
 * Directory creation is owned by playwright.config.base.ts.
 * This fixture only writes screenshot files.
 *
 * The original screenshot filename is included in the
 * Playwright attachment name so evidenceReporter.ts can
 * store its relative path in Excel.
 */
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {

        /*
         * Capture browser metadata before the test executes.
         *
         * This records:
         * - Browser name
         * - Browser version
         * - Browser channel
         * - Viewport
         *
         * Metadata is stored in Playwright test annotations
         * and collected by evidenceReporter.ts.
         */
        captureBrowserMetadata(page);

        // Execute the test using Playwright's standard page fixture.
        await use(page);

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

        // Screenshots cannot be captured from a closed page.
        if (page.isClosed()) {
            console.warn(
                `EvidenceFactory: Screenshot skipped because page is closed: ` +
                testInfo.title,
            );
            return;
        }

        /*
         * Playwright project outputDir is configured as:
         *
         * test-results/run-<id>/test-artifacts
         *
         * Its parent is the shared EvidenceFactory run directory.
         */
        const runDirectory = dirname(testInfo.project.outputDir);

        const screenshotsDirectory = join(
            runDirectory,
            'screenshots',
        );

        try {
            /*
             * Never create directories here.
             * The screenshots directory must already exist.
             */
            if (!existsSync(screenshotsDirectory)) {
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
             * into the EvidenceFactory run directory.
             *
             * No copying or moving is required.
             */
            await page.screenshot({
                path: screenshotPath,
                fullPage: true,
                timeout: 10000,
                animations: 'disabled',
            });

            /*
             * Attach the screenshot to the Playwright test result.
             *
             * Include the original filename in the attachment name
             * so evidenceReporter.ts can reconstruct the relative
             * screenshot path without using TestResult.annotations.
             *
             * Example Excel value:
             *
             * screenshots/failure-chromium-<hash>-retry-0-repeat-0-worker-0.png
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
