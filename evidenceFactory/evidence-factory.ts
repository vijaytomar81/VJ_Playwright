import path from 'node:path';

import type { ArchiveConfig } from './archive/archive-config';
import {
  ArchiveManager,
  type ArchiveResult,
} from './archive/archive-manager';

import { EvidenceAggregator } from './aggregation/evidence-aggregator';

import type { Evidence } from './contracts/evidence';
import type { ReportConfig } from './contracts/report-config';
import type { ReportField } from './contracts/report-field';

import type { EvidenceStore } from './store/evidence-store';
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

  async record(
    evidence: Evidence<TData>,
    store: EvidenceStore<TData>,
  ): Promise<void> {
    this.validateEvidenceOwnership(evidence);
    await store.add(evidence);
  }

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

  async finalize(
    reportConfig: ReportConfig,
  ): Promise<EvidenceFinalizationResult> {
    const report =
      await this.generateReport(reportConfig);

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
