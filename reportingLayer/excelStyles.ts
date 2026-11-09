
import type {
    Cell,
    Worksheet,
    Fill,
    Borders,
} from 'exceljs';

/**
 * EvidenceFactory Excel formatting.
 *
 * All colors and presentation rules are centralized here.
 * No consumer reporting schemas are imported.
 */

const COLORS = {
    navy: 'FF102846',
    blue: 'FF14529A',
    brightBlue: 'FF1769C2',

    paleBlue: 'FFE5EFF9',
    white: 'FFFFFFFF',
    black: 'FF202B38',
    border: 'FFB9C8D7',

    green: 'FF208047',
    paleGreen: 'FFC7EBCB',
    darkGreen: 'FF155B2E',

    red: 'FFBD3038',
    paleRed: 'FFF3C4C8',
    darkRed: 'FF8D1723',

    orange: 'FFDB790F',
    paleOrange: 'FFFFD998',
    darkOrange: 'FF8B4A00',

    paleRate: 'FFD4EAF4',
} as const;

const thinBorder: Partial<Borders> = {
    top: {
        style: 'thin',
        color: { argb: COLORS.border },
    },
    bottom: {
        style: 'thin',
        color: { argb: COLORS.border },
    },
    left: {
        style: 'thin',
        color: { argb: COLORS.border },
    },
    right: {
        style: 'thin',
        color: { argb: COLORS.border },
    },
};

function solidFill(color: string): Fill {
    return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
    };
}

function styleCell(
    cell: Cell,
    background: string,
    fontColor: string,
    bold = false,
): void {
    cell.fill = solidFill(background);

    cell.font = {
        name: 'Aptos',
        size: 11,
        bold,
        color: { argb: fontColor },
    };

    cell.border = thinBorder;

    cell.alignment = {
        vertical: 'middle',
        wrapText: true,
    };
}

/**
 * Main Summary title.
 */
export function styleTitle(
    worksheet: Worksheet,
    rowNumber: number,
    lastColumn: number,
): void {
    if (lastColumn < 1) return;

    if (lastColumn > 1) {
        worksheet.mergeCells(
            rowNumber,
            1,
            rowNumber,
            lastColumn,
        );
    }

    const row = worksheet.getRow(rowNumber);
    row.height = 38;

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.navy,
            COLORS.white,
            true,
        );
    }

    row.getCell(1).font = {
        name: 'Aptos Display',
        size: 16,
        bold: true,
        color: { argb: COLORS.white },
    };
}

/**
 * Set worksheet tab colors.
 *
 * Summary      = Blue
 * All          = Blue
 * Passed       = Green
 * Failed       = Red
 * Not Executed = Orange
 */
export function styleWorksheetTab(
    worksheet: Worksheet,
): void {
    const tabColors: Record<string, string> = {
        Summary: COLORS.blue,
        All: COLORS.brightBlue,
        Passed: COLORS.green,
        Failed: COLORS.red,
        'Not Executed': COLORS.orange,
        'Missing Reporting Fields': COLORS.orange,
    };

    const color = tabColors[worksheet.name];

    if (color) {
        worksheet.properties.tabColor = {
            argb: color,
        };
    }
}

/**
 * Apply a worksheet-specific header color.
 */
function getHeaderColor(
    worksheetName: string,
): string {
    switch (worksheetName) {
        case 'All':
            return COLORS.brightBlue;

        case 'Passed':
            return COLORS.green;

        case 'Failed':
            return COLORS.red;

        case 'Not Executed':
            return COLORS.orange;

        default:
            return COLORS.navy;
    }
}

/**
 * Detailed worksheet header with filters and frozen rows.
 */
export function styleTableHeader(
    worksheet: Worksheet,
    headerRowNumber: number,
    columnCount: number,
): void {
    if (columnCount < 1) return;

    const headerColor = getHeaderColor(worksheet.name);
    const row = worksheet.getRow(headerRowNumber);

    row.height = 32;

    for (let column = 1; column <= columnCount; column++) {
        const cell = row.getCell(column);

        styleCell(
            cell,
            headerColor,
            COLORS.white,
            true,
        );

        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
        };
    }

    worksheet.autoFilter = {
        from: {
            row: headerRowNumber,
            column: 1,
        },
        to: {
            row: headerRowNumber,
            column: columnCount,
        },
    };

    worksheet.views = [
        {
            state: 'frozen',
            ySplit: headerRowNumber,
        },
    ];

    styleWorksheetTab(worksheet);
}

