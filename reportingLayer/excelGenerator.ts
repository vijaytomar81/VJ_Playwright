
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

const UNKNOWN = 'Not Known';

// Exclude captured technical annotations from missing business fields.
const INTERNAL_FIELDS = new Set([
    'browser',
    'browserChannel',
    'browserVersion',
    'viewport',
]);

const ordered = (fields: readonly SchemaField[]): SchemaField[] =>
    [...fields].sort((a, b) => a.order - b.order);

function cellValue(value: unknown): ExcelJS.CellValue {
    if (value === null || value === undefined) return '';

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value instanceof Date
    ) {
        return value;
    }

    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

function formatDuration(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const seconds = Math.floor(Math.max(0, value) / 1000);

        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:` +
            `${String(seconds % 60).padStart(2, '0')}`;
    }

    if (typeof value === 'string') {
        const text = value.trim();

        if (/^\d+:[0-5]\d$/.test(text)) return text;

        const seconds = text.match(/^([\d.]+)\s+seconds?$/i);
        if (seconds) return formatDuration(Number(seconds[1]) * 1000);

        return text || UNKNOWN;
    }

    return UNKNOWN;
}

function formatDate(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return UNKNOWN;
    }

    const date = value instanceof Date
        ? value
        : new Date(String(value));

    if (Number.isNaN(date.getTime())) return String(value);

    const day = String(date.getDate()).padStart(2, '0');

    const month = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ][date.getMonth()];

    const time = [
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
    ].map(part => String(part).padStart(2, '0')).join(':');

    return `${day}-${month}-${date.getFullYear()} ${time}`;
}

function summaryValue(field: string, value: unknown): ExcelJS.CellValue {
    switch (field) {
        case 'startedAt':
        case 'finishedAt':
            return formatDate(value);

        case 'executionTime':
            return formatDuration(value);

        case 'headless':
            if (value === true || value === 'true') return 'Yes';
            if (value === false || value === 'false') return 'No';
            return cellValue(value ?? UNKNOWN);

        case 'platform':
            return cellValue(
                { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[
                String(value)
                ] ?? value ?? UNKNOWN,
            );

        case 'runId': {
            const id = String(value ?? '');
            return id
                ? (id.startsWith('run-') ? id : `run-${id}`)
                : UNKNOWN;
        }

        default:
            return cellValue(value ?? UNKNOWN);
    }
}

// Reporter has already merged annotations and execution metadata.
function detailValue(test: ExcelEvidenceTest, field: string): unknown {
    return test.values[field] ?? '';
}

function createSummary(
    workbook: ExcelJS.Workbook,
    options: ExcelGenerationOptions,
): void {
    const sheet = workbook.addWorksheet('Summary');

    styleSummaryLayout(sheet);

    sheet.getCell('A1').value =
        `Execution Summary  |  Project: ${options.project}` +
        `  |  Product: ${options.product}`;

    styleTitle(sheet, 1, 2);
    styleWorksheetTab(sheet);

    let row = 3;

    for (const section of [...options.summarySchema].sort(
        (a, b) => a.order - b.order,
    )) {
        sheet.getCell(row, 1).value = section.section;
        styleSummarySection(sheet, row++, 2);

        for (const field of ordered(section.fields)) {
            sheet.getCell(row, 1).value = field.label;
            sheet.getCell(row, 2).value = summaryValue(
                field.field,
                options.summaryData[field.field],
            );

            styleSummaryField(sheet, row, field.field);
            styleSummaryResult(sheet, row++, field.field);
        }

        row++;
    }
}

function createDetail(
    workbook: ExcelJS.Workbook,
    name: string,
    tests: readonly ExcelEvidenceTest[],
    schema: readonly SchemaField[],
): void {
    const sheet = workbook.addWorksheet(name);
    const fields = ordered(schema);

    fields.forEach((field, index) => {
        sheet.getCell(1, index + 1).value = field.label;
    });

    styleTableHeader(sheet, 1, fields.length);

    const statusColumn = fields.findIndex(
        field => field.field === 'status',
    ) + 1;

    tests.forEach((test, index) => {
        const row = index + 2;

        fields.forEach((field, column) => {
            sheet.getCell(row, column + 1).value = cellValue(
                detailValue(test, field.field),
            );
        });

        styleDataRow(sheet, row, fields.length);

        if (statusColumn > 0) {
            styleStatusCell(
                sheet.getCell(row, statusColumn),
                test.status,
            );
        }
    });

    setColumnWidths(sheet);
}

function createMissingFields(
    workbook: ExcelJS.Workbook,
    tests: readonly ExcelEvidenceTest[],
    schema: readonly SchemaField[],
): void {
    const missing = findMissingReportingFields(
        tests.map(test => ({
            testName: test.testName,
            annotations: Object.entries(test.annotations)
                .filter(([type]) => !INTERNAL_FIELDS.has(type))
                .map(([type, description]) => ({
                    type,
                    description,
                })),
        })),
        schema,
    );

    if (!missing.length) return;

    const sheet = workbook.addWorksheet('Missing Reporting Fields');

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
        const row = index + 2;

        [
            item.field,
            item.affectedTests.join(', '),
            item.occurrences,
        ].forEach((value, column) => {
            sheet.getCell(row, column + 1).value = value;
        });

        styleDataRow(sheet, row, headers.length);
    });

    setColumnWidths(sheet);
}

export async function generateEvidenceExcel(
    options: ExcelGenerationOptions,
): Promise<string> {
    await mkdir(options.outputDirectory, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EvidenceFactory';
    workbook.created = new Date();

    createSummary(workbook, options);

    const sheets = [
        {
            name: 'All',
            tests: options.tests,
        },
        {
            name: 'Passed',
            tests: options.tests.filter(
                test => test.status === 'passed',
            ),
        },
        {
            name: 'Failed',
            tests: options.tests.filter(
                test => test.status === 'failed',
            ),
        },
        {
            name: 'Not Executed',
            tests: options.tests.filter(
                test => test.status === 'notExecuted',
            ),
        },
    ];

    for (const sheet of sheets) {
        createDetail(
            workbook,
            sheet.name,
            sheet.tests,
            options.evidenceSchema,
        );
    }

    createMissingFields(
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
