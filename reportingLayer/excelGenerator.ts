
import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
    findMissingReportingFields,
} from './missingFields';

import {
    styleTitle,
    styleTableHeader,
    styleDataRow,
    styleStatusCell,
    styleSummarySection,
    styleSummaryField,
    setColumnWidths,
} from './excelStyles';

/**
 * Consumer schemas are passed to this generator.
 * They are never imported directly.
 */

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

function excelValue(value: unknown): ExcelJS.CellValue {
    if (value === null || value === undefined) {
        return '';
    }

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

function orderedFields(
    fields: readonly SchemaField[],
): SchemaField[] {
    return [...fields].sort(
        (a, b) => a.order - b.order,
    );
}

function createSummarySheet(
    workbook: ExcelJS.Workbook,
    options: ExcelGenerationOptions,
): void {
    const sheet = workbook.addWorksheet('Summary');

    sheet.getCell('A1').value =
        `Execution Summary | Project: ${options.project} | Product: ${options.product}`;

    styleTitle(sheet, 1, 2);

    let rowNumber = 3;

    const sections = [...options.summarySchema].sort(
        (a, b) => a.order - b.order,
    );

    for (const section of sections) {
        sheet.getCell(rowNumber, 1).value = section.section;

        styleSummarySection(sheet, rowNumber);
        rowNumber++;

        for (const field of orderedFields(section.fields)) {
            sheet.getCell(rowNumber, 1).value = field.label;

            sheet.getCell(rowNumber, 2).value = excelValue(
                options.summaryData[field.field],
            );

            styleSummaryField(sheet, rowNumber);

            if (field.field === 'passRate') {
                const cell = sheet.getCell(rowNumber, 2);

                if (typeof cell.value === 'number') {
                    cell.numFmt = '0.00"%"';
                }
            }

            rowNumber++;
        }

        rowNumber++;
    }

    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 55;

    sheet.views = [
        {
            state: 'frozen',
            ySplit: 1,
        },
    ];
}

function createDetailSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    tests: readonly ExcelEvidenceTest[],
    evidenceSchema: readonly SchemaField[],
): void {
    const sheet = workbook.addWorksheet(sheetName);

    const fields = orderedFields(evidenceSchema);

    fields.forEach((field, index) => {
        sheet.getCell(1, index + 1).value = field.label;
    });

    styleTableHeader(sheet, 1, fields.length);

    tests.forEach((test, index) => {
        const rowNumber = index + 2;

        fields.forEach((field, columnIndex) => {
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

            sheet.getCell(rowNumber, columnIndex + 1).value =
                excelValue(value);
        });

        styleDataRow(sheet, rowNumber, fields.length);

        const statusIndex = fields.findIndex(
            (field) => field.field === 'status',
        );

        if (statusIndex >= 0) {
            styleStatusCell(
                sheet.getCell(rowNumber, statusIndex + 1),
                test.status,
            );
        }
    });

    setColumnWidths(sheet);
}

function createMissingFieldsSheet(
    workbook: ExcelJS.Workbook,
    tests: readonly ExcelEvidenceTest[],
    evidenceSchema: readonly SchemaField[],
): void {
    const missing = findMissingReportingFields(
        tests.map((test) => ({
            testName: test.testName,
            annotations: Object.entries(test.annotations).map(
                ([type, description]) => ({
                    type,
                    description,
                }),
            ),
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
        sheet.getCell(1, index + 1).value = header;
    });

    styleTableHeader(sheet, 1, headers.length);

    missing.forEach((item, index) => {
        const rowNumber = index + 2;

        sheet.getCell(rowNumber, 1).value = item.field;
        sheet.getCell(rowNumber, 2).value =
            item.affectedTests.join(', ');
        sheet.getCell(rowNumber, 3).value = item.occurrences;

        styleDataRow(sheet, rowNumber, headers.length);
    });

    setColumnWidths(sheet);
}

/**
 * Generates one Excel workbook per execution.
 *
 * Standard sheets:
 * 1. Summary
 * 2. All
 * 3. Passed
 * 4. Failed
 * 5. Not Executed
 *
 * Conditional sheet:
 * 6. Missing Reporting Fields
 */
export async function generateEvidenceExcel(
    options: ExcelGenerationOptions,
): Promise<string> {
    await mkdir(options.outputDirectory, {
        recursive: true,
    });

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'EvidenceFactory';
    workbook.created = new Date();

    createSummarySheet(workbook, options);

    createDetailSheet(
        workbook,
        'All',
        options.tests,
        options.evidenceSchema,
    );

    createDetailSheet(
        workbook,
        'Passed',
        options.tests.filter(
            (test) => test.status === 'passed',
        ),
        options.evidenceSchema,
    );

    createDetailSheet(
        workbook,
        'Failed',
        options.tests.filter(
            (test) => test.status === 'failed',
        ),
        options.evidenceSchema,
    );

    createDetailSheet(
        workbook,
        'Not Executed',
        options.tests.filter(
            (test) => test.status === 'notExecuted',
        ),
        options.evidenceSchema,
    );

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
