import path from 'node:path';
import os from 'node:os';

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
  summarySchema,
} from '../../../configLayer/schema/evidence/summary-schema';

import {
  getTestRunContext,
} from './test-run-context';

/**
 * Generates and validates the final Excel
 * evidence report after workers complete.
 */
test('Generate final Excel evidence report', async () => {
  const { runId, timestamp } =
    await getTestRunContext();

  const resultsDir = './results';

  /**
   * Initialize EvidenceFactory.
   */
  const factory = new EvidenceFactory<EvidenceData>({
    fields: evidenceFields,
    resultsDir,
    runId,
  });

  /**
   * Collect final evidence from all workers.
   */
  const finalEvidence =
    await factory.getFinalEvidence();

  expect(finalEvidence).toHaveLength(4);

  /**
   * Validate execution results.
   */
  const passed = finalEvidence.filter(
    (item) =>
      item.status === EvidenceStatus.PASSED,
  );

  const failed = finalEvidence.filter(
    (item) =>
      item.status === EvidenceStatus.FAILED,
  );

  const notExecuted = finalEvidence.filter(
    (item) =>
      item.status === EvidenceStatus.NOT_EXECUTED,
  );

  expect(passed).toHaveLength(2);
  expect(failed).toHaveLength(1);
  expect(notExecuted).toHaveLength(1);

  /**
   * Prepare report paths.
   */
  const reportFileName =
    `execution-report_${timestamp}`;

  const reportOutputDir = path.join(
    resultsDir,
    runId,
    'report',
  );

  const evidenceDirectory = path.join(
    resultsDir,
    runId,
    'evidence',
  );

  /**
   * Derive timing information from evidence.
   */
  const startTimes = finalEvidence
    .map((item) => item.startTime)
    .filter(
      (value): value is string =>
        Boolean(value),
    )
    .map((value) =>
      new Date(value).getTime(),
    )
    .filter(Number.isFinite);

  const endTimes = finalEvidence
    .map((item) => item.endTime)
    .filter(
      (value): value is string =>
        Boolean(value),
    )
    .map((value) =>
      new Date(value).getTime(),
    )
    .filter(Number.isFinite);

  const startedAt =
    startTimes.length > 0
      ? new Date(
          Math.min(...startTimes),
        ).toISOString()
      : '';

  const finishedAt =
    endTimes.length > 0
      ? new Date(
          Math.max(...endTimes),
        ).toISOString()
      : '';

  const executionTime =
    startTimes.length > 0 &&
    endTimes.length > 0
      ? `${(
          (
            Math.max(...endTimes) -
            Math.min(...startTimes)
          ) / 1000
        ).toFixed(2)}s`
      : '';

  /**
   * Generate the Excel report.
   */
  const result = await factory.generateReport({
    format: ReportFormat.EXCEL,

    outputDir: reportOutputDir,
    fileName: reportFileName,

    reportTitle: 'Execution Summary',
    environment: 'test',

    summarySchema,

    summaryData: {
      // Run
      runId,
      mode: 'e2e',
      environment: 'test',
      evidenceDirectory,

      // Runtime
      machineName: os.hostname(),
      user: os.userInfo().username,
      platform: process.platform,
      osVersion: os.release(),

      // Browser
      browser: 'chromium',
      browserChannel: 'msedge',
      browserVersion: 'Not captured',
      headless: true,

      // Timing
      executionTime,
      startedAt,
      finishedAt,
    },
  });

  /**
   * Verify report output.
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
   * Read the generated workbook.
   */
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(
    result.reportPath,
  );

  /**
   * Validate worksheet names.
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

  const summarySheet =
    workbook.getWorksheet('Summary');

  const allSheet =
    workbook.getWorksheet('All');

  const passedSheet =
    workbook.getWorksheet('Passed');

  const failedSheet =
    workbook.getWorksheet('Failed');

  const notExecutedSheet =
    workbook.getWorksheet('Not Executed');

  expect(summarySheet).toBeDefined();
  expect(allSheet).toBeDefined();
  expect(passedSheet).toBeDefined();
  expect(failedSheet).toBeDefined();
  expect(notExecutedSheet).toBeDefined();

  /**
   * Validate evidence row counts.
   */
  expect(allSheet!.rowCount - 1).toBe(4);
  expect(passedSheet!.rowCount - 1).toBe(2);
  expect(failedSheet!.rowCount - 1).toBe(1);
  expect(
    notExecutedSheet!.rowCount - 1,
  ).toBe(1);

  /**
   * Validate column identifiers, labels,
   * and order from evidenceFields.
   */
  const orderedEvidenceFields = [
    ...evidenceFields,
  ].sort(
    (a, b) => a.order - b.order,
  );

  const expectedFields =
    orderedEvidenceFields.map(
      ({ field }) => field,
    );

  const expectedHeaders =
    orderedEvidenceFields.map(
      ({ label }) => label,
    );

  const actualHeaders = (
    allSheet!.getRow(1).values as Array<
      string | undefined
    >
  ).slice(1);

  expect(actualHeaders).toEqual(
    expectedHeaders,
  );

  /**
   * Validate business evidence values.
   */
  const policyNumberColumn =
    expectedFields.indexOf(
      'policyNumber',
    ) + 1;

  const policyNumbers: unknown[] = [];

  for (
    let rowNumber = 2;
    rowNumber <= allSheet!.rowCount;
    rowNumber++
  ) {
    policyNumbers.push(
      allSheet!
        .getRow(rowNumber)
        .getCell(policyNumberColumn)
        .value,
    );
  }

  expect(policyNumbers).toContain(
    'POL-1001',
  );

  expect(policyNumbers).toContain(
    'POL-1002',
  );

  expect(policyNumbers).toContain(
    'POL-1003',
  );

  /**
   * Validate Summary sections and field labels.
   */
  const orderedSections = [
    ...summarySchema,
  ].sort(
    (a, b) => a.order - b.order,
  );

  let summaryRow = 4;

  for (const section of orderedSections) {
    expect(
      summarySheet!
        .getCell(summaryRow, 1)
        .value,
    ).toBe(section.section);

    summaryRow++;

    const orderedFields = [
      ...section.fields,
    ].sort(
      (a, b) => a.order - b.order,
    );

    for (const field of orderedFields) {
      expect(
        summarySheet!
          .getCell(summaryRow, 1)
          .value,
      ).toBe(field.label);

      summaryRow++;
    }

    /**
     * Skip the blank row between sections.
     */
    summaryRow++;
  }

  /**
   * Read Summary label/value pairs.
   */
  const summaryValues =
    new Map<string, unknown>();

  summarySheet!.eachRow((row) => {
    const label =
      row.getCell(1).value;

    const value =
      row.getCell(2).value;

    if (
      typeof label === 'string'
    ) {
      summaryValues.set(
        label,
        value,
      );
    }
  });

  /**
   * Validate calculated results.
   */
  expect(
    summaryValues.get('Total Items'),
  ).toBe(4);

  expect(
    summaryValues.get('Passed'),
  ).toBe(2);

  expect(
    summaryValues.get('Failed'),
  ).toBe(1);

  expect(
    summaryValues.get('Not Executed'),
  ).toBe(1);

  expect(
    summaryValues.get('Pass Rate (%)'),
  ).toBe('50.00%');

  /**
   * Print report information.
   */
  console.log(
    `Run ID: ${runId}`,
  );

  console.log(
    `Report: ${result.reportPath}`,
  );

  console.log(
    `Evidence count: ${result.evidenceCount}`,
  );
});
