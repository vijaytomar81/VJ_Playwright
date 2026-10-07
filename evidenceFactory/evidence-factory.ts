import path from 'node:path';

import type { ArchiveConfig } from './archive/archive-config';
import {
  ArchiveManager,
  type ArchiveResult,
} from './archive/archive-manager';
import { EvidenceAggregator } from './aggregation/evidence-aggregator';
import type { Evidence } from './contracts/evidence';
import type { ReportConfig } from './contracts/report-config';
import type { EvidenceStore } from './store/evidence-store';
import { createEvidenceWriter } from './writers/writer-factory';

/**
 * Configuration required by EvidenceFactory.
 *
 * Evidence fields are supplied by the consuming automation.
 * EvidenceFactory does not define or maintain business field names.
 */
export interface EvidenceFactoryConfig<
  TData extends Record<string, unknown>,
> {
  /**
   * Ordered business evidence fields.
   *
   * The order of this array determines the business-column order
   * in tabular reports such as CSV and Excel.
   */
  fields: readonly (keyof TData & string)[];

  /**
   * Root execution-results directory.
   *
   * Example:
   *   ./results
   */
  resultsDir: string;

  /**
   * Current execution run identifier.
   */
  runId: string;

  /**
   * Optional archive configuration.
   */
  archive?: ArchiveConfig;
}

/**
 * Result returned after report generation.
 */
export interface EvidenceReportResult {
  reportPath: string;
  evidenceCount: number;
}

/**
 * Result returned after complete run finalization.
 */
export interface EvidenceFinalizationResult
  extends EvidenceReportResult {
  archive?: ArchiveResult;
}

/**
 * Coordinates evidence storage, aggregation, reporting,
 * and optional archiving.
 *
 * Business evidence fields remain owned by the consuming automation.
 */
export class EvidenceFactory<
  TData extends Record<string, unknown>,
> {
  constructor(
    private readonly config:
      EvidenceFactoryConfig<TData>,
  ) {}

  /**
   * Records one evidence item using the supplied store.
   *
   * EvidenceFactory validates only framework ownership information.
   * It does not validate consumer business fields.
   */
  async record(
    evidence: Evidence<TData>,
    store: EvidenceStore<TData>,
  ): Promise<void> {
    this.validateEvidenceOwnership(evidence);

    await store.add(evidence);
  }

  /**
   * Generates the selected final report from the latest
   * attempt of every scenario.
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
        this.config.fields,
        reportConfig,
      );

    return {
      reportPath,
      evidenceCount: evidence.length,
    };
  }

  /**
   * Archives the current run directory.
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
   * Generates the final report and then archives the run
   * when archiving is enabled.
   */
  async finalize(
    reportConfig: ReportConfig,
  ): Promise<EvidenceFinalizationResult> {
    const report =
      await this.generateReport(
        reportConfig,
      );

    if (
      !this.config.archive ||
      !this.config.archive.enabled
    ) {
      return report;
    }

    const archive =
      await this.archiveRun();

    return {
      ...report,
      archive,
    };
  }

  /**
   * Returns every stored scenario attempt for the current run.
   */
  async getAllAttempts(): Promise<
    Evidence<TData>[]
  > {
    const aggregator =
      this.createAggregator();

    const evidence =
      await aggregator.getAllAttempts();

    this.validateAggregatedEvidence(
      evidence,
    );

    return evidence;
  }

  /**
   * Returns only the latest attempt for each scenario.
   */
  async getFinalEvidence(): Promise<
    Evidence<TData>[]
  > {
    const aggregator =
      this.createAggregator();

    const evidence =
      await aggregator.getLatestAttempts();

    this.validateAggregatedEvidence(
      evidence,
    );

    return evidence;
  }

  private createAggregator():
    EvidenceAggregator<TData> {
    return new EvidenceAggregator<TData>({
      resultsDir: this.config.resultsDir,
      runId: this.config.runId,
    });
  }

  /**
   * Validates framework-owned run information only.
   *
   * Business evidence fields are intentionally not inspected here.
   */
  private validateEvidenceOwnership(
    evidence: Evidence<TData>,
  ): void {
    if (
      evidence.runId !==
      this.config.runId
    ) {
      throw new Error(
        `Evidence runId "${evidence.runId}" does not match EvidenceFactory runId "${this.config.runId}".`,
      );
    }
  }

  private validateAggregatedEvidence(
    evidence: Evidence<TData>[],
  ): void {
    for (const item of evidence) {
      this.validateEvidenceOwnership(
        item,
      );
    }
  }

  private getRunDirectory(): string {
    return path.join(
      this.config.resultsDir,
      this.config.runId,
    );
  }
}
