import { hostname, userInfo } from 'node:os';
import {
    existsSync, statSync, mkdirSync, readFileSync, copyFileSync, cpSync,
} from 'node:fs';
import { basename, join, resolve, relative, isAbsolute } from 'node:path';

import { generateEvidenceExcel, type ExcelEvidenceTest } from './excelGenerator';
import { evidenceFields } from '../../configLayer/evidenceFactory/schema/evidence-schema';
import { summarySchema } from '../../configLayer/evidenceFactory/schema/summary-schema';

interface Annotation {
    type: string;
    description?: string;
}

interface Attachment {
    name: string;
    contentType: string;
    path?: string;
    body?: string;
}

interface JsonResult {
    retry: number;
    workerIndex: number;
    status: string;
    startTime: string;
    duration: number;
    error?: { message?: string };
    errors?: { message?: string }[];
    annotations?: Annotation[];
    attachments?: Attachment[];
}

interface JsonTest {
    projectId: string;
    projectName: string;
    status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
    annotations?: Annotation[];
    results: JsonResult[];
}

interface JsonSpec {
    id: string;
    title: string;
    tests: JsonTest[];
}

interface JsonSuite {
    specs?: JsonSpec[];
    suites?: JsonSuite[];
}

interface JsonReport {
    suites: JsonSuite[];
    stats: {
        startTime: string;
        duration: number;
    };
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

function toPascalCase(value: string): string {
    return value.trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
}

/**
 * Generates a timestamp using the execution machine's local time.
 */
function localTimestamp(date: Date): string {
    const pad = (value: number, length = 2): string =>
        String(value).padStart(length, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
        `${pad(date.getDate())}T${pad(date.getHours())}-` +
        `${pad(date.getMinutes())}-${pad(date.getSeconds())}-` +
        `${pad(date.getMilliseconds(), 3)}`;
}

/**
 * Creates the EvidenceFactory directory after Playwright has completed.
 */
function createRunDirectory(project: string, startedAt: Date) {
    const resultsRoot = resolve(process.cwd(), 'test-results');
    const prefix = toPascalCase(project) || 'Evidence';
    const timestamp = localTimestamp(startedAt);

    mkdirSync(resultsRoot, { recursive: true });

    let counter = 0;

    while (true) {
        const runId = counter === 0
            ? timestamp
            : `${timestamp}-${counter}`;

        const runDirectory = join(resultsRoot, `${prefix}-run-${runId}`);

        try {
            mkdirSync(runDirectory);

            const excelDirectory = join(runDirectory, 'excel-report');
            const screenshotsDirectory = join(
                runDirectory, 'artifacts', 'screenshots',
            );

            mkdirSync(excelDirectory, { recursive: true });
            mkdirSync(screenshotsDirectory, { recursive: true });

            return {
                runId,
                runDirectory,
                excelDirectory,
                screenshotsDirectory,
                outputFile: join(excelDirectory, `${prefix}-report.xlsx`),
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }

            counter++;
        }
    }
}

function collectSpecs(suites: readonly JsonSuite[]): JsonSpec[] {
    return suites.flatMap(suite => [
        ...(suite.specs ?? []),
        ...collectSpecs(suite.suites ?? []),
    ]);
}

function annotationsOf(test: JsonTest): Record<string, string> {
    const annotations: Record<string, string> = Object.create(null);

    for (const annotation of [
        ...(test.annotations ?? []),
        ...test.results.flatMap(result => result.annotations ?? []),
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
    annotations: Readonly<Record<string, string>>,
    execution: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
    const values: Record<string, unknown> = {};

    for (const { field } of evidenceFields) {
        if (SENSITIVE.test(field)) continue;

        values[field] = known(
            execution[field] ?? annotations[field],
        );
    }

    return values;
}

function testStatus(test: JsonTest): ExcelEvidenceTest['status'] {
    if (!test.results.length) return 'notExecuted';

    if (test.status === 'expected' || test.status === 'flaky') {
        return 'passed';
    }

    if (test.status === 'skipped') return 'notExecuted';

    return 'failed';
}

/**
 * Copies full-page failure screenshots associated with this test.
 * The latest available failure screenshot is linked from Excel.
 */
function copyScreenshots(
    test: JsonTest,
    excelDirectory: string,
    screenshotsDirectory: string,
): string {
    let screenshot = UNKNOWN;

    for (const result of test.results) {
        for (const attachment of result.attachments ?? []) {
            if (
                !attachment.name.startsWith('full-page-failure:') ||
                attachment.contentType !== 'image/png' ||
                !attachment.path
            ) {
                continue;
            }

            const filename = attachment.name.slice(
                'full-page-failure:'.length,
            );

            if (!/^failure-[a-zA-Z0-9_-]+\.png$/.test(filename)) {
                continue;
            }

            const source = isAbsolute(attachment.path)
                ? attachment.path
                : resolve(process.cwd(), attachment.path);

            if (!existsSync(source) || !statSync(source).isFile()) {
                console.warn(
                    `EvidenceFactory: Screenshot not found: ${source}`,
                );
                continue;
            }

            const destination = join(screenshotsDirectory, filename);

            copyFileSync(source, destination);

            screenshot = relative(excelDirectory, destination)
                .replace(/\\/g, '/');
        }
    }

    return screenshot;
}

function buildTests(
    specs: readonly JsonSpec[],
    excelDirectory: string,
    screenshotsDirectory: string,
): ExcelEvidenceTest[] {
    return specs.flatMap(spec => spec.tests.map(test => {
        const last = test.results[test.results.length - 1];
        const annotations = annotationsOf(test);
        const status = testStatus(test);

        delete annotations.screenshot;

        const screenshot = copyScreenshots(
            test, excelDirectory, screenshotsDirectory,
        );

        if (screenshot) {
            annotations.screenshot = screenshot;
        }

        const execution: Record<string, unknown> = {
            scenarioName: spec.title,
            testName: spec.title,
            status,
            retry: last?.retry ?? 0,
            workerId: last?.workerIndex,
            workerIndex: last?.workerIndex,
            startTime: last?.startTime,
            endTime: last?.startTime
                ? new Date(
                    new Date(last.startTime).getTime() + last.duration,
                ).toISOString()
                : undefined,
            duration: last ? duration(last.duration) : undefined,
            error: last?.error?.message ?? last?.errors?.[0]?.message,
            executionMode: process.env.CI === 'true' ? 'CI' : 'Local',
        };

        return {
            testId: `${spec.id}:${test.projectId}`,
            testName: spec.title,
            status,
            retry: last?.retry ?? 0,
            annotations,
            values: evidenceValues(annotations, execution),
        };
    }));
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

/**
 * Copies existing native reports without modifying their original files.
 */
function copyReport(source: string, destination: string): void {
    if (!existsSync(source)) return;

    if (statSync(source).isDirectory()) {
        cpSync(source, destination, { recursive: true });
    } else {
        mkdirSync(destination, { recursive: true });
        copyFileSync(source, join(destination, basename(source)));
    }
}

export async function generateEvidenceFactory(): Promise<string> {
    const jsonFile = resolve(
        process.env.EVIDENCEFACTORY_JSON_FILE || 'results.json',
    );

    if (!existsSync(jsonFile)) {
        throw new Error(`EvidenceFactory: JSON report not found: ${jsonFile}`);
    }

    const report: JsonReport = JSON.parse(readFileSync(jsonFile, 'utf8'));

    if (
        !Array.isArray(report.suites) ||
        !report.stats?.startTime ||
        !Number.isFinite(report.stats.duration)
    ) {
        throw new Error('EvidenceFactory: Invalid Playwright JSON report');
    }

    const startedAt = new Date(report.stats.startTime);

    if (Number.isNaN(startedAt.getTime())) {
        throw new Error('EvidenceFactory: Invalid execution start time');
    }

    const finishedAt = new Date(
        startedAt.getTime() + report.stats.duration,
    );

    const specs = collectSpecs(report.suites);

    const projects = [...new Set(
        specs.flatMap(spec => spec.tests.map(test => test.projectName))
            .filter(Boolean),
    )];

    const project = known(
        process.env.EVIDENCEFACTORY_PROJECT ||
        process.env.PROJECT ||
        (projects.length > 1 ? 'Insurance' : projects[0]),
    );

    const product = known(process.env.PRODUCT);
    const paths = createRunDirectory(project, startedAt);

    const rows = buildTests(
        specs, paths.excelDirectory, paths.screenshotsDirectory,
    );

    const passed = rows.filter(row => row.status === 'passed').length;
    const failed = rows.filter(row => row.status === 'failed').length;
    const notExecuted = rows.filter(
        row => row.status === 'notExecuted',
    ).length;

    const { runId, runDirectory, outputFile } = paths;

    const summaryData: Record<string, unknown> = {
        runId,
        mode: process.env.CI === 'true' ? 'CI' : 'Local',
        environment: known(process.env.ENV),
        evidenceDirectory: runDirectory,
        machineName: hostname(),
        user: userInfo().username,
        totalItems: rows.length,
        passed,
        failed,
        notExecuted,
        passRate: rows.length
            ? Number(((passed / rows.length) * 100).toFixed(2))
            : 0,
        executionTime: duration(report.stats.duration),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
    };

    for (const section of summarySchema) {
        for (const { field } of section.fields) {
            if (SENSITIVE.test(field) || field in summaryData) continue;
            summaryData[field] = summaryValue(rows, field);
        }
    }

    await generateEvidenceExcel({
        outputFile,
        project,
        product,
        evidenceSchema: evidenceFields,
        summarySchema,
        summaryData,
        tests: rows,
    });

    copyReport('playwright-report', join(runDirectory, 'playwright'));
    copyReport('results.xml', join(runDirectory, 'junit'));
    copyReport('allure-results', join(runDirectory, 'allure', 'results'));
    copyReport('common-job', join(runDirectory, 'common-job'));

    if (process.env.EVIDENCEFACTORY_ALLURE_REPORT_DIR) {
        copyReport(
            process.env.EVIDENCEFACTORY_ALLURE_REPORT_DIR,
            join(runDirectory, 'allure', 'report'),
        );
    }

    console.log(
        `EvidenceFactory: ${passed} passed, ` +
        `${failed} failed, ${notExecuted} not executed`,
    );

    console.log(`EvidenceFactory: Excel report: ${outputFile}`);

    return outputFile;
}

if (require.main === module) {
    generateEvidenceFactory().catch(error => {
        console.error('EvidenceFactory: Report generation failed:', error);
        process.exitCode = 1;
    });
}