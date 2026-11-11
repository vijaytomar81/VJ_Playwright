
import type { PlaywrightTestConfig } from '@playwright/test';

import { evidenceFields } from '../schema/evidence/evidence-schema';
import { summarySchema } from '../schema/evidence/summary-schema';

interface ReporterConfigOptions {
    readonly runId: string;
    readonly runDirectory: string;
    readonly playwrightReportDirectory: string;
    readonly product: string;
}

/**
 * EvidenceFactory reporter configuration.
 *
 * Reporters:
 * 1. Playwright list reporter
 * 2. Playwright HTML reporter
 * 3. EvidenceFactory Excel reporter
 *
 * Directory creation remains in playwright.config.base.ts.
 */
export function getReporterConfig(
    options: ReporterConfigOptions,
): PlaywrightTestConfig['reporter'] {
    const {
        runId,
        runDirectory,
        playwrightReportDirectory,
        product,
    } = options;

    return [
        ['list'],

        [
            'html',
            {
                outputFolder: playwrightReportDirectory,
                open: 'never',
            },
        ],

        // Existing custom HTML reporter.
        // Retained as disabled during migration.
        // ['./reportingLayer/custom-html-reporter.js'],

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
    ];
}
