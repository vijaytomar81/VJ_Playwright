import type ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
import type { ReportField } from '../../contracts/report-field';

import {
  applyHeaderStyle,
  applyBodyStyle,
  applyStatusStyle,
  getSheetHeaderColor,
} from './excel-style';

/**
 * Configuration for an individual evidence worksheet.
 *
 * The Excel writer controls worksheet names.
 * The consumer-owned evidence schema controls columns.
 */
export interface EvidenceSheetConfig {
  name: string;
  status?: string;
}

/**
 * Creates an evidence worksheet.
 *
 * Column identifiers, display labels, and order
 * are supplied by configLayer.
 *
 * Parameter order matches excel-evidence-writer.ts.
 */
export function createEvidenceSheet<
  TData extends Record<string, unknown>,
>(
  workbook: ExcelJS.Workbook,
  evidence: Evidence<TData>[],
  fields: readonly ReportField[],
  config: EvidenceSheetConfig,
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(config.name);

  /**
   * Sort columns according to consumer configuration.
   */
  const orderedFields = [...fields].sort(
    (a, b) => a.order - b.order,
  );

  /**
   * Use display labels for Excel headers.
   * Keep internal field identifiers as column keys.
   */
  worksheet.columns = orderedFields.map(
    ({ field, label }) => ({
      header: label,
      key: field,
      width: 22,
    }),
  );

  /**
   * Style header row.
   */
  const headerColor = getSheetHeaderColor(config.name);

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    applyHeaderStyle(cell, headerColor);
  });

  /**
   * Locate status column dynamically.
   */
  const statusColumnIndex =
    orderedFields.findIndex(
      ({ field }) => field === 'status',
    ) + 1;

  /**
   * Populate evidence rows.
   */
  for (const item of evidence) {
    const rowValues: Record<string, unknown> = {};

    for (const { field } of orderedFields) {
      rowValues[field] = resolveEvidenceValue(
        item,
        field,
      );
    }

    const row = worksheet.addRow(rowValues);
    row.height = 22;

    row.eachCell((cell) => {
      applyBodyStyle(cell);
    });

    /**
     * Apply status-specific formatting.
     */
    if (statusColumnIndex > 0) {
      applyStatusStyle(
        row.getCell(statusColumnIndex),
        item.status,
      );
    }
  }

  /**
   * Freeze header row.
   */
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];

  /**
   * Enable filtering across configured columns.
   */
  if (orderedFields.length > 0) {
    worksheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: orderedFields.length,
      },
    };
  }

  return worksheet;
}

/**
 * Resolves a configured field from:
 * 1. Business evidence data
 * 2. Framework evidence envelope
 */
function resolveEvidenceValue<
  TData extends Record<string, unknown>,
>(
  evidence: Evidence<TData>,
  field: string,
): string | number | boolean | Date {
  const businessData =
    evidence.data as Record<string, unknown>;

  if (
    Object.prototype.hasOwnProperty.call(
      businessData,
      field,
    )
  ) {
    return normalizeValue(businessData[field]);
  }

  const envelope =
    evidence as unknown as Record<string, unknown>;

  const value = envelope[field];

  /**
   * Error is stored as an object.
   * Display the error message in the worksheet.
   */
  if (
    field === 'error' &&
    value !== null &&
    typeof value === 'object' &&
    'message' in value
  ) {
    return String(value.message);
  }

  return normalizeValue(value);
}

/**
 * Converts evidence values to Excel-compatible types.
 */
function normalizeValue(
  value: unknown,
): string | number | boolean | Date {
  if (value === undefined || value === null) {
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
