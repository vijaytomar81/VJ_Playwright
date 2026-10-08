import path from 'node:path';

import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

import {
  EvidenceFactory,
  EvidenceStatus,
  ReportFormat,
} from '../../../evidenceFactory';

import {
  evidenceFields,
  type EvidenceData,
} from '../../../configLayer/schema/evidence/evidence-schema';

import {
  getTestRunContext,
} from './test-run-context';

/**
 * Generates and validates the final Excel evidence report.
 *
 * Run this test after all scenario workers have completed.
 */
test('Generate final Excel evidence report', async () => {
  /**
   * Read the same execution context used by
   * the four scenario workers.
   */
  const { runId, timestamp } =
    await getTestRunContext();

  const resultsDir = './results';

  /**
   * Initialize EvidenceFactory using the shared runId.
   */
  const factory = new EvidenceFactory<EvidenceData>({
    fields: evidenceFields,
    resultsDir,
    runId,
  });

  /**
   * Verify the evidence from all workers.
   */
  const finalEvidence =
    await factory.getFinalEvidence();

  expect(finalEvidence).toHaveLength(4);

  /**
   * Verify execution status counts.
   */
  const passed = finalEvidence.filter(
    (item) => item.status === EvidenceStatus.PASSED,
  );

  const failed = finalEvidence.filter(
    (item) => item.status === EvidenceStatus.FAILED,
  );

  const notExecuted = finalEvidence.filter(
    (item) =>
      item.status === EvidenceStatus.NOT_EXECUTED,
  );

  expect(passed).toHaveLength(2);
  expect(failed).toHaveLength(1);
  expect(notExecuted).toHaveLength(1);

  /**
   * Generate timestamped Excel report.
   */
  const reportFileName =
    `execution-report_${timestamp}`;

  const reportOutputDir = path.join(
    resultsDir,
    runId,
    'report',
  );

  const result = await factory.generateReport({
    format: ReportFormat.EXCEL,
    outputDir: reportOutputDir,
    fileName: reportFileName,
    reportTitle: 'Automation Execution Report',
    environment: 'QA',
  });

  /**
   * Verify report generation result.
   */
  expect(result.evidenceCount).toBe(4);

  const expectedReportPath = path.join(
    reportOutputDir,
    `${reportFileName}.xlsx`,
  );

  expect(
    path.resolve(result.reportPath),
  ).toBe(
    path.resolve(expectedReportPath),
  );

  /**
   * Open the generated Excel workbook.
   */
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(
    result.reportPath,
  );

  /**
   * Verify worksheet names.
   */
  const worksheetNames =
    workbook.worksheets.map(
      (worksheet) => worksheet.name,
    );

  expect(worksheetNames).toEqual([
    'Summary',
    'All',
    'Passed',
    'Failed',
    'Not Executed',
  ]);

  /**
   * Verify scenario counts in each worksheet.
   *
   * Row 1 contains the column headers.
   */
  const allSheet =
    workbook.getWorksheet('All');

  const passedSheet =
    workbook.getWorksheet('Passed');

  const failedSheet =
    workbook.getWorksheet('Failed');

  const notExecutedSheet =
    workbook.getWorksheet('Not Executed');

  expect(allSheet).toBeDefined();
  expect(passedSheet).toBeDefined();
  expect(failedSheet).toBeDefined();
  expect(notExecutedSheet).toBeDefined();

  expect(allSheet!.rowCount - 1).toBe(4);
  expect(passedSheet!.rowCount - 1).toBe(2);
  expect(failedSheet!.rowCount - 1).toBe(1);
  expect(notExecutedSheet!.rowCount - 1).toBe(1);

  /**
   * Verify that report columns follow
   * the order configured in configLayer.
   */
  const expectedFields = [...evidenceFields]
    .sort((a, b) => a.order - b.order)
    .map(({ field }) => field);

  const actualFields = allSheet!
    .getRow(1)
    .values;

  /**
   * ExcelJS row.values uses a 1-based array.
   * Remove the empty first element.
   */
  const actualHeaders = (
    actualFields as Array<string | undefined>
  ).slice(1);

  expect(actualHeaders).toEqual(
    expectedFields,
  );

  /**
   * Verify that business evidence values
   * appear in the generated report.
   */
  const policyNumberColumn =
    expectedFields.indexOf('policyNumber') + 1;

  const policyNumbers = [];

  for (
    let rowNumber = 2;
    rowNumber <= allSheet!.rowCount;
    rowNumber++
  ) {
    const value = allSheet!
      .getRow(rowNumber)
      .getCell(policyNumberColumn)
      .value;

    policyNumbers.push(value);
  }

  expect(policyNumbers).toContain('POL-1001');
  expect(policyNumbers).toContain('POL-1002');
  expect(policyNumbers).toContain('POL-1003');

  console.log(`Run ID: ${runId}`);
  console.log(`Report: ${result.reportPath}`);
  console.log(`Evidence count: ${result.evidenceCount}`);
});
