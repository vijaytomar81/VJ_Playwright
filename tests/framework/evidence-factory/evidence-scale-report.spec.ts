import fs from 'node:fs/promises';
import path from 'node:path';

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

/**
 * Step 11C:
 *
 * Verify 40 scenarios across 4 logical workers.
 *
 * This test executes after the evidence-scale project
 * because of the dependency in playwright.config.ts.
 */
test('Finalize 40 scenarios across 4 workers', async () => {
  const runId = process.env.EVIDENCE_SCALE_RUN_ID;

  if (!runId) {
    throw new Error(
      'EVIDENCE_SCALE_RUN_ID is required. ' +
      'Set it before running the scale-report project.',
    );
  }

  const resultsDir = './results';

  const evidenceDirectory = path.join(
    resultsDir,
    runId,
    'evidence',
  );

  const reportDirectory = path.join(
    resultsDir,
    runId,
    'report',
  );

  const factory = new EvidenceFactory<EvidenceData>({
    fields: evidenceFields,
    resultsDir,
    runId,
  });

  /**
   * Step 1: Verify all 40 attempts were recorded.
   */
  const allAttempts = await factory.getAllAttempts();

  expect(allAttempts).toHaveLength(40);

  /**
   * Step 2: Verify all 40 scenario IDs are unique.
   */
  const scenarioIds = allAttempts.map(
    item => item.scenarioId,
  );

  const uniqueScenarioIds = new Set(scenarioIds);

  expect(uniqueScenarioIds.size).toBe(40);

  const expectedScenarioIds = Array.from(
    { length: 40 },
    (_, index) =>
      `SCALE-${String(index + 1).padStart(3, '0')}`,
  );

  expect([...uniqueScenarioIds].sort()).toEqual(
    expectedScenarioIds,
  );

  /**
   * Step 3: Verify each scenario passed.
   */
  for (const evidence of allAttempts) {
    expect(evidence.status).toBe(
      EvidenceStatus.PASSED,
    );

    expect(evidence.attempt).toBe(1);
    expect(evidence.runId).toBe(runId);
  }

  /**
   * Step 4: Verify all 4 worker JSON files exist.
   */
  const filesBeforeFinalization =
    await fs.readdir(evidenceDirectory);

  const workerFilesBefore = filesBeforeFinalization
    .filter(fileName =>
      /^worker-\d+\.json$/.test(fileName),
    )
    .sort();

  expect(workerFilesBefore).toEqual([
    'worker-0.json',
    'worker-1.json',
    'worker-2.json',
    'worker-3.json',
  ]);

  /**
   * Step 5: Verify each worker file contains
   * a JSON array and contributes evidence.
   */
  let totalWorkerRecords = 0;

  for (const workerFile of workerFilesBefore) {
    const workerPath = path.join(
      evidenceDirectory,
      workerFile,
    );

    const content = await fs.readFile(
      workerPath,
      'utf8',
    );

    const records = JSON.parse(content) as
      Evidence<EvidenceData>[];

    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);

    for (const record of records) {
      expect(`${record.workerId}.json`).toBe(
        workerFile,
      );
    }

    totalWorkerRecords += records.length;
  }

  expect(totalWorkerRecords).toBe(40);

  /**
   * Step 6: Verify latest attempts.
   */
  const finalEvidence =
    await factory.getFinalEvidence();

  expect(finalEvidence).toHaveLength(40);

  /**
   * Step 7: Finalize the evidence run.
   *
   * Consolidate all attempts, generate Excel,
   * then delete the worker JSON files.
   */
  const result = await factory.finalize({
    format: ReportFormat.EXCEL,
    outputDir: reportDirectory,
    fileName: 'scale-execution-report',
  });

  expect(result.evidenceCount).toBe(40);
  expect(result.deletedWorkerFiles).toBe(4);

  /**
   * Step 8: Verify consolidated JSON.
   */
  const consolidatedContent = await fs.readFile(
    result.consolidatedPath,
    'utf8',
  );

  const consolidatedEvidence = JSON.parse(
    consolidatedContent,
  ) as Evidence<EvidenceData>[];

  expect(consolidatedEvidence).toHaveLength(40);

  const consolidatedIds = consolidatedEvidence
    .map(item => item.scenarioId)
    .sort();

  expect(consolidatedIds).toEqual(
    expectedScenarioIds,
  );

  /**
   * Step 9: Verify all worker JSON files
   * were deleted after successful finalization.
   */
  const filesAfterFinalization =
    await fs.readdir(evidenceDirectory);

  const workerFilesAfter = filesAfterFinalization
    .filter(fileName =>
      /^worker-\d+\.json$/.test(fileName),
    );

  expect(workerFilesAfter).toHaveLength(0);

  /**
   * Step 10: Verify evidence remains accessible
   * after worker-file cleanup.
   */
  const attemptsAfterCleanup =
    await factory.getAllAttempts();

  expect(attemptsAfterCleanup).toHaveLength(40);

  const finalAfterCleanup =
    await factory.getFinalEvidence();

  expect(finalAfterCleanup).toHaveLength(40);

  /**
   * Step 11: Verify the Excel workbook.
   */
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(
    result.reportPath,
  );

  const allSheet = workbook.getWorksheet('All');
  const passedSheet = workbook.getWorksheet('Passed');
  const failedSheet = workbook.getWorksheet('Failed');
  const notExecutedSheet =
    workbook.getWorksheet('Not Executed');

  expect(allSheet).toBeDefined();
  expect(passedSheet).toBeDefined();
  expect(failedSheet).toBeDefined();
  expect(notExecutedSheet).toBeDefined();

  expect(allSheet!.rowCount - 1).toBe(40);
  expect(passedSheet!.rowCount - 1).toBe(40);
  expect(failedSheet!.rowCount - 1).toBe(0);
  expect(notExecutedSheet!.rowCount - 1).toBe(0);

  /**
   * Step 12: Print results.
   */
  console.log(`Run ID: ${runId}`);
  console.log('Scenarios executed: 40');
  console.log('Logical workers: 4');
  console.log(
    `Consolidated JSON: ${result.consolidatedPath}`,
  );
  console.log(
    `Excel report: ${result.reportPath}`,
  );
  console.log(
    `Evidence count: ${result.evidenceCount}`,
  );
  console.log(
    `Worker files deleted: ${result.deletedWorkerFiles}`,
  );
});
