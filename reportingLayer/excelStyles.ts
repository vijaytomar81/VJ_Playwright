
import type {
    Cell,
    Worksheet,
    Fill,
    Borders,
} from 'exceljs';

/**
 * EvidenceFactory Excel formatting.
 *
 * All Excel colors, fonts, borders, alignment,
 * worksheet layout and presentation rules
 * are centralized here.
 *
 * No consumer reporting schemas are imported.
 */

/* ============================================================
 * COLOR PALETTE
 * ============================================================ */

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

/* ============================================================
 * WORKSHEET THEMES
 *
 * Change worksheet tab and header colors here.
 * ============================================================ */

interface WorksheetTheme {
    readonly tab: string;
    readonly header: string;
}

const WORKSHEET_THEMES: Readonly<
    Record<string, WorksheetTheme>
> = {
    Summary: {
        tab: COLORS.blue,
        header: COLORS.navy,
    },

    All: {
        tab: COLORS.brightBlue,
        header: COLORS.brightBlue,
    },

    Passed: {
        tab: COLORS.green,
        header: COLORS.green,
    },

    Failed: {
        tab: COLORS.red,
        header: COLORS.red,
    },

    'Not Executed': {
        tab: COLORS.orange,
        header: COLORS.orange,
    },

    'Missing Reporting Fields': {
        tab: COLORS.orange,
        header: COLORS.navy,
    },
};

const DEFAULT_THEME: WorksheetTheme = {
    tab: COLORS.blue,
    header: COLORS.navy,
};

function getWorksheetTheme(
    worksheetName: string,
): WorksheetTheme {
    return (
        WORKSHEET_THEMES[worksheetName] ??
        DEFAULT_THEME
    );
}

/* ============================================================
 * COMMON STYLES
 * ============================================================ */

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

/* ============================================================
 * WORKSHEET TAB COLORS
 * ============================================================ */

/**
 * Set worksheet tab color using WORKSHEET_THEMES.
 */
export function styleWorksheetTab(
    worksheet: Worksheet,
): void {
    const theme = getWorksheetTheme(worksheet.name);

    worksheet.properties.tabColor = {
        argb: theme.tab,
    };
}

/* ============================================================
 * SUMMARY WORKSHEET LAYOUT
 * ============================================================ */

/**
 * Configure Summary worksheet column widths
 * and frozen title row.
 *
 * All Summary layout settings belong here,
 * not in excelGenerator.ts.
 */
export function styleSummaryLayout(
    worksheet: Worksheet,
): void {
    worksheet.getColumn(1).width = 30;
    worksheet.getColumn(2).width = 105;

    worksheet.views = [
        {
            state: 'frozen',
            ySplit: 1,
        },
    ];
}

/* ============================================================
 * SUMMARY TITLE
 * ============================================================ */

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

    const headerColor =
        getWorksheetTheme(worksheet.name).header;

    for (
        let column = 1;
        column <= lastColumn;
        column++
    ) {
        styleCell(
            row.getCell(column),
            headerColor,
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

/* ============================================================
 * DETAILED WORKSHEET HEADER
 * ============================================================ */

/**
 * Detailed worksheet header with:
 * - Worksheet-specific header color
 * - Auto filters
 * - Frozen header rows
 * - Center-aligned text
 */
export function styleTableHeader(
    worksheet: Worksheet,
    headerRowNumber: number,
    columnCount: number,
): void {
    if (columnCount < 1) return;

    const theme = getWorksheetTheme(worksheet.name);
    const row = worksheet.getRow(headerRowNumber);

    row.height = 32;

    for (
        let column = 1;
        column <= columnCount;
        column++
    ) {
        const cell = row.getCell(column);

        styleCell(
            cell,
            theme.header,
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

/* ============================================================
 * DETAILED WORKSHEET DATA ROWS
 * ============================================================ */

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

    for (
        let column = 1;
        column <= columnCount;
        column++
    ) {
        styleCell(
            row.getCell(column),
            COLORS.white,
            COLORS.black,
        );
    }
}

/* ============================================================
 * STATUS CELL FORMATTING
 * ============================================================ */

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

/* ============================================================
 * SUMMARY SECTION HEADINGS
 * ============================================================ */

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

    for (
        let column = 1;
        column <= lastColumn;
        column++
    ) {
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

/* ============================================================
 * SUMMARY LABEL AND VALUE ROWS
 * ============================================================ */

/**
 * Style Summary label and value rows.
 *
 * Field-specific row sizing is also handled here.
 */
export function styleSummaryField(
    worksheet: Worksheet,
    rowNumber: number,
    field?: string,
): void {
    const row = worksheet.getRow(rowNumber);

    row.height =
        field === 'evidenceDirectory'
            ? 34
            : 26;

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

/* ============================================================
 * SUMMARY RESULT HIGHLIGHTING
 * ============================================================ */

/**
 * Highlight Summary results and apply
 * field-specific number formatting.
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

            if (typeof cell.value === 'number') {
                cell.numFmt = '0.00"%"';
            }
            break;
    }
}

/* ============================================================
 * COLUMN WIDTHS
 * ============================================================ */

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

                if (
                    value !== null &&
                    value !== undefined
                ) {
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
