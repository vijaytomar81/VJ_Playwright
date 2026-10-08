import type ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
import type { ReportField } from '../../contracts/report-field';
import type { EvidenceStatus } from '../../contracts/evidence-status';

import {
  applyBodyStyle,
  applyHeaderStyle,
  applyStatusStyle,
  getSheetHeaderColor,
} from './excel-style';

/**
 * Configuration for an individual evidence worksheet.
 */
export interface EvidenceSheetConfig {
  name: string;
  status?: EvidenceStatus;
}

/**
 * Creates an Excel worksheet using consumer-configured
 * report fields.
 *
 * All report column names and their order come from
 * configLayer through the fields parameter.
 *
 * No report columns are hardcoded here.
 */
export function createEvidenceSheet<
  TData extends Record<string, unknown>,
>(
  workbook: ExcelJS.Workbook,
  evidence: Evidence<TData>[],
  fields: readonly ReportField[],
  config: EvidenceSheetConfig,
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(
    config.name,
    {
      views: [
        {
          state: 'frozen',
          ySplit: 1,
        },
      ],
    },
  );

  /**
   * Sort by configured order number.
   *
   * EvidenceFactory already sorts these fields,
   * but sorting here keeps this function independent.
   */
  const orderedFields = [...fields].sort(
    (a, b) => a.order - b.order,
  );

  /**
   * Create all columns dynamically.
   */
  worksheet.columns = orderedFields.map(
    ({ field }) => ({
      header: field,
      key: field,
      width: 20,
    }),
  );

  /**
   * Apply header styling.
   */
  const headerRow = worksheet.getRow(1);

  const headerColor =
    getSheetHeaderColor(config.name);

  headerRow.eachCell((cell) => {
    applyHeaderStyle(
      cell,
      headerColor,
    );
  });

  /**
   * Add evidence rows.
   */
  for (const item of evidence) {
    const values = orderedFields.map(
      ({ field }) =>
        normalizeValue(
          resolveFieldValue(item, field),
        ),
    );

    const row = worksheet.addRow(values);

    row.eachCell(
      { includeEmpty: true },
      (cell) => {
        applyBodyStyle(cell);
      },
    );

    /**
     * Apply status formatting dynamically.
     *
     * Status column position is determined by
     * configLayer, not hardcoded.
     */
    const statusIndex =
      orderedFields.findIndex(
        ({ field }) => field === 'status',
      );

    if (statusIndex >= 0) {
      const statusCell =
        row.getCell(statusIndex + 1);

      applyStatusStyle(
        statusCell,
        item.status,
      );
    }
  }

  /**
   * Enable filters for configured columns.
   */
  if (worksheet.columnCount > 0) {
    worksheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: worksheet.columnCount,
      },
    };
  }

  return worksheet;
}

/**
 * Resolve a configured field value.
 *
 * Business fields are read from evidence.data.
 * Framework metadata fields are read from the
 * evidence envelope.
 *
 * EvidenceFactory does not need to know the
 * individual business field names.
 */
function resolveFieldValue<
  TData extends Record<string, unknown>,
>(
  evidence: Evidence<TData>,
  field: string,
): unknown {
  if (
    Object.prototype.hasOwnProperty.call(
      evidence.data,
      field,
    )
  ) {
    return evidence.data[field];
  }

  const envelope =
    evidence as unknown as Record<string, unknown>;

  const value = envelope[field];

  /**
   * The error envelope contains an object.
   * Show the message when available.
   */
  if (
    field === 'error' &&
    value &&
    typeof value === 'object' &&
    'message' in value
  ) {
    return value.message;
  }

  return value;
}

/**
 * Convert values into Excel-compatible types.
 */
function normalizeValue(
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
