
import type {
    Cell,
    Worksheet,
    Fill,
    Borders,
    Row,
} from 'exceljs';

import { EXCEL_STYLE_CONFIG } from './excelStyleConfig';

/**
 * EvidenceFactory Excel formatting.
 *
 * All configurable presentation settings are defined
 * in excelStyleConfig.ts.
 */

const {
    colors: COLORS,
    passRateRanges: PASS_RATE_RANGES,
    fonts: FONTS,
    rowHeights: ROW_HEIGHTS,
    columnWidths: COLUMN_WIDTHS,
    alignment: ALIGNMENT,
    spacing: SPACING,
    wrapText: WRAPTEXT,
} = EXCEL_STYLE_CONFIG;

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

/**
 * Apply custom row height only when configured.
 * null leaves Excel's default row height unchanged.
 */
function applyRowHeight(
    row: Row,
    height: number | null,
): void {
    if (height !== null) {
        row.height = height;
    }
}

function styleCell(
    cell: Cell,
    background: string,
    fontColor: string,
    bold = false,
): void {
    cell.fill = solidFill(background);

    cell.font = {
        name: FONTS.name,
        size: FONTS.size,
        bold,
        color: { argb: toArgb(fontColor) },
    };

    cell.border = thinBorder;

    cell.alignment = {
        vertical: 'middle',
        wrapText: WRAPTEXT,
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
        fgColor: { argb: toArgb(COLORS.white) },
    };

    cell.alignment = {
        vertical: 'middle',
        horizontal: ALIGNMENT.summaryValue,
        wrapText: WRAPTEXT,
    };
}

export function styleWorksheetTab(
    worksheet: Worksheet,
): void {
    if (!EXCEL_STYLE_CONFIG.enableTabColors) return;

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
    worksheet.getColumn(1).width =
        COLUMN_WIDTHS.summaryField;

    worksheet.getColumn(2).width =
        COLUMN_WIDTHS.summaryValue;

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

    applyRowHeight(
        row,
        ROW_HEIGHTS.summaryTitle,
    );

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.summaryTitle,
            COLORS.summaryTitleText,
            true,
        );
    }

    row.getCell(1).font = {
        name: FONTS.titleName,
        size: FONTS.titleSize,
        bold: true,
        color: { argb: toArgb(COLORS.summaryTitleText) },
    };

    row.getCell(1).alignment = {
        vertical: 'middle',
        horizontal: 'left',
        indent: SPACING.summaryTitle,
        wrapText: WRAPTEXT,
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

    applyRowHeight(
        row,
        ROW_HEIGHTS.detailHeader,
    );

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
            horizontal: ALIGNMENT.detailHeader,
            wrapText: WRAPTEXT,
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
 * Detail data rows use Excel's default height
 * unless a custom height is configured.
 */
export function styleDataRow(
    worksheet: Worksheet,
    rowNumber: number,
    columnCount: number,
): void {
    const row = worksheet.getRow(rowNumber);

    applyRowHeight(
        row,
        ROW_HEIGHTS.detailData,
    );

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
        horizontal: ALIGNMENT.status,
        wrapText: WRAPTEXT,
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

    applyRowHeight(
        row,
        ROW_HEIGHTS.summarySection,
    );

    for (let column = 1; column <= lastColumn; column++) {
        styleCell(
            row.getCell(column),
            COLORS.summarySection,
            COLORS.summarySectionText,
            true,
        );
    }

    row.getCell(1).font = {
        name: FONTS.name,
        size: FONTS.sectionSize,
        bold: true,
        color: { argb: toArgb(COLORS.summarySectionText) },
    };

    row.getCell(1).alignment = {
        vertical: 'middle',
        horizontal: 'left',
        indent: SPACING.summarySection,
        wrapText: WRAPTEXT,
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

    const height =
        field === 'evidenceDirectory'
            ? ROW_HEIGHTS.evidenceDirectory
            : ROW_HEIGHTS.summaryField;

    applyRowHeight(row, height);

    styleCell(
        row.getCell(1),
        COLORS.summaryField,
        COLORS.summaryFieldText,
        true,
    );

    row.getCell(1).alignment = {
        vertical: 'middle',
        horizontal: 'left',
        indent: SPACING.summaryField,
        wrapText: WRAPTEXT,
    };

    styleSummaryValue(row.getCell(2));
}

/**
 * Summary result values:
 * - Passed, Failed and Not Executed retain colored fonts.
 * - Only Pass Rate receives a colored background.
 * - All Summary values are left-aligned.
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

            cell.alignment = {
                vertical: 'middle',
                horizontal: ALIGNMENT.summaryValue,
                wrapText: WRAPTEXT,
            };

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
    minimumWidth: number = COLUMN_WIDTHS.detailMinimum,
    maximumWidth: number = COLUMN_WIDTHS.detailMaximum,
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
