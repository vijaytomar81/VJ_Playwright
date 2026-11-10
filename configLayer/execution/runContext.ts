
import { join } from 'node:path';

const UNKNOWN = 'Not Known';

/**
 * Shared EvidenceFactory execution context.
 *
 * - Generates one timestamp-based Run ID per Playwright invocation.
 * - Supports local and Jenkins executions.
 * - Reads Jenkins metadata when available.
 * - Provides a shared output directory for reports and screenshots.
 * - Does not create directories or perform file operations.
 */

const runId = new Date().toISOString().replace(/[:.]/g, '-');

const outputDirectory = join(
    process.cwd(),
    'custom-test-reports',
    `run-${runId}`,
);

const known = (value: string | undefined): string =>
    value?.trim() || UNKNOWN;

export const runContext = {
    runId,
    outputDirectory,

    jenkins: {
        buildNumber: known(process.env.BUILD_NUMBER),
        buildId: known(process.env.BUILD_ID),
        jobName: known(process.env.JOB_NAME),
    },
} as const;
