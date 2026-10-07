import type ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
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
 * Creates an evidence worksheet.
 *
 * Framework-owned columns are written first.
 * Consumer-owned evidence fields are then written in exactly
 * the order supplied through the fields parameter.
 *
 * EvidenceFactory does not define or maintain business field names.
 */
export function createEvidenceSheet<
  TData extends Record<string, unknown>,
>(
  workbook: ExcelJS.Workbook,
  evidence: Evidence<TData>[],
  fields: readonly (keyof TData & string)[],
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

  worksheet.columns = createColumns(fields);

  const headerRow = worksheet.getRow(1);
  const headerColor =
    getSheetHeaderColor(config.name);

  /**
   * Excel styling helpers operate on individual cells.
   */
  headerRow.eachCell((cell) => {
    applyHeaderStyle(
      cell,
      headerColor,
    );
  });

  for (const item of evidence) {
    const row = worksheet.addRow(
      createRow(
        item,
        fields,
      ),
    );

    /**
     * Apply standard body styling to every cell.
     */
    row.eachCell(
      {
        includeEmpty: true,
      },
      (cell) => {
        applyBodyStyle(cell);
      },
    );

    /**
     * Status is always the third framework column.
     */
    const statusCell = row.getCell(3);

    applyStatusStyle(
      statusCell,
      item.status,
    );
  }

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

function createColumns<
  TData extends Record<string, unknown>,
>(
  fields: readonly (keyof TData & string)[],
): Partial<ExcelJS.Column>[] {
  const frameworkColumns: Partial<ExcelJS.Column>[] = [
    {
      header: 'Scenario ID',
      key: 'scenarioId',
      width: 18,
    },
    {
      header: 'Scenario Name',
      key: 'scenarioName',
      width: 35,
    },
    {
      header: 'Status',
      key: 'status',
      width: 18,
    },
    {
      header: 'Attempt',
      key: 'attempt',
      width: 12,
    },
    {
      header: 'Worker',
      key: 'workerId',
      width: 16,
    },
    {
      header: 'Start Time',
      key: 'startTime',
      width: 26,
    },
    {
      header: 'End Time',
      key: 'endTime',
      width: 26,
    },
    {
      header: 'Duration (ms)',
      key: 'durationMs',
      width: 16,
    },
  ];

  const businessColumns: Partial<ExcelJS.Column>[] =
    fields.map((field) => ({
      header: field,
      key: field,
      width: 20,
    }));

  const errorColumn: Partial<ExcelJS.Column> = {
    header: 'Error',
    key: 'error',
    width: 50,
  };

  return [
    ...frameworkColumns,
    ...businessColumns,
    errorColumn,
  ];
}

function createRow<
  TData extends Record<string, unknown>,
>(
  evidence: Evidence<TData>,
  fields: readonly (keyof TData & string)[],
): unknown[] {
  return [
    evidence.scenarioId,
    evidence.scenarioName,
    evidence.status,
    evidence.attempt,
    evidence.workerId,
    evidence.startTime ?? '',
    evidence.endTime ?? '',
    evidence.durationMs ?? '',

    ...fields.map((field) =>
      normalizeValue(
        evidence.data[field],
      ),
    ),

    evidence.error?.message ?? '',
  ];
}

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
