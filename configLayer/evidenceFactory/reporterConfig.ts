import type { PlaywrightTestConfig } from '@playwright/test';

import type { EvidenceRunPaths } from './evidenceRunDirectory';

import { evidenceFields } from './schema/evidence-schema';
import { summarySchema } from './schema/summary-schema';

export interface EvidenceReporterConfigOptions {
    readonly paths: EvidenceRunPaths;
    readonly product: string;
    readonly useBrandAllureReporter?: boolean;
}

export function getEvidenceReporterConfig(
    options: EvidenceReporterConfigOptions
): PlaywrightTestConfig['reporter'] {
    const {
        paths,
        product,
        useBrandAllureReporter = false,
    } = options;

    const allureReporter = useBrandAllureReporter
        ? './reportingLayer/brand-allure-reporter.ts'
        : 'allure-playwright';

    return [
        ['list'],

        [
            'html',
            {
                outputFolder: paths.playwrightReportDirectory,
                open: 'never',
            },
        ],

        [
            'junit',
            {
                outputFile: paths.junitFile,
            },
        ],

        [
            allureReporter,
            {
                resultsDir: paths.allureResultsDirectory,
            },
        ],

        [
            './reportingLayer/evidenceFactory/evidenceReporter.ts',
            {
                evidenceSchema: evidenceFields,
                summarySchema,
                product,
                runId: paths.runId,
                runDirectory: paths.runDirectory,
                outputFile: paths.evidenceReportFile,
            },
        ],

        ...(process.env.COMMON_JOB_PHASE === 'execute'
            ? [['./configLayer/execution/commonJob/reporter.cjs'] as const]
            : []),
    ];
}
