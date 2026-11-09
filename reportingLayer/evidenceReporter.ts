
import type {
    Reporter,
    FullConfig,
    FullResult,
    Suite,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';

import {
    hostname,
    platform,
    release,
    userInfo,
} from 'node:os';

import { join } from 'node:path';

import {
    generateEvidenceExcel,
    type ExcelEvidenceTest,
} from './excelGenerator';

/* ============================================================
 * SCHEMA TYPES
 * ============================================================ */

interface SchemaField {
    readonly field: string;
    readonly label: string;
    readonly order: number;
}

interface SummarySection {
    readonly section: string;
    readonly order: number;
    readonly fields: readonly SchemaField[];
}

/* ============================================================
 * REPORTER OPTIONS
 * ============================================================ */

interface ReporterOptions {
    readonly evidenceSchema: readonly SchemaField[];
    readonly summarySchema: readonly SummarySection[];
    readonly product: string;
    readonly outputDirectory?: string;
}

/* ============================================================
 * INTERNAL TYPES
 * ============================================================ */

interface CollectedTest {
    readonly test: TestCase;
    readonly attempts: TestResult[];
}

interface BrowserMetadata {
    readonly browser: string;
    readonly browserChannel: string;
    readonly browserVersion: string;
    readonly headless: boolean | string;
}

/* ============================================================
 * EVIDENCE REPORTER
 * ============================================================ */

export default class EvidenceReporter implements Reporter {
    private readonly tests = new Map<
        string,
        CollectedTest
    >();

    private config?: FullConfig;
    private startedAt = new Date();

    constructor(
        private readonly options: ReporterOptions,
    ) { }

    /* ========================================================
     * EXECUTION START
     * ======================================================== */

    onBegin(
        config: FullConfig,
        suite: Suite,
    ): void {
        this.config = config;
        this.startedAt = new Date();
        this.tests.clear();

        for (const test of suite.allTests()) {
            this.tests.set(test.id, {
                test,
                attempts: [],
            });
        }

        console.log(
            `EvidenceReporter: ${this.tests.size} test cases discovered`,
        );
    }

    /* ========================================================
     * TEST RESULT COLLECTION
     * ======================================================== */

    onTestEnd(
        test: TestCase,
        result: TestResult,
    ): void {
        const entry = this.tests.get(test.id);

        if (entry) {
            entry.attempts.push(result);
        } else {
            this.tests.set(test.id, {
                test,
                attempts: [result],
            });
        }
    }

    /* ========================================================
     * BROWSER METADATA
     *
     * Uses Playwright project configuration only.
     *
     * Does NOT launch Chromium, Firefox, or WebKit.
     * Does NOT execute browser binaries.
     * ======================================================== */

    private getBrowserMetadata(
        project?: FullConfig['projects'][number],
    ): BrowserMetadata {
        const browser = String(
            project?.use.browserName ?? 'chromium',
        );

        const configuredChannel =
            project?.use.channel;

        const browserChannel =
            configuredChannel &&
                String(configuredChannel).trim()
                ? String(configuredChannel)
                : 'bundled';

        /*
         * Playwright configuration does not expose
         * the actual running browser version.
         *
         * This optional environment variable can
         * be populated by the execution environment.
         *
         * If not provided, leave the field blank
         * rather than launching another browser.
         */
        const browserVersion =
            process.env.PLAYWRIGHT_BROWSER_VERSION ?? '';

        return {
            browser,
            browserChannel,
            browserVersion,
            headless:
                project?.use.headless ?? false,
        };
    }

    /* ========================================================
     * ANNOTATION COLLECTION
     * ======================================================== */

    private getAnnotations(
        entry: CollectedTest,
    ): Record<string, string> {
        const attempts = [
            ...entry.attempts,
        ].reverse();

        const source = attempts.find(
            (attempt) =>
                attempt.annotations.length > 0,
        );

        const annotations: Record<
            string,
            string
        > = {};

        for (
            const annotation of
            source?.annotations ?? []
        ) {
            const key = annotation.type;

            /*
             * Never export sensitive payment
             * or authentication data.
             */
            if (
                /cardnumber|cvv|cvc|securitycode|password|secret|token/i.test(
                    key,
                )
            ) {
                continue;
            }

            annotations[key] =
                annotation.description ?? '';
        }

        return annotations;
    }

    /* ========================================================
     * BUILD EXCEL TEST ROWS
     * ======================================================== */

    private buildTests(): ExcelEvidenceTest[] {
        const rows: ExcelEvidenceTest[] = [];

        /*
         * Cache browser metadata for each
         * configured Playwright project.
         *
         * No browser process is started.
         */
        const browserMetadata = new Map<
            string,
            BrowserMetadata
        >();

        for (
            const entry of this.tests.values()
        ) {
            const attempts = entry.attempts;

            const last =
                attempts[attempts.length - 1];

            let status:
                ExcelEvidenceTest['status'];

            if (
                !last ||
                last.status === 'skipped' ||
                last.status === 'interrupted'
            ) {
                status = 'notExecuted';
            } else if (
                last.status === 'passed'
            ) {
                status = 'passed';
            } else {
                status = 'failed';
            }

            const started =
                attempts[0]?.startTime;

            const finished = last
                ? new Date(
                    last.startTime.getTime() +
                    last.duration,
                )
                : undefined;

            const durationMs =
                attempts.reduce(
                    (sum, attempt) =>
                        sum + attempt.duration,
                    0,
                );

            const project =
                entry.test.parent.project();

            const projectName =
                project?.name ?? 'chromium';

            let metadata =
                browserMetadata.get(
                    projectName,
                );

            if (!metadata) {
                metadata =
                    this.getBrowserMetadata(
                        project,
                    );

                browserMetadata.set(
                    projectName,
                    metadata,
                );
            }

            const values: Record<
                string,
                unknown
            > = {
                scenarioId:
                    entry.test.id,

                scenarioName:
                    entry.test.title,

                status,

                retry:
                    last?.retry ?? 0,

                attempt:
                    last?.retry ?? 0,

                workerId:
                    last?.workerIndex ?? '',

                startTime:
                    started?.toISOString() ?? '',

                endTime:
                    finished?.toISOString() ?? '',

                durationMs,

                error:
                    last?.errors
                        .map(
                            (error) =>
                                error.stack ??
                                error.message ??
                                '',
                        )
                        .filter(Boolean)
                        .join('\n') ?? '',

                mode:
                    process.env.CI === 'true'
                        ? 'CI'
                        : 'Local',

                device:
                    projectName,

                browser:
                    metadata.browser,

                browserChannel:
                    metadata.browserChannel,

                browserVersion:
                    metadata.browserVersion,

                headless:
                    String(metadata.headless),
            };

            rows.push({
                testId:
                    entry.test.id,

                testName:
                    entry.test.title,

                status,

                retry:
                    last?.retry ?? 0,

                annotations:
                    this.getAnnotations(
                        entry,
                    ),

                values,
            });
        }

        return rows;
    }

    /* ========================================================
     * EXECUTION END
     * ======================================================== */

    async onEnd(
        _result: FullResult,
    ): Promise<void> {
        const finishedAt = new Date();

        const rows =
            this.buildTests();

        const passed =
            rows.filter(
                (row) =>
                    row.status === 'passed',
            ).length;

        const failed =
            rows.filter(
                (row) =>
                    row.status === 'failed',
            ).length;

        const notExecuted =
            rows.filter(
                (row) =>
                    row.status === 'notExecuted',
            ).length;

        const totalItems =
            rows.length;

        const elapsedMs =
            finishedAt.getTime() -
            this.startedAt.getTime();

        const projectName =
            process.env.PROJECT ??
            this.config?.projects[0]?.name ??
            'unknown';

        const browserProject =
            this.config?.projects[0];

        const browserMetadata =
            this.getBrowserMetadata(
                browserProject,
            );

        const runId =
            this.startedAt
                .toISOString()
                .replace(/[:.]/g, '-');

        const outputDirectory =
            this.options.outputDirectory ??
            join(
                process.cwd(),
                'custom-test-reports',
                `run-${runId}`,
            );

        /* ====================================================
         * SUMMARY DATA
         * ==================================================== */

        const summaryData: Record<
            string,
            unknown
        > = {
            runId,

            mode:
                process.env.CI === 'true'
                    ? 'CI'
                    : 'Local',

            environment:
                process.env.ENV ?? '',

            evidenceDirectory:
                outputDirectory,

            machineName:
                hostname(),

            user:
                userInfo().username,

            platform:
                platform(),

            osVersion:
                release(),

            browser:
                browserMetadata.browser,

            browserChannel:
                browserMetadata.browserChannel,

            browserVersion:
                browserMetadata.browserVersion,

            headless:
                browserMetadata.headless,

            totalItems,

            passed,

            failed,

            notExecuted,

            passRate:
                totalItems > 0
                    ? Number(
                        (
                            (passed / totalItems) *
                            100
                        ).toFixed(2),
                    )
                    : 0,

            executionTime:
                elapsedMs,

            startedAt:
                this.startedAt.toISOString(),

            finishedAt:
                finishedAt.toISOString(),
        };

        /* ====================================================
         * GENERATE EXCEL REPORT
         * ==================================================== */

        await generateEvidenceExcel({
            outputDirectory,

            project:
                projectName,

            product:
                this.options.product,

            evidenceSchema:
                this.options.evidenceSchema,

            summarySchema:
                this.options.summarySchema,

            summaryData,

            tests:
                rows,
        });

        console.log(
            `EvidenceReporter: ${passed} passed, ` +
            `${failed} failed, ` +
            `${notExecuted} not executed`,
        );
    }
}
