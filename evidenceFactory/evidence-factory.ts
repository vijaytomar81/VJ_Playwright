import path from 'node:path';

import type { ArchiveConfig } from './archive/archive-config';
import {
  ArchiveManager,
  type ArchiveResult,
} from './archive/archive-manager';

import { EvidenceAggregator } from './aggregation/evidence-aggregator';
import { EvidenceConsolidator } from './aggregation/evidence-consolidator';

import type { Evidence } from './contracts/evidence';
import type { ReportConfig } from './contracts/report-config';
import type { ReportField } from './contracts/report-field';

import type { EvidenceStore } from './store/evidence-store';
import { WorkerEvidenceCleaner } from './store/worker-evidence-cleaner';

import { createEvidenceWriter } from './writers/writer-factory';

export interface EvidenceFactoryConfig<
  TData extends Record<string, unknown>,
> {
  /**
   * Consumer-owned report field definitions.
   *
   * Includes both framework and business report fields.
   */
  fields: readonly ReportField[];

  resultsDir: string;
  runId: string;

  archive?: ArchiveConfig;
}

export interface EvidenceReportResult {
  reportPath: string;
  evidenceCount: number;
}

export interface EvidenceFinalizationResult
  extends EvidenceReportResult {
  /**
   * Consolidated JSON containing all attempts.
   */
  consolidatedPath: string;

  /**
   * All generated reports.
   */
  reports: EvidenceReportResult[];

  /**
   * Number of worker JSON files removed.
   */
  deletedWorkerFiles: number;

  /**
   * Optional archive result.
   */
  archive?: ArchiveResult;
}

export class EvidenceFactory<
  TData extends Record<string, unknown>,
> {
  private readonly orderedFields: ReportField[];

  constructor(
    private readonly config:
      EvidenceFactoryConfig<TData>,
  ) {
    this.orderedFields = [...config.fields].sort(
      (a, b) => a.order - b.order,
    );

    this.validateFieldConfiguration();
  }

  /**
   * Records one scenario attempt using the provided store.
   */
  async record(
    evidence: Evidence<TData>,
    store: EvidenceStore<TData>,
  ): Promise<void> {
    this.validateEvidenceOwnership(evidence);

    await store.add(evidence);
  }

  /**
   * Generates one report using only the latest
   * attempt of each scenario.
   */
  async generateReport(
    reportConfig: ReportConfig,
  ): Promise<EvidenceReportResult> {
    const evidence =
      await this.getFinalEvidence();

    const writer =
      createEvidenceWriter<TData>(
        reportConfig.format,
      );

    const reportPath =
      await writer.write(
        evidence,
        this.orderedFields,
        reportConfig,
      );

    return {
      reportPath,
      evidenceCount: evidence.length,
    };
  }

  /**
   * Creates the configured archive.
   */
  async archiveRun(): Promise<ArchiveResult> {
    if (!this.config.archive) {
      throw new Error(
        'Archive configuration has not been provided to EvidenceFactory.',
      );
    }

    const archiveManager =
      new ArchiveManager(
        this.config.archive,
      );

    return archiveManager.archiveRun(
      this.getRunDirectory(),
    );
  }

  /**
   * Finalizes the execution run.
   *
   * Lifecycle:
   *
   * 1. Read all worker evidence attempts.
   * 2. Create consolidated-evidence.json.
   * 3. Generate requested reports.
   * 4. Create optional archive.
   * 5. Remove temporary worker JSON files.
   *
   * Worker JSON files are preserved if consolidation,
   * reporting, or archiving fails.
   */
  async finalize(
    reportConfig: ReportConfig,
  ): Promise<EvidenceFinalizationResult>;

  async finalize(
    reportConfigs: ReportConfig[],
  ): Promise<EvidenceFinalizationResult>;

  async finalize(
    reportConfigOrConfigs:
      ReportConfig | ReportConfig[],
  ): Promise<EvidenceFinalizationResult> {
    const reportConfigs = Array.isArray(
      reportConfigOrConfigs,
    )
      ? reportConfigOrConfigs
      : [reportConfigOrConfigs];

    if (reportConfigs.length === 0) {
      throw new Error(
        'At least one report configuration is required.',
      );
    }

    // 1. Collect all recorded attempts.
    const allAttempts =
      await this.getAllAttempts();

    // 2. Write consolidated evidence.
    const consolidator =
      new EvidenceConsolidator<TData>({
        resultsDir: this.config.resultsDir,
        runId: this.config.runId,
      });

    const consolidatedPath =
      await consolidator.consolidate(
        allAttempts,
      );

    // 3. Generate all requested reports.
    const reports: EvidenceReportResult[] = [];

    for (const reportConfig of reportConfigs) {
      const report =
        await this.generateReport(
          reportConfig,
        );

      reports.push(report);
    }

    // 4. Create archive if enabled.
    const archive =
      this.config.archive?.enabled
        ? await this.archiveRun()
        : undefined;

    // 5. Delete worker files only after
    // all previous steps succeed.
    const cleaner =
      new WorkerEvidenceCleaner({
        resultsDir: this.config.resultsDir,
        runId: this.config.runId,
      });

    const deletedWorkerFiles =
      await cleaner.cleanup();

    const firstReport = reports[0];

    return {
      ...firstReport,
      consolidatedPath,
      reports,
      deletedWorkerFiles,
      ...(archive ? { archive } : {}),
    };
  }

  /**
   * Returns every recorded attempt,
   * including retries.
   */
  async getAllAttempts(): Promise<
    Evidence<TData>[]
  > {
    const aggregator =
      this.createAggregator();

    const evidence =
      await aggregator.getAllAttempts();

    this.validateAggregatedEvidence(evidence);

    return evidence;
  }

  /**
   * Returns only the latest attempt
   * for each scenario.
   */
  async getFinalEvidence(): Promise<
    Evidence<TData>[]
  > {
    const aggregator =
      this.createAggregator();

    const evidence =
      await aggregator.getLatestAttempts();

    this.validateAggregatedEvidence(evidence);

    return evidence;
  }

  private createAggregator():
    EvidenceAggregator<TData> {
    return new EvidenceAggregator<TData>({
      resultsDir: this.config.resultsDir,
      runId: this.config.runId,
    });
  }

  private validateEvidenceOwnership(
    evidence: Evidence<TData>,
  ): void {
    if (evidence.runId !== this.config.runId) {
      throw new Error(
        `Evidence runId "${evidence.runId}" does not match EvidenceFactory runId "${this.config.runId}".`,
      );
    }
  }

  private validateAggregatedEvidence(
    evidence: Evidence<TData>[],
  ): void {
    for (const item of evidence) {
      this.validateEvidenceOwnership(item);
    }
  }

  private validateFieldConfiguration(): void {
    const names = new Set<string>();
    const orders = new Set<number>();

    for (const item of this.orderedFields) {
      if (!item.field.trim()) {
        throw new Error(
          'Report field name cannot be empty.',
        );
      }

      if (
        !Number.isInteger(item.order) ||
        item.order < 1
      ) {
        throw new Error(
          `Invalid order for report field "${item.field}".`,
        );
      }

      if (names.has(item.field)) {
        throw new Error(
          `Duplicate report field "${item.field}".`,
        );
      }

      if (orders.has(item.order)) {
        throw new Error(
          `Duplicate report order "${item.order}".`,
        );
      }

      names.add(item.field);
      orders.add(item.order);
    }
  }

  private getRunDirectory(): string {
    return path.join(
      this.config.resultsDir,
      this.config.runId,
    );
  }
}
