import type {
    Reporter, FullConfig, FullResult, Suite, TestCase, TestResult,
} from '@playwright/test/reporter';

import { hostname, platform, release, userInfo } from 'node:os';
import { existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
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
    readonly runId: string;
    readonly runDirectory: string;
    readonly outputFile: string;
}

const UNKNOWN = '';
const SENSITIVE = /card.?number|card.?no|cvv|cvc|security.?code|password|secret|token|authorization|api.?key|access.?key|private.?key/i;

const known = (value: unknown): string =>
    value === undefined || value === null || String(value).trim() === ''
        ? UNKNOWN
        : String(value).trim();

function duration(milliseconds: number): string {
    const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:` +
        `${String(seconds % 60).padStart(2, '0')}`;
}

function annotationsOf(
    test: TestCase,
    results: readonly TestResult[],
): Record<string, string> {
    const annotations: Record<string, string> = {};

    for (const annotation of [
        ...test.annotations,
        ...results.flatMap(result => result.annotations),
    ]) {
        if (SENSITIVE.test(annotation.type)) continue;

        const value = annotation.description ?? '';
        const previous = annotations[annotation.type];

        if (
            (value.trim() !== '' && value !== UNKNOWN) ||
            previous === undefined
        ) {
            annotations[annotation.type] = value;
        }
    }

    return annotations;
}

function evidenceValues(
    schema: readonly SchemaField[],
    annotations: Readonly<Record<string, string>>,
    execution: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
    const values: Record<string, unknown> = {};

    for (const { field } of schema) {
        if (SENSITIVE.test(field)) continue;

        values[field] = known(
            execution[field] ?? annotations[field],
        );
    }

    return values;
}

function testStatus(
    test: TestCase,
    results: readonly TestResult[],
): ExcelEvidenceTest['status'] {
    if (!results.length) return 'notExecuted';

    const outcome = test.outcome();

    if (outcome === 'expected' || outcome === 'flaky') return 'passed';
    if (outcome === 'skipped') return 'notExecuted';

    return 'failed';
}

function summaryValue(
    rows: readonly ExcelEvidenceTest[],
    field: string,
): string {
    const values = new Set(
        rows.map(row => known(row.annotations[field]))
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

    constructor(private readonly options: ReporterOptions) {
        if (!options.runId?.trim()) {
            throw new Error(
                'EvidenceReporter: runId must be supplied by Playwright configuration',
            );
        }

        if (!options.runDirectory?.trim()) {
            throw new Error(
                'EvidenceReporter: runDirectory must be supplied by Playwright configuration',
            );
        }

        if (!options.outputFile?.trim()) {
            throw new Error(
                'EvidenceReporter: outputFile must be supplied by Playwright configuration',
            );
        }
    }

    onBegin(config: FullConfig, suite: Suite): void {
        this.config = config;
        this.startedAt = new Date();
        this.tests.clear();

        const excelDirectory = dirname(this.options.outputFile);

        if (
            !existsSync(excelDirectory) ||
            !statSync(excelDirectory).isDirectory()
        ) {
            throw new Error(
                'EvidenceReporter: Excel directory does not exist: ' +
                excelDirectory,
            );
        }

        for (const test of suite.allTests()) {
            this.tests.set(test.id, { test, results: [] });
        }

        console.log(
            `EvidenceReporter: ${this.tests.size} test cases discovered`,
        );
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const existing = this.tests.get(test.id);

        if (existing) existing.results.push(result);
        else this.tests.set(test.id, { test, results: [result] });
    }

    private buildTests(): ExcelEvidenceTest[] {
        return [...this.tests.values()].map(({ test, results }) => {
            const last = results[results.length - 1];
            const annotations = annotationsOf(test, results);
            const status = testStatus(test, results);

            const execution: Record<string, unknown> = {
                scenarioName: test.title,
                testName: test.title,
                status,
                retry: last?.retry ?? 0,
                workerId: last?.workerIndex,
                workerIndex: last?.workerIndex,
                startTime: last?.startTime?.toISOString(),
                endTime: last?.startTime
                    ? new Date(
                        last.startTime.getTime() + last.duration,
                    ).toISOString()
                    : undefined,
                duration: last ? duration(last.duration) : undefined,
                error: last?.error?.message,
                executionMode: process.env.CI === 'true' ? 'CI' : 'Local',
            };

            const values = evidenceValues(
                this.options.evidenceSchema,
                annotations,
                execution,
            );

            return {
                testId: test.id,
                testName: test.title,
                status,
                retry: last?.retry ?? 0,
                annotations,
                values,
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

        const { runId, runDirectory, outputFile } = this.options;

        const summaryData: Record<string, unknown> = {
            runId,
            mode: process.env.CI === 'true' ? 'CI' : 'Local',
            environment: known(process.env.ENV),
            evidenceDirectory: runDirectory,
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

        for (const section of this.options.summarySchema) {
            for (const { field } of section.fields) {
                if (SENSITIVE.test(field) || field in summaryData) continue;
                summaryData[field] = summaryValue(rows, field);
            }
        }

        await generateEvidenceExcel({
            outputFile,
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

        console.log(
            `EvidenceReporter: Excel report: ${outputFile}`,
        );
    }
}
