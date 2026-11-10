
import type {
    Reporter, FullConfig, FullResult, Suite, TestCase, TestResult,
} from '@playwright/test/reporter';

import { hostname, platform, release, userInfo } from 'node:os';
import { join } from 'node:path';
import { generateEvidenceExcel, type ExcelEvidenceTest } from './excelGenerator';

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

type Project = FullConfig['projects'][number];
type BrowserField = 'browser' | 'browserChannel' | 'browserVersion' | 'headless';

const UNKNOWN = 'Not Known';
const SENSITIVE = /cardnumber|cvv|cvc|securitycode|password|secret|token/i;

const known = (value: unknown): string =>
    value === undefined || value === null || String(value).trim() === ''
        ? UNKNOWN
        : String(value).trim();

function firstKnown(...values: unknown[]): string {
    return values.map(known).find(value => value !== UNKNOWN) ?? UNKNOWN;
}

function duration(milliseconds: number): string {
    const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:` +
        `${String(seconds % 60).padStart(2, '0')}`;
}

function annotationsOf(results: readonly TestResult[]): Record<string, string> {
    const annotations: Record<string, string> = {};

    for (const result of results) {
        for (const annotation of result.annotations) {
            if (SENSITIVE.test(annotation.type)) continue;

            const value = annotation.description ?? '';
            const previous = annotations[annotation.type];

            if (
                value !== UNKNOWN ||
                previous === undefined ||
                previous === UNKNOWN
            ) {
                annotations[annotation.type] = value;
            }
        }
    }

    return annotations;
}

function browserMetadata(
    project: Project | undefined,
    annotations: Readonly<Record<string, string>>,
) {
    const use = project?.use;
    const channel = firstKnown(annotations.browserChannel, use?.channel);

    return {
        browser: firstKnown(annotations.browser, use?.browserName),
        browserChannel: channel === UNKNOWN && project
            ? 'Not Specified'
            : channel,
        browserVersion: firstKnown(annotations.browserVersion),
        viewport: firstKnown(annotations.viewport),
        headless: known(use?.headless),
        device: use?.isMobile === true ? 'Mobile (Emulated)' :
            use?.isMobile === false ? 'Desktop (Emulated Profile)' : UNKNOWN,
    };
}

function summaryValue(
    rows: readonly ExcelEvidenceTest[],
    field: BrowserField,
): string {
    const values = new Set(
        rows.map(row => known(row.values[field]))
            .filter(value => value !== UNKNOWN),
    );

    return values.size > 1
        ? 'Multiple'
        : values.values().next().value ?? UNKNOWN;
}

export default class EvidenceReporter implements Reporter {
    private readonly tests = new Map<
        string, { test: TestCase; results: TestResult[] }
    >();

    private config?: FullConfig;
    private startedAt = new Date();

    constructor(private readonly options: ReporterOptions) { }

    onBegin(config: FullConfig, suite: Suite): void {
        this.config = config;
        this.startedAt = new Date();
        this.tests.clear();

        for (const test of suite.allTests()) {
            this.tests.set(test.id, { test, results: [] });
        }

        console.log(`EvidenceReporter: ${this.tests.size} test cases discovered`);
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const existing = this.tests.get(test.id);

        if (existing) existing.results.push(result);
        else this.tests.set(test.id, { test, results: [result] });
    }

    private buildTests(): ExcelEvidenceTest[] {
        return [...this.tests.values()].map(({ test, results }) => {
            const last = results[results.length - 1];
            const annotations = annotationsOf(results);

            // Collect screenshots from all test attempts, including retries.
            const screenshots = results
                .flatMap(result => result.attachments)
                .filter(attachment =>
                    attachment.contentType === 'image/png' &&
                    attachment.path,
                )
                .map(attachment => attachment.path!);

            const metadata = browserMetadata(test.parent.project(), annotations);

            const status: ExcelEvidenceTest['status'] =
                !last || last.status === 'skipped' || last.status === 'interrupted'
                    ? 'notExecuted'
                    : last.status === 'passed' ? 'passed' : 'failed';

            const retry = last?.retry ?? 0;
            const totalDuration = results.reduce(
                (sum, result) => sum + result.duration, 0,
            );

            const finishedAt = last
                ? new Date(last.startTime.getTime() + last.duration)
                : undefined;

            return {
                testId: test.id,
                testName: test.title,
                status,
                retry,
                annotations,
                values: {
                    ...annotations,
                    scenarioId: annotations.scenarioId || test.id,
                    scenarioName: test.title,
                    status,
                    retry,
                    attempt: retry,
                    workerId: last?.workerIndex ?? UNKNOWN,
                    startTime: results[0]?.startTime.toISOString() ?? UNKNOWN,
                    endTime: finishedAt?.toISOString() ?? UNKNOWN,
                    duration: duration(totalDuration),
                    error: last?.errors
                        .map(error => error.stack ?? error.message ?? '')
                        .filter(Boolean)
                        .join('\n') ?? '',
                    screenshot: screenshots.join('\n'),
                    mode: process.env.CI === 'true' ? 'CI' : 'Local',
                    ...metadata,
                },
            };
        });
    }

    async onEnd(_result: FullResult): Promise<void> {
        const finishedAt = new Date();
        const rows = this.buildTests();

        const passed = rows.filter(row => row.status === 'passed').length;
        const failed = rows.filter(row => row.status === 'failed').length;
        const notExecuted = rows.filter(
            row => row.status === 'notExecuted',
        ).length;

        const runId = this.startedAt.toISOString().replace(/[:.]/g, '-');
        const outputDirectory = this.options.outputDirectory ??
            join(process.cwd(), 'custom-test-reports', `run-${runId}`);

        const browserFields: BrowserField[] = [
            'browser',
            'browserChannel',
            'browserVersion',
            'headless',
        ];

        const summaryData: Record<string, unknown> = {
            runId,
            mode: process.env.CI === 'true' ? 'CI' : 'Local',
            environment: known(process.env.ENV),
            evidenceDirectory: outputDirectory,
            machineName: hostname(),
            user: userInfo().username,
            platform: platform(),
            osVersion: release(),
            totalItems: rows.length,
            passed,
            failed,
            notExecuted,
            passRate: rows.length
                ? Number(((passed / rows.length) * 100).toFixed(2))
                : 0,
            executionTime: duration(
                finishedAt.getTime() - this.startedAt.getTime(),
            ),
            startedAt: this.startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
        };

        for (const field of browserFields) {
            summaryData[field] = summaryValue(rows, field);
        }

        await generateEvidenceExcel({
            outputDirectory,
            project: known(
                process.env.PROJECT ?? this.config?.projects[0]?.name,
            ),
            product: this.options.product,
            evidenceSchema: this.options.evidenceSchema,
            summarySchema: this.options.summarySchema,
            summaryData,
            tests: rows,
        });

        console.log(
            `EvidenceReporter: ${passed} passed, ` +
            `${failed} failed, ${notExecuted} not executed`,
        );
    }
}
