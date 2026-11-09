
import type { Cell, Worksheet, Fill, Borders } from 'exceljs';

/**
 * EvidenceFactory Excel formatting.
 * All presentation rules are centralized here.
 *
 * Change colors in COLORS using VS Code Color Picker.
 * Colors use #RRGGBB and are converted to ExcelJS ARGB.
 */

const COLORS = {
    // Summary worksheet
    summaryTitle: '#102846',
    summaryTitleText: '#FFFFFF',
    summarySection: '#14529A',
    summarySectionText: '#FFFFFF',
    summaryField: '#E5EFF9',
    summaryFieldText: '#202B38',

    // All worksheet
    allHeader: '#1769C2',

    // Passed worksheet and status
    passed: '#208047',
    passedLight: '#C7EBCB',
    passedText: '#155B2E',

    // Failed worksheet and status
    failed: '#BD3038',
    failedLight: '#F3C4C8',
    failedText: '#8D1723',

    // Not Executed worksheet and status
    notExecuted: '#DB790F',
    notExecutedLight: '#FFD998',
    notExecutedText: '#8B4A00',

    // Missing Reporting Fields worksheet
    missingFieldsHeader: '#102846',

    // Summary pass-rate backgrounds
    passRateHigh: '#C7EBCB',
    passRateMedium: '#FFD998',
    passRateLow: '#F3C4C8',
    passRateText: '#102846',

    // Common formatting
    white: '#FFFFFF',
    black: '#202B38',
    border: '#B9C8D7',
} as const;

// Pass Rate values are stored from 0 to 100.
const PASS_RATE_RANGES = {
    high: 90,
    medium: 70,
} as const;

const toArgb = (color: string): string =>
    `FF${color.replace('#', '')}`;

interface WorksheetTheme {
    readonly tab: string;
    readonly header: string;
}

const WORKSHEET_THEMES: Readonly<
    Record<string, WorksheetTheme>
> = {
    Summary: {
        tab: COLORS.summarySection,
        header: COLORS.summaryTitle,
    },
    All: {
        tab: COLORS.allHeader,
        header: COLORS.allHeader,
    },
    Passed: {
        tab: COLORS.passed,
        header: COLORS.passed,
    },
    Failed: {
        tab: COLORS.failed,
        header: COLORS.failed,
    },
    'Not Executed': {
        tab: COLORS.notExecuted,
        header: COLORS.notExecuted,
    },
    'Missing Reporting Fields': {
        tab: COLORS.notExecuted,
        header: COLORS.missingFieldsHeader,
    },
};

const DEFAULT_THEME: WorksheetTheme = {
    tab: COLORS.summarySection,
    header: COLORS.summaryTitle,
};

function getWorksheetTheme(name: string): WorksheetTheme {
    return WORKSHEET_THEMES[name] ?? DEFAULT_THEME;
}

const thinBorder: Partial<Borders> = {
    top: {
        style: 'thin',
        color: { argb: toArgb(COLORS.border) },
    },
    bottom: {
        style: 'thin',
        color: { argb: toArgb(COLORS.border) },
    },
    left: {
        style: 'thin',
        color: { argb: toArgb(COLORS.border) },
    },
    right: {
        style: 'thin',
        color: { argb: toArgb(COLORS.border) },
    },
};

function solidFill(color: string): Fill {
    return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: toArgb(color) },
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
        color: { argb: toArgb(fontColor) },
    };

    cell.border = thinBorder;

    cell.alignment = {
        vertical: 'middle',
        wrapText: true,
    };
}

function styleSummaryValue(
    cell: Cell,
    fontColor: string = COLORS.black,
    bold = false,
): void {
    styleCell(cell, COLORS.white, fontColor, bold);

    cell.fill = {
        type: 'pattern',
        pattern: 'none',
    };
}

// Set true to enable worksheet-specific tab colors.
const ENABLE_TAB_COLORS = false;

export function styleWorksheetTab(
    worksheet: Worksheet,
): void {
    if (!ENABLE_TAB_COLORS) return;

    const theme = getWorksheetTheme(worksheet.name);

    worksheet.properties.tabColor = {
        argb: toArgb(theme.tab),
    };
}

/**
 * Summary worksheet layout.
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

/**
 * Summary title.
 */
