import path from 'node:path';
import fs from 'node:fs/promises';

import { EvidenceFactory } from '../index';

import type { ReportConfig } from '../contracts/report-config';
import type { ReportField } from '../contracts/report-field';

interface EvidenceRunConfig {
  runId: string;
  resultsDir: string;
  evidenceFields: readonly ReportField[];
  reportConfig: ReportConfig;
}

interface BrowserMetadata {
  browser: string;
  browserChannel: string;
  browserVersion: string;
  headless: boolean;
}

export default async function finalizeEvidence(): Promise<void> {
  const runId = process.env.EVIDENCE_RUN_ID?.trim();

  if (!runId) {
    throw new Error(
      'EVIDENCE_RUN_ID is required for evidence finalization.',
    );
  }

  const resultsDir = path.resolve(
    process.env.EVIDENCE_RESULTS_DIR ?? 'results',
  );

  const configPath = path.join(
    resultsDir,
    runId,
    'run-config.json',
  );

  const configContent = await fs.readFile(configPath, 'utf8');

  const runConfig = JSON.parse(configContent) as EvidenceRunConfig;

  if (runConfig.runId !== runId) {
    throw new Error(
      `Run configuration ID "${runConfig.runId}" does not match "${runId}".`,
    );
  }

  if (path.resolve(runConfig.resultsDir) !== resultsDir) {
    throw new Error(
      'Run configuration results directory does not match the execution directory.',
    );
  }

  /*
   * Capture execution completion time.
   *
   * Global teardown runs after Playwright test workers finish.
   */
  const finishedAt = new Date().toISOString();

  /*
   * Read the start time persisted by global setup.
   */
  const summaryData = runConfig.reportConfig.summaryData ?? {};

  const startedAt = summaryData.startedAt;

  if (
    typeof startedAt !== 'string' ||
    !Number.isFinite(Date.parse(startedAt))
  ) {
    throw new Error(
      'A valid startedAt timestamp is required in run-config.json.',
    );
  }

  /*
   * Calculate elapsed execution time.
   */
  const durationMs =
    Date.parse(finishedAt) - Date.parse(startedAt);

  if (durationMs < 0) {
    throw new Error(
      'Execution finish time cannot be earlier than start time.',
    );
  }

  const totalSeconds = Math.floor(durationMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const executionTime = [
    hours,
    minutes,
    seconds,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');

  /*
   * Read browser metadata captured by test workers.
   *
   * Expected filename format:
   * browser-<project-name>-worker-<index>.json
   *
   * Examples:
   * browser-chrome-worker-0.json
   * browser-edge-worker-0.json
   * browser-firefox-worker-1.json
   */
  const metadataDir = path.join(
    resultsDir,
    runId,
    'metadata',
  );

  let browserMetadata: BrowserMetadata | undefined;

  try {
    const metadataFiles = (await fs.readdir(metadataDir))
      .filter((file) =>
        /^browser-.+-worker-\d+\.json$/.test(file),
      )
      .sort();

    const metadataRecords: BrowserMetadata[] = [];

    for (const file of metadataFiles) {
      const metadataPath = path.join(metadataDir, file);

      const content = await fs.readFile(
        metadataPath,
        'utf8',
      );

      const metadata = JSON.parse(
        content,
      ) as BrowserMetadata;

      metadataRecords.push(metadata);
    }

    if (metadataRecords.length > 0) {
      const first = metadataRecords[0];

      /*
       * The Summary worksheet has one set of
       * browser fields.
       *
       * Populate these fields only when all
       * recorded browser configurations match.
       */
      const consistent = metadataRecords.every(
        (metadata) =>
          metadata.browser === first.browser &&
          metadata.browserChannel === first.browserChannel &&
          metadata.browserVersion === first.browserVersion &&
          metadata.headless === first.headless,
      );

      if (consistent) {
        browserMetadata = first;
      } else {
        console.warn(
          'Multiple browser configurations detected. ' +
          'Browser Summary fields will remain empty.',
        );
      }
    } else {
      console.warn(
        'No browser metadata files found. ' +
        'Browser Summary fields will remain empty.',
      );
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }

    console.warn(
      'Browser metadata directory not found. ' +
      'Browser Summary fields will remain empty.',
    );
  }

  /*
   * Supply execution timing and browser information
   * to the existing consumer-defined Summary schema.
   */
  runConfig.reportConfig.summaryData = {
    ...summaryData,
    finishedAt,
    executionTime,

    ...(browserMetadata
      ? {
        browser: browserMetadata.browser,
        browserChannel: browserMetadata.browserChannel,
        browserVersion: browserMetadata.browserVersion,
        headless: browserMetadata.headless,
      }
      : {}),
  };

  const factory = new EvidenceFactory<Record<string, unknown>>({
    runId: runConfig.runId,
    resultsDir: runConfig.resultsDir,
    fields: runConfig.evidenceFields,
  });

  const result = await factory.finalize(runConfig.reportConfig);

  console.log('\nEvidence finalization completed.');
  console.log(`Run ID: ${runId}`);
  console.log(`Execution time: ${executionTime}`);

  if (browserMetadata) {
    console.log(`Browser: ${browserMetadata.browser}`);
    console.log(`Browser channel: ${browserMetadata.browserChannel}`);
    console.log(`Browser version: ${browserMetadata.browserVersion}`);
    console.log(`Headless: ${browserMetadata.headless}`);
  }

  console.log(`Report: ${result.reportPath}`);
  console.log(`Consolidated evidence: ${result.consolidatedPath}`);
  console.log(`Evidence count: ${result.evidenceCount}`);
  console.log(`Worker files removed: ${result.deletedWorkerFiles}`);

  if (result.archive) {
    console.log('Evidence archive created successfully.');
  }
}