/**
 * Regular detail row.
 */
export function styleDataRow(
    worksheet: Worksheet,
    rowNumber: number,
    columnCount: number,
): void {
    const row = worksheet.getRow(rowNumber);
    row.height = 26;

    for (let column = 1; column <= columnCount; column++) {
        styleCell(
            row.getCell(column),
            COLORS.white,
            COLORS.black,
        );
    }
}

/**
 * Color the status cell in detailed worksheets.
 */
export function styleStatusCell(
    cell: Cell,
    status: string,
): void {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'passed') {
        styleCell(
            cell,
            COLORS.paleGreen,
            COLORS.darkGreen,
            true,
        );
    } else if (normalized === 'failed') {
        styleCell(
            cell,
            COLORS.paleRed,
            COLORS.darkRed,
            true,
        );
    } else if (
        normalized === 'notexecuted' ||
        normalized === 'not executed' ||
        normalized === 'skipped' ||
        normalized === 'interrupted'
    ) {
        styleCell(
            cell,
            COLORS.paleOrange,
            COLORS.darkOrange,
            true,
        );
    }

    cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
    };
}

/**
 * Summary section heading:
 * Run, Runtime, Browser, Results, Timing.
 */
export function styleSummarySection(
    worksheet: Worksheet,
    rowNumber: number,
    lastColumn = 2,
): void {
    if (lastColumn < 1) return;

    if (lastColumn > 1) {
        worksheet.mergeCells(
            rowNumber,
            1,
            rowNumber,
            lastColumn,
        );
    }

    const row = worksheet.getRow(rowNumber);
    row.height = 29;

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.blue,
            COLORS.white,
            true,
        );
    }

    row.getCell(1).font = {
        name: 'Aptos',
        size: 12,
        bold: true,
        color: { argb: COLORS.white },
    };
}

/**
 * Summary label and value row.
 */
export function styleSummaryField(
    worksheet: Worksheet,
    rowNumber: number,
): void {
    const row = worksheet.getRow(rowNumber);
    row.height = 26;

    styleCell(
        row.getCell(1),
        COLORS.paleBlue,
        COLORS.black,
        true,
    );

    styleCell(
        row.getCell(2),
        COLORS.white,
        COLORS.black,
    );
}

/**
 * Highlight Summary results based on schema field keys.
 */
export function styleSummaryResult(
    worksheet: Worksheet,
    rowNumber: number,
    field: string,
): void {
    const cell = worksheet.getCell(rowNumber, 2);

    switch (field) {
        case 'passed':
            styleCell(
                cell,
                COLORS.paleGreen,
                COLORS.darkGreen,
                true,
            );
            break;

        case 'failed':
            styleCell(
                cell,
                COLORS.paleRed,
                COLORS.darkRed,
                true,
            );
            break;

        case 'notExecuted':
            styleCell(
                cell,
                COLORS.paleOrange,
                COLORS.darkOrange,
                true,
            );
            break;

        case 'passRate':
            styleCell(
                cell,
                COLORS.paleRate,
                COLORS.navy,
                true,
            );
            break;
    }
}

/**
 * Set readable widths for detailed worksheets.
 */
export function setColumnWidths(
    worksheet: Worksheet,
    minimumWidth = 16,
    maximumWidth = 55,
): void {
    worksheet.columns.forEach((column) => {
        let longest = minimumWidth;

        column.eachCell?.(
            { includeEmpty: false },
            (cell) => {
                const value = cell.value;

                let text = '';

                if (value !== null && value !== undefined) {
                    if (value instanceof Date) {
                        text = value.toISOString();
                    } else if (
                        typeof value === 'object' &&
                        'text' in value
                    ) {
                        text = String(value.text);
                    } else {
                        text = String(value);
                    }
                }

                longest = Math.max(
                    longest,
                    text.length + 3,
                );
            },
        );

        column.width = Math.min(
            longest,
            maximumWidth,
        );
    });
}
