import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { test, expect } from '@playwright/test';

import {
  EvidenceFactory,
  EvidenceStatus,
  FileEvidenceStore,
  ReportFormat,
  type Evidence,
} from '../../../evidenceFactory';

import {
  evidenceFields,
  type EvidenceData,
} from '../../../configLayer/schema/evidence/evidence-schema';

/**
 * Step 10:
 *
 * Verify that worker JSON evidence survives a failed
 * report-generation attempt and can subsequently be
 * finalized successfully.
 *
 * This test uses its own temporary results directory,
 * so it does not affect the shared integration-test run.
 */
test('Preserve worker evidence when report generation fails', async () => {
  const resultsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'evidence-finalization-'),
  );

  const runId = 'finalization-failure-test';
  const workerId = 'worker-0';

  try {
    const factory = new EvidenceFactory<EvidenceData>({
      fields: evidenceFields,
      resultsDir,
      runId,
    });

    const store = new FileEvidenceStore<EvidenceData>({
      resultsDir,
      runId,
      workerId,
    });

    const now = new Date().toISOString();

    const evidence: Evidence<EvidenceData> = {
      runId,
      workerId,
      attempt: 1,

      scenarioId: 'FAILURE-TEST-001',
      scenarioName: 'Verify cleanup safety',
      status: EvidenceStatus.PASSED,

      startTime: now,
      endTime: now,
      durationMs: 0,

      data: {
        policyNumber: 'POL-FAILURE-001',
      },
    };

    /**
     * Step 1: Record worker evidence.
     */
    await factory.record(evidence, store);

    const workerFilePath = path.join(
      resultsDir,
      runId,
      'evidence',
      `${workerId}.json`,
    );

    const workerEvidenceBefore = await fs.readFile(
      workerFilePath,
      'utf8',
    );

    expect(
      JSON.parse(workerEvidenceBefore),
    ).toHaveLength(1);

    /**
     * Step 2: Force report generation to fail.
     *
     * Create a regular file at the location where
     * finalize() expects a report directory.
     *
     * This prevents the report generator from
     * creating its output directory.
     */
    const blockedReportDirectory = path.join(
      resultsDir,
      runId,
      'blocked-report-directory',
    );

    await fs.writeFile(
      blockedReportDirectory,
      'This is a file, not a directory.',
      'utf8',
    );

    /**
     * Step 3: Attempt finalization.
     *
     * Consolidation may succeed, but report
     * generation must fail because its output
     * directory is blocked.
     */
    let finalizationError: unknown;

    try {
      await factory.finalize({
        format: ReportFormat.EXCEL,
        outputDir: blockedReportDirectory,
        fileName: 'should-not-be-created',
      });
    } catch (error) {
      finalizationError = error;
    }

    expect(finalizationError).toBeDefined();

    /**
     * Step 4: Verify worker JSON was NOT deleted.
     */
    const workerEvidenceAfterFailure =
      await fs.readFile(
        workerFilePath,
        'utf8',
      );

    expect(workerEvidenceAfterFailure).toBe(
      workerEvidenceBefore,
    );

    const preservedEvidence = JSON.parse(
      workerEvidenceAfterFailure,
    ) as Evidence<EvidenceData>[];

    expect(preservedEvidence).toHaveLength(1);

    expect(preservedEvidence[0].scenarioId).toBe(
      'FAILURE-TEST-001',
    );

    expect(preservedEvidence[0].attempt).toBe(1);

    /**
     * Step 5: Retry finalization with a valid
     * report directory.
     */
    const validReportDirectory = path.join(
      resultsDir,
      runId,
      'report',
    );

    const result = await factory.finalize({
      format: ReportFormat.EXCEL,
      outputDir: validReportDirectory,
      fileName: 'recovered-report',
    });

    expect(result.evidenceCount).toBe(1);

    /**
     * Step 6: Verify the consolidated JSON
     * contains the preserved evidence.
     */
    const consolidatedContent = await fs.readFile(
      result.consolidatedPath,
      'utf8',
    );

    const consolidatedEvidence = JSON.parse(
      consolidatedContent,
    ) as Evidence<EvidenceData>[];

    expect(consolidatedEvidence).toHaveLength(1);

    expect(consolidatedEvidence[0].scenarioId).toBe(
      'FAILURE-TEST-001',
    );

    /**
     * Step 7: Verify the Excel report exists.
     */
    const reportStat = await fs.stat(
      result.reportPath,
    );

    expect(reportStat.isFile()).toBe(true);

    /**
     * Step 8: Verify worker cleanup happens
     * after successful finalization.
     */
    const remainingEvidenceFiles = await fs.readdir(
      path.join(resultsDir, runId, 'evidence'),
    );

    const remainingWorkerFiles =
      remainingEvidenceFiles.filter(
        fileName =>
          /^worker-\d+\.json$/.test(fileName),
      );

    expect(remainingWorkerFiles).toHaveLength(0);

    expect(result.deletedWorkerFiles).toBe(1);

    /**
     * Step 9: Verify evidence remains accessible
     * after worker cleanup.
     */
    const evidenceAfterCleanup =
      await factory.getAllAttempts();

    expect(evidenceAfterCleanup).toHaveLength(1);

    console.log(
      'Failed finalization preserved worker evidence.',
    );

    console.log(
      'Successful retry generated the report.',
    );

    console.log(
      `Consolidated JSON: ${result.consolidatedPath}`,
    );

    console.log(
      `Excel report: ${result.reportPath}`,
    );

    console.log(
      `Worker files deleted: ${result.deletedWorkerFiles}`,
    );
  } finally {
    /**
     * Remove only this test's temporary directory.
     *
     * The real results/ directory is untouched.
     */
    await fs.rm(resultsDir, {
      recursive: true,
      force: true,
    });
  }
});
