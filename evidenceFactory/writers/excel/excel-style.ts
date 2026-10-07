import type ExcelJS from 'exceljs';

export const EXCEL_COLORS = {
  primary: '4472C4',
  passed: '70AD47',
  failed: 'C00000',
  notExecuted: 'FFC000',

  white: 'FFFFFF',
  black: '000000',
  lightGrey: 'F2F2F2',

  passedLight: 'E2F0D9',
  failedLight: 'FCE4D6',
  notExecutedLight: 'FFF2CC',
} as const;

/**
 * Applies styling to a table header cell.
 */
export function applyHeaderStyle(
  cell: ExcelJS.Cell,
  backgroundColor: string = EXCEL_COLORS.primary,
  fontColor: string = EXCEL_COLORS.white,
): void {
  cell.font = {
    bold: true,
    color: {
      argb: fontColor,
    },
  };

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: backgroundColor,
    },
  };

  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  applyBorder(cell);
}

/**
 * Applies standard styling to body cells.
 */
export function applyBodyStyle(
  cell: ExcelJS.Cell,
): void {
  cell.alignment = {
    vertical: 'top',
    wrapText: true,
  };

  applyBorder(cell);
}

/**
 * Applies status-specific styling.
 */
export function applyStatusStyle(
  cell: ExcelJS.Cell,
  status: string,
): void {
  cell.font = {
    bold: true,
  };

  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center',
  };

  switch (status) {
    case 'PASSED':
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: EXCEL_COLORS.passedLight,
        },
      };
      break;

    case 'FAILED':
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: EXCEL_COLORS.failedLight,
        },
      };
      break;

    case 'NOT_EXECUTED':
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: EXCEL_COLORS.notExecutedLight,
        },
      };
      break;
  }

  applyBorder(cell);
}

/**
 * Applies a standard thin border.
 */
function applyBorder(
  cell: ExcelJS.Cell,
): void {
  cell.border = {
    top: {
      style: 'thin',
    },
    left: {
      style: 'thin',
    },
    bottom: {
      style: 'thin',
    },
    right: {
      style: 'thin',
    },
  };
}

/**
 * Returns the header color associated with a worksheet.
 */
export function getSheetHeaderColor(
  sheetName: string,
): string {
  switch (sheetName) {
    case 'Passed':
      return EXCEL_COLORS.passed;

    case 'Failed':
      return EXCEL_COLORS.failed;

    case 'Not Executed':
      return EXCEL_COLORS.notExecuted;

    default:
      return EXCEL_COLORS.primary;
  }
}
