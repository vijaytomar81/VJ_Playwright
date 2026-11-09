
import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { findMissingReportingFields } from './missingFields';

import {
    styleSummaryLayout,
    styleTitle,
    styleTableHeader,
    styleDataRow,
    styleStatusCell,
    styleSummarySection,
    styleSummaryField,
    styleSummaryResult,
    styleWorksheetTab,
    setColumnWidths,
} from './excelStyles';

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

export interface ExcelEvidenceTest {
    readonly testId: string;
    readonly testName: string;
    readonly status: 'passed' | 'failed' | 'notExecuted';
    readonly retry: number;
    readonly annotations: Readonly<Record<string, string>>;
    readonly values: Readonly<Record<string, unknown>>;
}

export interface ExcelGenerationOptions {
    readonly outputDirectory: string;
    readonly project: string;
    readonly product: string;
    readonly evidenceSchema: readonly SchemaField[];
    readonly summarySchema: readonly SummarySection[];
    readonly summaryData: Readonly<Record<string, unknown>>;
    readonly tests: readonly ExcelEvidenceTest[];
}

/* ============================================================
 * VALUE CONVERSION
 * ============================================================ */

function excelValue(value: unknown): ExcelJS.CellValue {
    if (value === null || value === undefined) return '';

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value instanceof Date
    ) {
        return value;
    }

    return JSON.stringify(value);
}

/* ============================================================
 * SCHEMA ORDERING
 * ============================================================ */

function orderedFields(
    fields: readonly SchemaField[],
): SchemaField[] {
    return [...fields].sort((a, b) => a.order - b.order);
}

/* ============================================================
 * DATE AND DURATION FORMATTING
 * ============================================================ */

function formatDateTime(value: unknown): string {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '';
    }

    const date = value instanceof Date
        ? value
        : new Date(String(value));

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const day = String(date.getDate()).padStart(2, '0');

    const month = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ][date.getMonth()];

    const year = date.getFullYear();

    const hours = String(
        date.getHours(),
    ).padStart(2, '0');

    const minutes = String(
        date.getMinutes(),
    ).padStart(2, '0');

    const seconds = String(
        date.getSeconds(),
    ).padStart(2, '0');

    return (
        `${day}-${month}-${year} ` +
        `${hours}:${minutes}:${seconds}`
    );
}

function formatDuration(value: unknown): string {
    if (typeof value === 'number') {
        const totalSeconds = Math.floor(value / 1000);

        const hours = Math.floor(
            totalSeconds / 3600,
        );

        const minutes = Math.floor(
            (totalSeconds % 3600) / 60,
        );

        const seconds = totalSeconds % 60;

        return [hours, minutes, seconds]
            .map((part) =>
                String(part).padStart(2, '0'),
            )
            .join(':');
    }

    if (typeof value === 'string') {
        const secondsMatch = value.match(
            /^([\d.]+)\s+seconds?$/i,
        );

        if (secondsMatch) {
            return formatDuration(
                Number(secondsMatch[1]) * 1000,
            );
        }
    }

    return String(value ?? '');
}

/* ============================================================
 * SUMMARY VALUE FORMATTING
 *
 * Only data conversion is handled here.
 * Excel cell styling is handled by excelStyles.ts.
 * ============================================================ */

function formatSummaryValue(
    field: string,
    value: unknown,
): ExcelJS.CellValue {
    switch (field) {
        case 'startedAt':
        case 'finishedAt':
            return formatDateTime(value);

        case 'executionTime':
            return formatDuration(value);

        case 'headless':
            if (
                value === true ||
                value === 'true'
            ) {
                return 'Yes';
            }

            if (
                value === false ||
                value === 'false'
            ) {
                return 'No';
            }

            return excelValue(value);

        case 'platform':
            if (value === 'win32') return 'Windows';
            if (value === 'darwin') return 'macOS';
            if (value === 'linux') return 'Linux';

            return excelValue(value);

        case 'runId': {
            const text = String(value ?? '');

            return text.startsWith('run-')
                ? text
                : `run-${text}`;
        }

        default:
            return excelValue(value);
    }
}

/* ============================================================
 * SUMMARY WORKSHEET
 * ============================================================ */

function createSummarySheet(
    workbook: ExcelJS.Workbook,
    options: ExcelGenerationOptions,
): void {
    const sheet = workbook.addWorksheet('Summary');

    // All Summary layout rules are in excelStyles.ts.
    styleSummaryLayout(sheet);

    sheet.getCell('A1').value =
        `Execution Summary  |  Project: ${options.project}  |  Product: ${options.product}`;

    styleTitle(sheet, 1, 2);
    styleWorksheetTab(sheet);

    let rowNumber = 3;

    const sections = [...options.summarySchema].sort(
        (a, b) => a.order - b.order,
    );

    for (const section of sections) {
        sheet.getCell(rowNumber, 1).value =
            section.section;

        styleSummarySection(
            sheet,
            rowNumber,
            2,
        );

        rowNumber++;

        for (
            const field of orderedFields(
                section.fields,
            )
        ) {
            sheet.getCell(rowNumber, 1).value =
                field.label;

            sheet.getCell(rowNumber, 2).value =
                formatSummaryValue(
                    field.field,
                    options.summaryData[field.field],
                );

            // Field-specific layout is handled
            // entirely by excelStyles.ts.
            styleSummaryField(
                sheet,
                rowNumber,
                field.field,
            );

            styleSummaryResult(
                sheet,
                rowNumber,
                field.field,
            );

            rowNumber++;
        }

        rowNumber++;
    }
}

