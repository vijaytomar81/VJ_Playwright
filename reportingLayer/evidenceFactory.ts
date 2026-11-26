import { hostname, userInfo } from 'node:os';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import reportPaths from '../configLayer/execution/reportPaths.json';
import { generateEvidenceExcel, type ExcelEvidenceTest } from './excel/excelGenerator';
import { evidenceFields } from './schema/evidence-schema';
import { summarySchema } from './schema/summary-schema';
import {
    createRunDirectory, copyReports, resolveScreenshot,
} from './evidenceArtifacts';

const { validateReportPaths } = require('../configLayer/execution/validateReportPaths.cjs');

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
 * Resolves native full-page failure screenshots associated with this test.
 * The latest available failure screenshot is linked from Excel.
 */
function failureScreenshot(
    test: JsonTest,
    runDirectory: string,
    copiedScreenshots: Map<string, string>,
): string {
    let screenshot = UNKNOWN;

    for (const result of test.results) {
        for (const attachment of result.attachments ?? []) {
            if (
                attachment.name !== 'screenshot' ||
                attachment.contentType !== 'image/png' ||
                !attachment.path
            ) {
                continue;
            }

            const copiedScreenshot = resolveScreenshot(
                attachment.path, runDirectory, copiedScreenshots,
            );

            if (copiedScreenshot) {
                screenshot = copiedScreenshot;
            }
        }
    }

    return screenshot;
}

function buildTests(
    specs: readonly JsonSpec[],
    runDirectory: string,
    copiedScreenshots: Map<string, string>,
): ExcelEvidenceTest[] {
    return specs.flatMap(spec => spec.tests.map(test => {
        const last = test.results[test.results.length - 1];
        const annotations = annotationsOf(test);
        const status = testStatus(test);

        delete annotations.screenshot;

        const screenshot = failureScreenshot(
            test, runDirectory, copiedScreenshots,
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

export async function generateEvidenceFactory(
    invocationStartedAt?: number,
): Promise<string> {
    validateReportPaths();

    const jsonFile = resolve(reportPaths.json);

    if (
        process.env.EVIDENCEFACTORY_JSON_FILE &&
        resolve(process.env.EVIDENCEFACTORY_JSON_FILE) !== jsonFile
    ) {
        throw new Error(
            `EvidenceFactory: JSON report must use the configured location: ${reportPaths.json}`,
        );
    }

    if (
        process.env.EVIDENCEFACTORY_ALLURE_REPORT_DIR &&
        resolve(process.env.EVIDENCEFACTORY_ALLURE_REPORT_DIR) !== resolve(reportPaths.allureReport)
    ) {
        throw new Error(
            `EvidenceFactory: Allure report must use the configured location: ${reportPaths.allureReport}`,
        );
    }

    if (!existsSync(jsonFile)) {
        throw new Error(`EvidenceFactory: JSON report not found: ${jsonFile}`);
    }

    const report: JsonReport = JSON.parse(readFileSync(jsonFile, 'utf8'));

    if (
        !Array.isArray(report.suites) ||
        !report.stats?.startTime ||
        !Number.isFinite(report.stats.duration) ||
        report.stats.duration < 0
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

    if (Number.isNaN(finishedAt.getTime())) {
        throw new Error('EvidenceFactory: Invalid execution finish time');
    }

    if (
        invocationStartedAt !== undefined &&
        (!Number.isFinite(invocationStartedAt) ||
            statSync(jsonFile).mtimeMs < invocationStartedAt)
    ) {
        throw new Error('EvidenceFactory: Native JSON report is invalid or stale');
    }

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
    const { runId, runDirectory, outputFile } = paths;

    const reportSources = Object.entries(reportPaths)
        .filter(([key]) =>
            key !== 'json' &&
            key !== 'allureReport' &&
            key !== 'evidenceFactoryOutput',
        )
        .map(([, path]) => path);

    if (process.env.EVIDENCEFACTORY_ALLURE_REPORT_DIR) {
        reportSources.push(reportPaths.allureReport);
    }

    // Copy native reports before resolving Excel screenshot hyperlinks.
    copyReports(runDirectory, jsonFile, reportSources, {
        startedAt,
        includeCommonJob: process.env.EVIDENCEFACTORY_INCLUDE_COMMON_JOB === 'true',
    });

    const copiedScreenshots = new Map<string, string>();

    const rows = buildTests(
        specs, runDirectory, copiedScreenshots,
    );

    const passed = rows.filter(row => row.status === 'passed').length;
    const failed = rows.filter(row => row.status === 'failed').length;
    const notExecuted = rows.filter(
        row => row.status === 'notExecuted',
    ).length;

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
