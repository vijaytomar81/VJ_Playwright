
import './configLayer/execution/loadEnvironment';

import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { getProjectConfig } from './configLayer/execution/projectsRegistry';
import { getReporterConfig } from './configLayer/execution/reporterConfig';
import { browserProjects } from './configLayer/execution/browserProjects';

/**
 * EvidenceFactory Playwright configuration.
 *
 * Directory creation is owned exclusively by this file.
 * All generated evidence belongs to one run directory.
 */
export function createConfig(project: string | undefined) {
    const authMode = process.env.AGENT_PORTAL_AUTH;
    const projectConfig = getProjectConfig(project);
    const product = process.env.PRODUCT ?? 'Not Known';

    /*
     * EVIDENCEFACTORY RUN DIRECTORY
     *
     * Reserve a unique directory for each execution.
     * Child processes can reuse an inherited run ID.
     */
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    const resultsRoot = join(
        process.cwd(),
        'test-results',
    );

    mkdirSync(resultsRoot, { recursive: true });

    let runId = process.env.EVIDENCEFACTORY_RUN_ID;
    let runDirectory: string;

    if (runId) {
        runDirectory = join(
            resultsRoot,
            `run-${runId}`,
        );
    } else {
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
                // Atomically reserve the run directory.
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

    // Only this configuration file creates directories.
    mkdirSync(screenshotsDirectory, { recursive: true });

    return defineConfig({
        testDir: projectConfig.testDir,

        outputDir: artifactsDirectory,

        fullyParallel: true,
        forbidOnly: !!process.env.CI,

        retries: 0,
        workers: 3,

        reporter: getReporterConfig({
            runId,
            runDirectory,
            playwrightReportDirectory,
            product,
        }),

        globalSetup: require.resolve('./global-setup.js'),

        timeout: 300000,

        use: {
            actionTimeout: 30 * 1000,

            // Full-page screenshots are handled by baseTest.ts.
            screenshot: 'off',

            trace: 'on-first-retry',

            headless: process.env.CI === 'true',

            storageState:
                authMode === 'skip'
                    ? undefined
                    : 'automationLayer/athena/agentPortalAuth/auth.json',
        },

        projects: browserProjects,
    });
}
