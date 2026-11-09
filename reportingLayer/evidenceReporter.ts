
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

interface ReporterOptions {
    readonly evidenceSchema: readonly SchemaField[];
    readonly summarySchema: readonly SummarySection[];
    readonly product: string;
    readonly outputDirectory?: string;
}

interface CollectedTest {
    readonly test: TestCase;
    readonly attempts: TestResult[];
}

interface BrowserMetadata {
    readonly browser: string;
    readonly browserChannel: string;
    readonly browserVersion: string;
    readonly headless: string;
    readonly device: string;
}

const NOT_KNOWN = 'Not Known';

const SENSITIVE_FIELD =
    /cardnumber|cvv|cvc|securitycode|password|secret|token/i;

function known(value: unknown): string {
    if (value === undefined || value === null) {
        return NOT_KNOWN;
    }

    const text = String(value).trim();

    return text || NOT_KNOWN;
}

function formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(
        Math.max(0, milliseconds) / 1000,
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getStatus(
    result?: TestResult,
): ExcelEvidenceTest['status'] {
    if (
        !result ||
        result.status === 'skipped' ||
        result.status === 'interrupted'
    ) {
        return 'notExecuted';
    }

    return result.status === 'passed'
        ? 'passed'
        : 'failed';
}

function getAnnotations(
    attempts: readonly TestResult[],
): Record<string, string> {
    const annotations: Record<string, string> = {};

    for (const attempt of attempts) {
        for (const annotation of attempt.annotations) {
            const key = annotation.type;

            if (SENSITIVE_FIELD.test(key)) {
                continue;
            }

            annotations[key] = annotation.description ?? '';
        }
    }

    return annotations;
}

function getBrowserMetadata(
    project?: FullConfig['projects'][number],
    annotations: Record<string, string> = {},
): BrowserMetadata {
    const use = project?.use;

    const browser = known(use?.browserName);
    const browserChannel = known(use?.channel);
    const browserVersion = known(annotations.browserVersion);
    const headless = known(use?.headless);

    let device = NOT_KNOWN;

    if (use?.isMobile === true) {
        device = 'Mobile (Emulated)';
    } else if (use?.isMobile === false) {
        device = 'Desktop (Emulated Profile)';
    }

    return {
        browser,
        browserChannel,
        browserVersion,
        headless,
        device,
    };
}

function getError(result?: TestResult): string {
    return (
        result?.errors
            .map(error => error.stack ?? error.message ?? '')
            .filter(Boolean)
            .join('\n') ?? ''
    );
}

export default class EvidenceReporter implements Reporter {
    private readonly tests = new Map<string, CollectedTest>();

    private config?: FullConfig;
    private startedAt = new Date();

    constructor(
        private readonly options: ReporterOptions,
    ) { }

    onBegin(config: FullConfig, suite: Suite): void {
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

    onTestEnd(test: TestCase, result: TestResult): void {
        const entry = this.tests.get(test.id);

        if (entry) {
            entry.attempts.push(result);
            return;
        }

        this.tests.set(test.id, {
            test,
            attempts: [result],
        });
    }

    private buildTests(): ExcelEvidenceTest[] {
        const rows: ExcelEvidenceTest[] = [];

        for (const entry of this.tests.values()) {
            const { test, attempts } = entry;
            const last = attempts[attempts.length - 1];

            const status = getStatus(last);
            const annotations = getAnnotations(attempts);
            const project = test.parent.project();

            const metadata = getBrowserMetadata(
                project,
                annotations,
            );

            const started = attempts[0]?.startTime;

            const finished = last
                ? new Date(
                    last.startTime.getTime() + last.duration,
                )
                : undefined;

            const durationMs = attempts.reduce(
                (sum, attempt) => sum + attempt.duration,
                0,
            );

            const retry = last?.retry ?? 0;

            const values: Record<string, unknown> = {
                scenarioId: test.id,
                scenarioName: test.title,
                status,
                retry,
                attempt: retry,
                workerId: last?.workerIndex ?? NOT_KNOWN,
                startTime: started?.toISOString() ?? NOT_KNOWN,
                endTime: finished?.toISOString() ?? NOT_KNOWN,
                durationMs: formatDuration(durationMs),
                error: getError(last),
                mode: process.env.CI === 'true' ? 'CI' : 'Local',
                device: metadata.device,
                browser: metadata.browser,
                browserChannel: metadata.browserChannel,
                browserVersion: metadata.browserVersion,
                headless: metadata.headless,
            };

            rows.push({
                testId: test.id,
                testName: test.title,
                status,
                retry,
                annotations,
                values,
            });
        }

        return rows;
    }

    private getSummaryBrowserMetadata(
        rows: readonly ExcelEvidenceTest[],
    ): BrowserMetadata {
        const project = this.config?.projects[0];

        const versions = [
            ...new Set(
                rows
                    .map(row => known(row.annotations.browserVersion))
                    .filter(value => value !== NOT_KNOWN),
            ),
        ];

        const metadata = getBrowserMetadata(project);

        return {
            ...metadata,
            browserVersion:
                versions.length === 1
                    ? versions[0]
                    : versions.length > 1
                        ? 'Multiple'
                        : NOT_KNOWN,
        };
    }

    async onEnd(_result: FullResult): Promise<void> {
        const finishedAt = new Date();
        const rows = this.buildTests();

        const passed = rows.filter(
            row => row.status === 'passed',
        ).length;

        const failed = rows.filter(
            row => row.status === 'failed',
        ).length;

        const notExecuted = rows.filter(
            row => row.status === 'notExecuted',
        ).length;

        const totalItems = rows.length;

        const elapsedMs =
            finishedAt.getTime() - this.startedAt.getTime();

        const projectName = known(
            process.env.PROJECT ?? this.config?.projects[0]?.name,
        );

        const browserMetadata =
            this.getSummaryBrowserMetadata(rows);

        const runId = this.startedAt
            .toISOString()
            .replace(/[:.]/g, '-');

        const outputDirectory =
            this.options.outputDirectory ??
            join(
                process.cwd(),
                'custom-test-reports',
                `run-${runId}`,
            );

        const summaryData: Record<string, unknown> = {
            runId,
            mode: process.env.CI === 'true' ? 'CI' : 'Local',
            environment: known(process.env.ENV),
            evidenceDirectory: outputDirectory,
            machineName: hostname(),
            user: userInfo().username,
            platform: platform(),
            osVersion: release(),
            browser: browserMetadata.browser,
            browserChannel: browserMetadata.browserChannel,
            browserVersion: browserMetadata.browserVersion,
            headless: browserMetadata.headless,
            totalItems,
            passed,
            failed,
            notExecuted,
            passRate:
                totalItems > 0
                    ? Number(((passed / totalItems) * 100).toFixed(2))
                    : 0,
            executionTime: formatDuration(elapsedMs),
            startedAt: this.startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
        };

        await generateEvidenceExcel({
            outputDirectory,
            project: projectName,
            product: this.options.product,
            evidenceSchema: this.options.evidenceSchema,
            summarySchema: this.options.summarySchema,
            summaryData,
            tests: rows,
        });

        console.log(
            `EvidenceReporter: ${passed} passed, ` +
            `${failed} failed, ` +
            `${notExecuted} not executed`,
        );
    }
}