/* ============================================================
 * DETAIL WORKSHEETS
 *
 * All, Passed, Failed, Not Executed
 * ============================================================ */

function createDetailSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    tests: readonly ExcelEvidenceTest[],
    evidenceSchema: readonly SchemaField[],
): void {
    const sheet = workbook.addWorksheet(sheetName);

    const fields = orderedFields(evidenceSchema);

    fields.forEach((field, index) => {
        sheet.getCell(1, index + 1).value =
            field.label;
    });

    styleTableHeader(
        sheet,
        1,
        fields.length,
    );

    const statusIndex = fields.findIndex(
        (field) => field.field === 'status',
    );

    tests.forEach((test, index) => {
        const rowNumber = index + 2;

        fields.forEach(
            (field, columnIndex) => {
                const value =
                    field.field === 'retry'
                        ? test.retry
                        : field.field === 'status'
                            ? test.status
                            : Object.prototype.hasOwnProperty.call(
                                test.annotations,
                                field.field,
                            )
                                ? test.annotations[field.field]
                                : test.values[field.field];

                sheet.getCell(
                    rowNumber,
                    columnIndex + 1,
                ).value = excelValue(value);
            },
        );

        styleDataRow(
            sheet,
            rowNumber,
            fields.length,
        );

        if (statusIndex >= 0) {
            styleStatusCell(
                sheet.getCell(
                    rowNumber,
                    statusIndex + 1,
                ),
                test.status,
            );
        }
    });

    setColumnWidths(sheet);
}

/* ============================================================
 * MISSING REPORTING FIELDS WORKSHEET
 * ============================================================ */

function createMissingFieldsSheet(
    workbook: ExcelJS.Workbook,
    tests: readonly ExcelEvidenceTest[],
    evidenceSchema: readonly SchemaField[],
): void {
    const missing = findMissingReportingFields(
        tests.map((test) => ({
            testName: test.testName,
            annotations: Object.entries(
                test.annotations,
            ).map(([type, description]) => ({
                type,
                description,
            })),
        })),
        evidenceSchema,
    );

    if (missing.length === 0) {
        return;
    }

    const sheet = workbook.addWorksheet(
        'Missing Reporting Fields',
    );

    const headers = [
        'Missing Field',
        'Affected Tests',
        'Occurrences',
    ];

    headers.forEach((header, index) => {
        sheet.getCell(1, index + 1).value =
            header;
    });

    styleTableHeader(
        sheet,
        1,
        headers.length,
    );

    missing.forEach((item, index) => {
        const rowNumber = index + 2;

        sheet.getCell(rowNumber, 1).value =
            item.field;

        sheet.getCell(rowNumber, 2).value =
            item.affectedTests.join(', ');

        sheet.getCell(rowNumber, 3).value =
            item.occurrences;

        styleDataRow(
            sheet,
            rowNumber,
            headers.length,
        );
    });

    setColumnWidths(sheet);
}

/* ============================================================
 * GENERATE EVIDENCE EXCEL
 * ============================================================ */

export async function generateEvidenceExcel(
    options: ExcelGenerationOptions,
): Promise<string> {
    await mkdir(
        options.outputDirectory,
        {
            recursive: true,
        },
    );

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'EvidenceFactory';
    workbook.created = new Date();

    // Summary worksheet
    createSummarySheet(
        workbook,
        options,
    );

    // All test results
    createDetailSheet(
        workbook,
        'All',
        options.tests,
        options.evidenceSchema,
    );

    // Passed test results
    createDetailSheet(
        workbook,
        'Passed',
        options.tests.filter(
            (test) => test.status === 'passed',
        ),
        options.evidenceSchema,
    );

    // Failed test results
    createDetailSheet(
        workbook,
        'Failed',
        options.tests.filter(
            (test) => test.status === 'failed',
        ),
        options.evidenceSchema,
    );

    // Not executed test results
    createDetailSheet(
        workbook,
        'Not Executed',
        options.tests.filter(
            (test) =>
                test.status === 'notExecuted',
        ),
        options.evidenceSchema,
    );

    // Fields reported by tests but absent
    // from the consumer evidence schema
    createMissingFieldsSheet(
        workbook,
        options.tests,
        options.evidenceSchema,
    );

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    const filePath = join(
        options.outputDirectory,
        `evidence-report-${timestamp}.xlsx`,
    );

    await workbook.xlsx.writeFile(filePath);

    console.log(
        `EvidenceFactory: Excel report generated: ${filePath}`,
    );

    return filePath;
}
