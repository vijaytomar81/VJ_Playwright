import type ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
import { EvidenceStatus } from '../../contracts/evidence-status';
import type { ReportConfig } from '../../contracts/report-config';

import {
  type SummaryData,
  type SummarySchema,
} from '../../contracts/summary-schema';

/**
 * Creates the Excel Summary worksheet.
 *
 * All section names, field names, labels, and
 * display order come from configLayer.
 */
export function createSummarySheet<
  TData extends Record<string, unknown>,
>(
  workbook: ExcelJS.Workbook,
  evidence: Evidence<TData>[],
  config: ReportConfig,
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet('Summary');

  worksheet.columns = [
    { width: 36 },
    { width: 85 },
  ];

  /**
   * Summary values supplied by executionFactory.
   */
  const summaryData: SummaryData = {
    ...config.summaryData,
  };

  /**
   * Calculate execution results from final evidence.
   */
  const totalItems = evidence.length;

  const passed = evidence.filter(
    (item) => item.status === EvidenceStatus.PASSED,
  ).length;

  const failed = evidence.filter(
    (item) => item.status === EvidenceStatus.FAILED,
  ).length;

  const notExecuted = evidence.filter(
    (item) =>
      item.status === EvidenceStatus.NOT_EXECUTED,
  ).length;

  const passRate =
    totalItems > 0
      ? `${((passed / totalItems) * 100).toFixed(2)}%`
      : '0.00%';

  /**
   * These calculated values take precedence
   * over externally supplied values.
   */
  Object.assign(summaryData, {
    totalItems,
    passed,
    failed,
    notExecuted,
    passRate,
  });

  /**
   * Read the consumer-owned Summary schema.
   */
  const schema: SummarySchema =
    config.summarySchema ?? [];

  /**
   * Main report heading.
   */
  worksheet.mergeCells('A2:B2');

  const titleCell = worksheet.getCell('A2');

  titleCell.value =
    config.reportTitle ?? 'Execution Summary';

  titleCell.font = {
    bold: true,
    size: 18,
    color: { argb: 'FFFFFFFF' },
  };

  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };

  titleCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  worksheet.getRow(2).height = 34;

  /**
   * Generate sections dynamically.
   */
  let rowNumber = 4;

  const orderedSections = [...schema].sort(
    (a, b) => a.order - b.order,
  );

  for (const section of orderedSections) {
    /**
     * Section heading.
     */
    worksheet.mergeCells(
      `A${rowNumber}:B${rowNumber}`,
    );

    const sectionCell =
      worksheet.getCell(`A${rowNumber}`);

    sectionCell.value = section.section;

    sectionCell.font = {
      bold: true,
      size: 12,
      color: { argb: 'FFFFFFFF' },
    };

    sectionCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5B7FAF' },
    };

    sectionCell.alignment = {
      vertical: 'middle',
    };

    worksheet.getRow(rowNumber).height = 24;

    rowNumber++;

    /**
     * Section fields.
     */
    const orderedFields = [...section.fields].sort(
      (a, b) => a.order - b.order,
    );

    for (const field of orderedFields) {
      const labelCell =
        worksheet.getCell(rowNumber, 1);

      const valueCell =
        worksheet.getCell(rowNumber, 2);

      labelCell.value = field.label;

      labelCell.font = {
        bold: true,
        color: { argb: 'FF000000' },
      };

      const value = summaryData[field.field];

      valueCell.value = normalizeSummaryValue(value);

      /**
       * Highlight execution result counts.
       */
      if (field.field === 'passed') {
        valueCell.font = {
          bold: true,
          color: { argb: 'FF008000' },
        };
      } else if (field.field === 'failed') {
        valueCell.font = {
          bold: true,
          color: { argb: 'FFFF0000' },
        };
      } else if (field.field === 'notExecuted') {
        valueCell.font = {
          bold: true,
          color: { argb: 'FFFF8C00' },
        };
      }

      labelCell.border = createBorder();
      valueCell.border = createBorder();

      labelCell.alignment = {
        vertical: 'middle',
      };

      valueCell.alignment = {
        vertical: 'middle',
        wrapText: true,
      };

      worksheet.getRow(rowNumber).height = 22;

      rowNumber++;
    }

    /**
     * Blank row between sections.
     */
    rowNumber++;
  }

  return worksheet;
}

/**
 * Converts values to Excel-compatible types.
 */
function normalizeSummaryValue(
  value: unknown,
): string | number | boolean | Date {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  if (value instanceof Date) {
    return value;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return JSON.stringify(value);
}

/**
 * Shared border styling for Summary rows.
 */
function createBorder(): Partial<ExcelJS.Borders> {
  return {
    bottom: {
      style: 'thin',
      color: { argb: 'FFD9D9D9' },
    },
  };
}
