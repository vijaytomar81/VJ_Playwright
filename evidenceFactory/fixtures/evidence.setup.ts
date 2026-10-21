import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import type { FullConfig } from '@playwright/test';

import { ReportFormat } from '../contracts/report-format';

import type { ReportConfig } from '../contracts/report-config';
import type { ReportField } from '../contracts/report-field';
import type { SummarySchema } from '../contracts/summary-schema';

interface EvidenceRunConfig {
  runId: string;
  resultsDir: string;
  evidenceFields: readonly ReportField[];
  reportConfig: ReportConfig;
}

interface EvidenceMetadata {
  evidence?: {
    evidenceFields?: readonly ReportField[];
    summarySchema?: SummarySchema;
  };
}

export default async function setupEvidence(
  config: FullConfig,
): Promise<void> {
  const runId = process.env.EVIDENCE_RUN_ID?.trim();

  if (!runId) {
    throw new Error(
      'EVIDENCE_RUN_ID is required. Set it before starting Playwright.',
    );
  }

  /*
   * Read consumer-owned schemas supplied once
   * through playwright.config.ts.
   */
  const metadata = config.metadata as EvidenceMetadata;

  const evidenceConfig = metadata.evidence;

  if (
    !evidenceConfig?.evidenceFields?.length ||
    !evidenceConfig.summarySchema?.length
  ) {
    throw new Error(
      'Evidence schemas must be supplied through playwright.config.ts metadata.evidence.',
    );
  }

  const { evidenceFields, summarySchema } = evidenceConfig;

  const resultsDir = path.resolve(
    process.env.EVIDENCE_RESULTS_DIR ?? 'results',
  );

  const runDir = path.join(resultsDir, runId);

  /*
   * Capture execution start time before
   * Playwright test workers begin.
   */
  const startedAt = new Date().toISOString();

  const reportConfig: ReportConfig = {
    format: ReportFormat.EXCEL,
    outputDir: path.join(runDir, 'reports'),
    fileName: `execution-report-${runId.replace(/^RUN-/, '')}.xlsx`,
    reportTitle: 'Allianz Automation Execution Report',
    environment: process.env.TEST_ENV ?? 'unknown',

    summarySchema,

    summaryData: {
      runId,
      environment: process.env.TEST_ENV ?? 'unknown',
      mode: process.env.TEST_MODE ?? 'E2E',
      evidenceDirectory: path.join(runDir, 'evidence'),
      machineName: os.hostname(),
      user: os.userInfo().username,
      platform: os.platform(),
      osVersion: os.release(),
      startedAt,
    },
  };

  const runConfig: EvidenceRunConfig = {
    runId,
    resultsDir,
    evidenceFields,
    reportConfig,
  };

  await fs.mkdir(runDir, {
    recursive: true,
  });

  const configPath = path.join(
    runDir,
    'run-config.json',
  );

  await fs.writeFile(
    configPath,
    JSON.stringify(runConfig, null, 2),
    'utf8',
  );

  console.log('\nEvidence setup completed.');
  console.log(`Run ID: ${runId}`);
  console.log(`Run configuration: ${configPath}`);
}