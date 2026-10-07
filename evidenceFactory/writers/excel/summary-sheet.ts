import type ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
import { EvidenceStatus } from '../../contracts/evidence-status';
import type { ReportConfig } from '../../contracts/report-config';

import {
  applyBodyStyle,
  applyHeaderStyle,
  EXCEL_COLORS,
} from './excel-style';

/**
 * Creates the workbook Summary worksheet.
 */
export function createSummarySheet<
  TData extends Record<string, unknown>,
>(
  workbook: ExcelJS.Workbook,
  evidence: Evidence<TData>[],
  config: ReportConfig,
): void {
  const worksheet =
    workbook.addWorksheet(
      'Summary',
      {
        views: [
          {
            state: 'frozen',
            ySplit: 1,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      width: 28,
    },
    {
      width: 42,
    },
  ];

  const total = evidence.length;

  const passed =
    evidence.filter(
      item =>
        item.status ===
        EvidenceStatus.PASSED,
    ).length;

  const failed =
    evidence.filter(
      item =>
        item.status ===
        EvidenceStatus.FAILED,
    ).length;

  const notExecuted =
    evidence.filter(
      item =>
        item.status ===
        EvidenceStatus.NOT_EXECUTED,
    ).length;

  const passRate =
    total === 0
      ? 0
      : passed / total;

  createTitle(
    worksheet,
    config.reportTitle ??
      'Execution Summary',
  );

  worksheet.addRow([]);

  createSectionHeader(
    worksheet,
    'Run Information',
  );

  const runId =
    evidence[0]?.runId ?? '';

  addInformationRow(
    worksheet,
    'Run ID',
    runId,
  );

  addInformationRow(
    worksheet,
    'Environment',
    config.environment ?? '',
  );

  addInformationRow(
    worksheet,
    'Generated At',
    new Date().toISOString(),
  );

  worksheet.addRow([]);

  createSectionHeader(
    worksheet,
    'Execution Results',
  );

  addMetricRow(
    worksheet,
    'Total',
    total,
  );

  addMetricRow(
    worksheet,
    'Passed',
    passed,
    EXCEL_COLORS.passedLight,
  );

  addMetricRow(
    worksheet,
    'Failed',
    failed,
    EXCEL_COLORS.failedLight,
  );

  addMetricRow(
    worksheet,
    'Not Executed',
    notExecuted,
    EXCEL_COLORS.notExecutedLight,
  );

  const passRateRow =
    addMetricRow(
      worksheet,
      'Pass Rate',
      passRate,
    );

  passRateRow.getCell(2).numFmt =
    '0.00%';
}

function createTitle(
  worksheet: ExcelJS.Worksheet,
  title: string,
): void {
  worksheet.mergeCells('A1:B1');

  const cell =
    worksheet.getCell('A1');

  cell.value = title;

  cell.font = {
    bold: true,
    size: 18,
    color: {
      argb: EXCEL_COLORS.white,
    },
  };

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: EXCEL_COLORS.primary,
    },
  };

  cell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  worksheet.getRow(1).height = 36;
}

/**
 * Adds a merged section heading.
 */
function createSectionHeader(
  worksheet: ExcelJS.Worksheet,
  title: string,
): void {
  const row =
    worksheet.addRow([
      title,
      '',
    ]);

  worksheet.mergeCells(
    `A${row.number}:B${row.number}`,
  );

  applyHeaderStyle(
    worksheet.getCell(
      `A${row.number}`,
    ),
  );

  row.height = 24;
}

function addInformationRow(
  worksheet: ExcelJS.Worksheet,
  label: string,
  value: string | number,
): ExcelJS.Row {
  const row =
    worksheet.addRow([
      label,
      value,
    ]);

  styleStandardRow(row);

  row.getCell(1).font = {
    bold: true,
  };

  return row;
}

function addMetricRow(
  worksheet: ExcelJS.Worksheet,
  label: string,
  value: string | number,
  fillColor?: string,
): ExcelJS.Row {
  const row =
    worksheet.addRow([
      label,
      value,
    ]);

  styleStandardRow(row);

  row.getCell(1).font = {
    bold: true,
  };

  if (fillColor) {
    row.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: fillColor,
      },
    };

    row.getCell(2).font = {
      bold: true,
    };
  }

  return row;
}

function styleStandardRow(
  row: ExcelJS.Row,
): void {
  row.eachCell(
    {
      includeEmpty: true,
    },
    cell => {
      applyBodyStyle(cell);
    },
  );
}
