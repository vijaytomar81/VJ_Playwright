import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface EvidenceRunPaths {
    readonly runId: string;
    readonly runDirectory: string;
    readonly commonJobDirectory: string;
    readonly excelReportDirectory: string;
    readonly junitDirectory: string;
    readonly playwrightReportDirectory: string;
    readonly artifactsDirectory: string;
    readonly screenshotsDirectory: string;
    readonly allureResultsDirectory: string;
    readonly allureReportDirectory: string;
    readonly evidenceReportFile: string;
    readonly junitFile: string;
}

const RUN_ID_ENV = 'EVIDENCEFACTORY_RUN_ID';

let activeRun: EvidenceRunPaths | undefined;

function validateRunId(runId: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(runId)) {
        throw new Error(
            `Invalid ${RUN_ID_ENV}: "${runId}". ` +
            'Only letters, numbers, underscores and hyphens are allowed.'
        );
    }

    return runId;
}

function createRunPaths(
    resultsRoot: string,
    runId: string
): EvidenceRunPaths {
    const runDirectory = join(resultsRoot, `run-${runId}`);
    const commonJobDirectory = join(runDirectory, 'common-job');
    const excelReportDirectory = join(runDirectory, 'excel-report');
    const junitDirectory = join(runDirectory, 'junit');
    const playwrightReportDirectory = join(runDirectory, 'playwright');
    const artifactsDirectory = join(runDirectory, 'artifacts');
    const allureDirectory = join(runDirectory, 'allure');

    return {
        runId,
        runDirectory,
        commonJobDirectory,
        excelReportDirectory,
        junitDirectory,
        playwrightReportDirectory,
        artifactsDirectory,
        screenshotsDirectory: join(artifactsDirectory, 'screenshots'),
        allureResultsDirectory: join(allureDirectory, 'results'),
        allureReportDirectory: join(allureDirectory, 'report'),
        evidenceReportFile: join(excelReportDirectory, 'evidence-report.xlsx'),
        junitFile: join(junitDirectory, 'results.xml'),
    };
}

/**
 * Initializes a single EvidenceFactory run.
 *
 * The first process creates the run directory.
 * Subsequent phases reuse EVIDENCEFACTORY_RUN_ID.
 */
export function initializeEvidenceRun(): EvidenceRunPaths {
    if (activeRun) {
        return activeRun;
    }

    const resultsRoot = resolve(process.cwd(), 'test-results');
    const inheritedRunId = process.env[RUN_ID_ENV];

    let paths: EvidenceRunPaths;

    if (inheritedRunId !== undefined) {
        const runId = validateRunId(inheritedRunId);
        paths = createRunPaths(resultsRoot, runId);

        mkdirSync(paths.runDirectory, { recursive: true });
    } else {
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, '-');

        mkdirSync(resultsRoot, { recursive: true });

        let counter = 0;

        while (true) {
            const candidate =
                counter === 0 ? timestamp : `${timestamp}-${counter}`;

            const runId = validateRunId(candidate);
            const candidatePaths = createRunPaths(resultsRoot, runId);

            try {
                mkdirSync(candidatePaths.runDirectory);
                paths = candidatePaths;
                break;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                    throw error;
                }

                counter++;
            }
        }

        process.env[RUN_ID_ENV] = paths.runId;
    }

    mkdirSync(paths.commonJobDirectory, { recursive: true });
    mkdirSync(paths.excelReportDirectory, { recursive: true });
    mkdirSync(paths.junitDirectory, { recursive: true });
    mkdirSync(paths.playwrightReportDirectory, { recursive: true });
    mkdirSync(paths.artifactsDirectory, { recursive: true });
    mkdirSync(paths.screenshotsDirectory, { recursive: true });
    mkdirSync(paths.allureResultsDirectory, { recursive: true });

    // Allure HTML report is optional and created when generated.

    activeRun = paths;
    return paths;
}

/**
 * Returns initialized paths without creating directories.
 */
export function getEvidenceRunPaths(): EvidenceRunPaths {
    if (!activeRun) {
        throw new Error(
            'EvidenceFactory has not been initialized. ' +
            'Call initializeEvidenceRun() before accessing run paths.'
        );
    }

    return activeRun;
}
