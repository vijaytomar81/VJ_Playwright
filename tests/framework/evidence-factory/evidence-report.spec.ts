import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

import {
  EvidenceFactory,
  EvidenceStatus,
  ReportFormat,
  type Evidence,
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
 * Validates the complete EvidenceFactory lifecycle:
 *
 * 1. Read all attempts from worker JSON files.
 * 2. Select the latest attempt for each scenario.
 * 3. Consolidate all attempts into one JSON file.
 * 4. Generate an Excel report using final attempts.
 * 5. Delete worker JSON files after successful finalization.
 * 6. Verify consolidated evidence remains readable.
 *
 * This test must execute after evidence-collection.
 */
test('Generate and finalize evidence report with retries', async () => {
  const { runId, timestamp } =
    await getTestRunContext();

  const resultsDir = './results';

  const factory = new EvidenceFactory<EvidenceData>({
    fields: evidenceFields,
    resultsDir,
    runId,
  });

  /**
   * Step 1: Read all recorded attempts.
   *
   * Expected:
   * TC-001: attempt 1 - PASSED
   * TC-002: attempt 1 - PASSED
   * TC-003: attempt 1 - FAILED
   * TC-003: attempt 2 - PASSED
   * TC-004: attempt 1 - NOT_EXECUTED
   */
  const allAttempts =
    await factory.getAllAttempts();

  expect(allAttempts).toHaveLength(5);

  /**
   * Step 2: Verify both TC-003 attempts are retained.
   */
  const tc003Attempts = allAttempts
    .filter(
      item => item.scenarioId === 'TC-003',
    )
    .sort(
      (a, b) => a.attempt - b.attempt,
    );

  expect(tc003Attempts).toHaveLength(2);

  expect(tc003Attempts[0].attempt).toBe(1);
  expect(tc003Attempts[0].status).toBe(
    EvidenceStatus.FAILED,
  );

  expect(tc003Attempts[1].attempt).toBe(2);
  expect(tc003Attempts[1].status).toBe(
    EvidenceStatus.PASSED,
  );

  /**
   * Step 3: Read the latest attempt per scenario.
   */
  const finalEvidence =
    await factory.getFinalEvidence();

  expect(finalEvidence).toHaveLength(4);

  const tc003Final = finalEvidence.find(
    item => item.scenarioId === 'TC-003',
  );

  expect(tc003Final).toBeDefined();
  expect(tc003Final!.attempt).toBe(2);
  expect(tc003Final!.status).toBe(
    EvidenceStatus.PASSED,
  );

  /**
   * Step 4: Verify final scenario status counts.
   *
   * Passed:       3
   * Failed:       0
   * Not Executed: 1
   */
  const passed = finalEvidence.filter(
    item => item.status === EvidenceStatus.PASSED,
  );

  const failed = finalEvidence.filter(
    item => item.status === EvidenceStatus.FAILED,
  );

  const notExecuted = finalEvidence.filter(
    item =>
      item.status === EvidenceStatus.NOT_EXECUTED,
  );

  expect(passed).toHaveLength(3);
  expect(failed).toHaveLength(0);
  expect(notExecuted).toHaveLength(1);

  /**
   * Step 5: Prepare report paths.
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
   * Step 6: Derive execution timing.
   */
  const startTimes = finalEvidence
    .map(item => item.startTime)
    .filter(
      (value): value is string => Boolean(value),
    )
    .map(value => new Date(value).getTime())
    .filter(Number.isFinite);

  const endTimes = finalEvidence
    .map(item => item.endTime)
    .filter(
      (value): value is string => Boolean(value),
    )
    .map(value => new Date(value).getTime())
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
   * Step 7: Finalize the run.
   *
   * Consolidated JSON retains all 5 attempts.
   * Excel report includes only 4 final scenarios.
   */
  const result = await factory.finalize({
    format: ReportFormat.EXCEL,

    outputDir: reportOutputDir,
    fileName: reportFileName,

    reportTitle: 'Execution Summary',
    environment: 'test',

    summarySchema,

    summaryData: {
      runId,
      mode: 'e2e',
      environment: 'test',
      evidenceDirectory,

      machineName: os.hostname(),
      user: os.userInfo().username,
      platform: process.platform,
      osVersion: os.release(),

      browser: 'chromium',
      browserChannel: 'msedge',
      browserVersion: 'Not captured',
      headless: true,

      executionTime,
      startedAt,
      finishedAt,
    },
  });

  /**
   * Step 8: Verify finalization metadata.
   */
  expect(result.evidenceCount).toBe(4);
  expect(result.reports).toHaveLength(1);

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
   * Step 9: Verify consolidated JSON path.
   */
  const expectedConsolidatedPath = path.join(
    evidenceDirectory,
    'consolidated-evidence.json',
  );

  expect(
    path.resolve(result.consolidatedPath),
  ).toBe(
    path.resolve(expectedConsolidatedPath),
  );

  /**
   * Step 10: Read consolidated JSON.
   */
  const consolidatedContent =
    await fs.readFile(
      result.consolidatedPath,
      'utf8',
    );

  const consolidatedEvidence =
    JSON.parse(consolidatedContent) as
      Evidence<EvidenceData>[];

  expect(consolidatedEvidence).toHaveLength(5);

  /**
   * Verify all 4 unique scenarios exist.
   */
  const uniqueScenarioIds = [
    ...new Set(
      consolidatedEvidence.map(
        item => item.scenarioId,
      ),
    ),
  ].sort();

  expect(uniqueScenarioIds).toEqual([
    'TC-001',
    'TC-002',
    'TC-003',
    'TC-004',
  ]);

  /**
   * Step 11: Verify both retry attempts survived
   * consolidation.
   */
  const consolidatedTC003 =
    consolidatedEvidence
      .filter(
        item => item.scenarioId === 'TC-003',
      )
      .sort(
        (a, b) => a.attempt - b.attempt,
      );

  expect(consolidatedTC003).toHaveLength(2);

  expect(consolidatedTC003[0].attempt).toBe(1);
  expect(consolidatedTC003[0].status).toBe(
    EvidenceStatus.FAILED,
  );

  expect(consolidatedTC003[1].attempt).toBe(2);
  expect(consolidatedTC003[1].status).toBe(
    EvidenceStatus.PASSED,
  );

  /**
   * Step 12: Verify worker JSON cleanup.
   */
  const remainingFiles =
    await fs.readdir(evidenceDirectory);

  const workerFiles = remainingFiles.filter(
    fileName =>
      /^worker-\d+\.json$/.test(fileName),
  );

  expect(workerFiles).toHaveLength(0);

  /**
   * Step 13: Verify evidence is readable after cleanup.
   */
  const evidenceAfterCleanup =
    await factory.getAllAttempts();

  expect(evidenceAfterCleanup).toHaveLength(5);

  const finalEvidenceAfterCleanup =
    await factory.getFinalEvidence();

  expect(finalEvidenceAfterCleanup).toHaveLength(4);

  /**
   * Step 14: Read the Excel workbook.
   */
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(
    result.reportPath,
  );

  const worksheetNames =
    workbook.worksheets.map(
      worksheet => worksheet.name,
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
   * Step 15: Verify Excel uses final attempts only.
   */
  expect(allSheet!.rowCount - 1).toBe(4);
  expect(passedSheet!.rowCount - 1).toBe(3);
  expect(failedSheet!.rowCount - 1).toBe(0);
  expect(
    notExecutedSheet!.rowCount - 1,
  ).toBe(1);

  /**
   * Step 16: Validate column order and labels.
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
   * Step 17: Validate business evidence.
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

  expect(policyNumbers).toContain('POL-1001');
  expect(policyNumbers).toContain('POL-1002');
  expect(policyNumbers).toContain('POL-1003');

  /**
   * Step 18: Validate summary sections.
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

    summaryRow++;
  }

  /**
   * Step 19: Validate summary calculations.
   */
  const summaryValues =
    new Map<string, unknown>();

  summarySheet!.eachRow(row => {
    const label = row.getCell(1).value;
    const value = row.getCell(2).value;

    if (typeof label === 'string') {
      summaryValues.set(label, value);
    }
  });

  expect(
    summaryValues.get('Total Items'),
  ).toBe(4);

  expect(
    summaryValues.get('Passed'),
  ).toBe(3);

  expect(
    summaryValues.get('Failed'),
  ).toBe(0);

  expect(
    summaryValues.get('Not Executed'),
  ).toBe(1);

  expect(
    summaryValues.get('Pass Rate (%)'),
  ).toBe('75.00%');

  /**
   * Step 20: Print finalization results.
   */
  console.log(`Run ID: ${runId}`);
  console.log(
    `Consolidated JSON: ${result.consolidatedPath}`,
  );
  console.log(
    `Excel report: ${result.reportPath}`,
  );
  console.log(
    `Total attempts: ${consolidatedEvidence.length}`,
  );
  console.log(
    `Final scenarios: ${result.evidenceCount}`,
  );
  console.log(
    `Worker files deleted: ${result.deletedWorkerFiles}`,
  );
});
