
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import type { FullConfig } from '@playwright/test';

import { ReportFormat } from '../contracts/report-format';

import type { ReportConfig } from '../contracts/report-config';
import type { ReportField } from '../contracts/report-field';
import type { SummarySchema } from '../contracts/summary-schema';

import type { ArchiveConfig } from '../archive/archive-config';
import type { EvidenceConfiguration } from '../config/evidence-config';

/**
 * Persisted execution configuration.
 *
 * Written during global setup and consumed during
 * EvidenceFactory global teardown.
 */
interface EvidenceRunConfig {
  runId: string;
  resultsDir: string;
  evidenceFields: readonly ReportField[];
  reportConfig: ReportConfig;
  archiveConfig: ArchiveConfig;
}

/**
 * EvidenceFactory metadata supplied by
 * playwright.config.base.ts.
 */
interface EvidenceMetadata {
  evidence?: {
    evidenceFields?: readonly ReportField[];
    summarySchema?: SummarySchema;
    config?: EvidenceConfiguration;
  };
}

/**
 * Initializes EvidenceFactory before Playwright
 * test workers begin execution.
 */
export default async function setupEvidence(
  config: FullConfig,
): Promise<void> {
  /**
   * Read the run ID initialized by
   * evidenceFactory/fixtures/evidence.run.ts.
   */
  const runId = process.env.EVIDENCE_RUN_ID?.trim();

  if (!runId) {
    throw new Error(
      'EVIDENCE_RUN_ID is required. Initialize it before starting Playwright.',
    );
  }

  /**
   * Read consumer-owned schemas and centralized
   * configuration from Playwright metadata.
   */
  const metadata = config.metadata as EvidenceMetadata;

  const evidenceMetadata = metadata.evidence;

  if (
    !evidenceMetadata?.evidenceFields?.length ||
    !evidenceMetadata.summarySchema?.length
  ) {
    throw new Error(
      'Evidence schemas must be supplied through playwright.config.ts metadata.evidence.',
    );
  }

  if (!evidenceMetadata.config) {
    throw new Error(
      'Centralized EvidenceFactory configuration is missing from playwright.config.ts metadata.evidence.config.',
    );
  }

  const {
    evidenceFields,
    summarySchema,
  } = evidenceMetadata;

  const settings = evidenceMetadata.config;

  /**
   * Resolve the configured EvidenceFactory root directory.
   *
   * Example:
   *   custom-test-reports/
   *
   * This is the single root for:
   * - Run configuration
   * - Worker evidence
   * - Browser metadata
   * - Consolidated evidence
   * - Excel reports
   * - ZIP archives
   */
  const resultsDir = path.resolve(
    settings.storage.resultsDirectory,
  );

  /**
   * Each execution gets its own run directory.
   *
   * Example:
   *   custom-test-reports/RUN-001/
   */
  const runDir = path.join(
    resultsDir,
    runId,
  );

  /**
   * Validate that Playwright initialization,
   * evidence workers, and global teardown
   * use the same configured root directory.
   */
  const configuredResultsDir = path.resolve(
    process.env.EVIDENCE_RESULTS_DIR ?? 'results',
  );

  if (configuredResultsDir !== resultsDir) {
    throw new Error(
      `EvidenceFactory results directory mismatch. ` +
      `Configuration: "${resultsDir}", ` +
      `Environment: "${configuredResultsDir}".`,
    );
  }

  /**
   * Resolve the Excel report directory inside
   * the current execution run.
   *
   * Example:
   *   custom-test-reports/RUN-001/reports/
   *
   * This ensures the Excel report is included
   * when ArchiveManager compresses the run folder.
   */
  const reportOutputDir = path.join(
    runDir,
    settings.report.directoryName,
  );

  /**
   * Resolve archive directory under the same
   * configured EvidenceFactory root.
   *
   * Example:
   *   custom-test-reports/evidence-archives/
   *
   * ArchiveManager automatically generates:
   *   <runId>.zip
   */
  const archiveConfig: ArchiveConfig = {
    enabled: settings.archive.enabled,

    archiveDir: path.join(
      resultsDir,
      settings.archive.directoryName,
    ),

    policy: {
      ...settings.archive.policy,
    },
  };

  /**
   * Validate supported report format.
   *
   * The centralized configuration currently
   * supports Excel report generation.
   */
  if (settings.report.format !== 'excel') {
    throw new Error(
      `Unsupported EvidenceFactory report format: "${settings.report.format}".`,
    );
  }

  /**
   * Capture execution start time before
   * Playwright test workers begin.
   */
  const startedAt = new Date().toISOString();

  /**
   * Build the existing ReportConfig using
   * centralized configuration values.
   *
   * Existing Summary schema and execution
   * metadata are preserved.
   */
  const reportConfig: ReportConfig = {
    format: ReportFormat.EXCEL,

    outputDir: reportOutputDir,

    fileName:
      `${settings.report.fileNamePrefix}-` +
      `${runId.replace(/^RUN-/, '')}.xlsx`,

    reportTitle: settings.report.title,

    environment: process.env.TEST_ENV ?? 'unknown',

    summarySchema,

    summaryData: {
      runId,
      environment: process.env.TEST_ENV ?? 'unknown',
      mode: process.env.TEST_MODE ?? 'E2E',

      evidenceDirectory: path.join(
        runDir,
        settings.storage.evidenceDirectoryName,
      ),

      machineName: os.hostname(),
      user: os.userInfo().username,
      platform: os.platform(),
      osVersion: os.release(),
      startedAt,
    },
  };

  /**
   * Persist the resolved configuration.
   *
   * Global teardown reads this file to retrieve:
   * - Run ID
   * - Results directory
   * - Evidence field definitions
   * - Report configuration
   * - Archive configuration
   */
  const runConfig: EvidenceRunConfig = {
    runId,
    resultsDir,
    evidenceFields,
    reportConfig,
    archiveConfig,
  };

  /**
   * Create the run directory.
   *
   * The report writer and archive manager
   * create their respective directories
   * when required.
   */
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

  /**
   * Log resolved execution paths.
   */
  console.log('\nEvidence setup completed.');
  console.log(`Run ID: ${runId}`);
  console.log(`Run configuration: ${configPath}`);
  console.log(`Results directory: ${resultsDir}`);
  console.log(`Report directory: ${reportOutputDir}`);
  console.log(`Archive enabled: ${archiveConfig.enabled}`);

  if (archiveConfig.enabled) {
    console.log(`Archive directory: ${archiveConfig.archiveDir}`);
  }
}