export function styleTitle(
    worksheet: Worksheet,
    rowNumber: number,
    lastColumn: number,
): void {
    if (lastColumn < 1) return;

    if (lastColumn > 1) {
        worksheet.mergeCells(
            rowNumber, 1, rowNumber, lastColumn,
        );
    }

    const row = worksheet.getRow(rowNumber);
    row.height = 38;

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.summaryTitle,
            COLORS.summaryTitleText,
            true,
        );
    }

    row.getCell(1).font = {
        name: 'Aptos Display',
        size: 16,
        bold: true,
        color: { argb: toArgb(COLORS.summaryTitleText) },
    };
}

/**
 * Detail worksheet headers.
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

    for (let column = 1; column <= columnCount; column++) {
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

/**
 * Detail data rows use Excel's default height.
 */
export function styleDataRow(
    worksheet: Worksheet,
    rowNumber: number,
    columnCount: number,
): void {
    const row = worksheet.getRow(rowNumber);

    for (let column = 1; column <= columnCount; column++) {
        styleCell(
            row.getCell(column),
            COLORS.white,
            COLORS.black,
        );
    }
}

/**
 * Status highlighting in detailed worksheets.
 */
export function styleStatusCell(
    cell: Cell,
    status: string,
): void {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'passed') {
        styleCell(
            cell,
            COLORS.passedLight,
            COLORS.passedText,
            true,
        );
    } else if (normalized === 'failed') {
        styleCell(
            cell,
            COLORS.failedLight,
            COLORS.failedText,
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
            COLORS.notExecutedLight,
            COLORS.notExecutedText,
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
 * Summary section headings.
 */
export function styleSummarySection(
    worksheet: Worksheet,
    rowNumber: number,
    lastColumn = 2,
): void {
    if (lastColumn < 1) return;

    if (lastColumn > 1) {
        worksheet.mergeCells(
            rowNumber, 1, rowNumber, lastColumn,
        );
    }

    const row = worksheet.getRow(rowNumber);
    row.height = 29;

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.summarySection,
            COLORS.summarySectionText,
            true,
        );
    }

    row.getCell(1).font = {
        name: 'Aptos',
        size: 12,
        bold: true,
        color: { argb: toArgb(COLORS.summarySectionText) },
    };
}

/**
 * Summary field names retain their background color.
 * Summary values have no background fill.
 */
export function styleSummaryField(
    worksheet: Worksheet,
    rowNumber: number,
    field?: string,
): void {
    const row = worksheet.getRow(rowNumber);

    row.height = field === 'evidenceDirectory' ? 34 : 26;

    styleCell(
        row.getCell(1),
        COLORS.summaryField,
        COLORS.summaryFieldText,
        true,
    );

    styleSummaryValue(row.getCell(2));
}

/**
 * Summary result values:
 * - Passed, Failed and Not Executed retain colored fonts.
 * - Only Pass Rate receives a colored background.
 */
export function styleSummaryResult(
    worksheet: Worksheet,
    rowNumber: number,
    field: string,
): void {
    const cell = worksheet.getCell(rowNumber, 2);

    switch (field) {
        case 'passed':
            styleSummaryValue(cell, COLORS.passedText, true);
            break;

        case 'failed':
            styleSummaryValue(cell, COLORS.failedText, true);
            break;

        case 'notExecuted':
            styleSummaryValue(cell, COLORS.notExecutedText, true);
            break;

        case 'passRate': {
            const rate = Number(cell.value);

            if (!Number.isFinite(rate) || cell.value === null) {
                styleSummaryValue(cell);
                break;
            }

            const background =
                rate >= PASS_RATE_RANGES.high
                    ? COLORS.passRateHigh
                    : rate >= PASS_RATE_RANGES.medium
                        ? COLORS.passRateMedium
                        : COLORS.passRateLow;

            styleCell(
                cell,
                background,
                COLORS.passRateText,
                true,
            );

            cell.numFmt = '0.00"%"';
            break;
        }
    }
}

/**
 * Automatically calculate readable column widths.
 */
export function setColumnWidths(
    worksheet: Worksheet,
    minimumWidth = 16,
    maximumWidth = 55,
): void {
    worksheet.columns.forEach(column => {
        let longest = minimumWidth;

        column.eachCell?.(
            { includeEmpty: false },
            cell => {
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
