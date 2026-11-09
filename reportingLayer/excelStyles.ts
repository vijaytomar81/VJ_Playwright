
import type {
    Cell,
    Worksheet,
    Fill,
    Borders,
} from 'exceljs';

/**
 * Shared Excel formatting utilities.
 *
 * Responsibilities:
 * - Report titles
 * - Table headers
 * - Data rows
 * - Status colors
 * - Summary sections
 * - Summary fields
 * - Column widths
 *
 * This file does not read annotations or reporting schemas.
 */

const COLORS = {
    navy: 'FF17365D',
    paleBlue: 'FFDCEAF7',
    white: 'FFFFFFFF',
    black: 'FF222222',
    border: 'FFD6DEE8',

    green: 'FFDDF3E4',
    darkGreen: 'FF176B36',

    red: 'FFFCE4E4',
    darkRed: 'FFA61B1B',

    amber: 'FFFFF0C2',
    darkAmber: 'FF8A5900',
} as const;

/**
 * ExcelJS uses Borders for the complete cell border
 * and Border for an individual side.
 */
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

/**
 * Creates a solid background fill.
 */
function solidFill(color: string): Fill {
    return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
    };
}

/**
 * Applies common formatting to an Excel cell.
 */
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
 * Styles the main report title/banner.
 *
 * Example:
 * Execution Summary | Project: britannia | Product: Car Insurance
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
    row.height = 34;

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
 * Styles a detailed worksheet header.
 *
 * Features:
 * - Navy background
 * - White bold text
 * - Center alignment
 * - Auto filters
 * - Frozen header rows
 */
export function styleTableHeader(
    worksheet: Worksheet,
    headerRowNumber: number,
    columnCount: number,
): void {
    if (columnCount < 1) return;

    const row = worksheet.getRow(headerRowNumber);
    row.height = 30;

    for (let column = 1; column <= columnCount; column++) {
        const cell = row.getCell(column);

        styleCell(
            cell,
            COLORS.navy,
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
}

/**
 * Styles a regular data row.
 */
export function styleDataRow(
    worksheet: Worksheet,
    rowNumber: number,
    columnCount: number,
): void {
    const row = worksheet.getRow(rowNumber);
    row.height = 25;

    for (let column = 1; column <= columnCount; column++) {
        styleCell(
            row.getCell(column),
            COLORS.white,
            COLORS.black,
        );
    }
}

/**
 * Applies status-specific colors.
 *
 * Passed       = Green
 * Failed       = Red
 * Not Executed = Amber
 */
export function styleStatusCell(
    cell: Cell,
    status: string,
): void {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'passed') {
        styleCell(
            cell,
            COLORS.green,
            COLORS.darkGreen,
            true,
        );
    } else if (normalized === 'failed') {
        styleCell(
            cell,
            COLORS.red,
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
            COLORS.amber,
            COLORS.darkAmber,
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
 * Styles a Summary worksheet section heading.
 *
 * Example sections:
 * Run
 * Runtime
 * Browser
 * Results
 * Timing
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
    row.height = 28;

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.navy,
            COLORS.white,
            true,
        );
    }
}

/**
 * Styles a Summary label/value row.
 *
 * Column A = Label (pale blue)
 * Column B = Value (white)
 */
export function styleSummaryField(
    worksheet: Worksheet,
    rowNumber: number,
): void {
    const row = worksheet.getRow(rowNumber);
    row.height = 25;

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
 * Automatically adjusts worksheet column widths.
 *
 * Minimum width = 16
 * Maximum width = 55
 *
 * Long text remains wrapped within the maximum width.
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
                    if (typeof value === 'object' && 'text' in value) {
                        text = String(value.text);
                    } else if (value instanceof Date) {
                        text = value.toISOString();
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
