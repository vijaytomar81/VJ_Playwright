import fs from 'node:fs/promises';
import path from 'node:path';

import type { Evidence } from '../contracts/evidence';
import type { EvidenceStore } from './evidence-store';

/**
 * Configuration required by FileEvidenceStore.
 */
export interface FileEvidenceStoreConfig {
  /**
   * Root directory containing execution results.
   *
   * Example:
   *   ./results
   */
  resultsDir: string;

  /**
   * Run identifier for the current execution.
   *
   * Example:
   *   RUN-20261007-001
   */
  runId: string;

  /**
   * Worker identifier for the current execution worker.
   *
   * Example:
   *   worker-0
   */
  workerId: string;
}

/**
 * Filesystem-based EvidenceStore.
 *
 * Each worker writes into its own directory:
 *
 * results/
 *   <runId>/
 *     evidence/
 *       <workerId>/
 *         <scenarioId>_attempt-<attempt>.json
 *
 * This prevents multiple Playwright workers from writing to the
 * same evidence file.
 */
export class FileEvidenceStore<
  TData extends Record<string, unknown>,
> implements EvidenceStore<TData> {
  private readonly workerDirectory: string;

  constructor(
    private readonly config: FileEvidenceStoreConfig,
  ) {
    this.workerDirectory = path.join(
      config.resultsDir,
      config.runId,
      'evidence',
      config.workerId,
    );
  }

  /**
   * Persists one evidence record using an atomic write strategy.
   *
   * The evidence is first written to a temporary file and then
   * renamed to its final filename.
   *
   * This prevents the aggregator from seeing a partially written
   * JSON file if the worker process terminates during the write.
   */
  async add(
    evidence: Evidence<TData>,
  ): Promise<void> {
    this.validateOwnership(evidence);

    await fs.mkdir(
      this.workerDirectory,
      {
        recursive: true,
      },
    );

    const fileName = this.createFileName(evidence);

    const finalPath = path.join(
      this.workerDirectory,
      fileName,
    );

    const temporaryPath =
      `${finalPath}.${process.pid}.tmp`;

    const json = JSON.stringify(
      evidence,
      null,
      2,
    );

    try {
      await fs.writeFile(
        temporaryPath,
        json,
        {
          encoding: 'utf8',
          flag: 'wx',
        },
      );

      await fs.rename(
        temporaryPath,
        finalPath,
      );
    } catch (error) {
      await this.removeTemporaryFile(
        temporaryPath,
      );

      throw error;
    }
  }

  /**
   * Reads all evidence belonging to this worker.
   *
   * Cross-worker aggregation will be handled separately by
   * EvidenceAggregator.
   */
  async getAll(): Promise<Evidence<TData>[]> {
    if (!(await this.directoryExists())) {
      return [];
    }

    const entries = await fs.readdir(
      this.workerDirectory,
      {
        withFileTypes: true,
      },
    );

    const evidenceFiles = entries
      .filter(
        entry =>
          entry.isFile() &&
          entry.name.endsWith('.json'),
      )
      .map(entry => entry.name)
      .sort();

    const records: Evidence<TData>[] = [];

    for (const fileName of evidenceFiles) {
      const filePath = path.join(
        this.workerDirectory,
        fileName,
      );

      const content = await fs.readFile(
        filePath,
        'utf8',
      );

      const evidence =
        JSON.parse(content) as Evidence<TData>;

      records.push(evidence);
    }

    return records;
  }

  /**
   * Removes evidence belonging only to this worker.
   *
   * It deliberately does not remove the complete run directory,
   * because other workers may still be using it.
   */
  async clear(): Promise<void> {
    await fs.rm(
      this.workerDirectory,
      {
        recursive: true,
        force: true,
      },
    );
  }

  /**
   * Ensures a worker cannot accidentally persist evidence for
   * another run or worker.
   */
  private validateOwnership(
    evidence: Evidence<TData>,
  ): void {
    if (evidence.runId !== this.config.runId) {
      throw new Error(
        `Evidence runId "${evidence.runId}" does not match store runId "${this.config.runId}".`,
      );
    }

    if (evidence.workerId !== this.config.workerId) {
      throw new Error(
        `Evidence workerId "${evidence.workerId}" does not match store workerId "${this.config.workerId}".`,
      );
    }
  }

  /**
   * Creates a filesystem-safe evidence filename.
   */
  private createFileName(
    evidence: Evidence<TData>,
  ): string {
    const scenarioId = this.sanitizeFileName(
      evidence.scenarioId,
    );

    return `${scenarioId}_attempt-${evidence.attempt}.json`;
  }

  /**
   * Replaces characters that are unsafe or inconvenient in filenames.
   */
  private sanitizeFileName(
    value: string,
  ): string {
    const sanitized = value
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!sanitized) {
      throw new Error(
        'scenarioId cannot produce an empty evidence filename.',
      );
    }

    return sanitized;
  }

  private async directoryExists(): Promise<boolean> {
    try {
      const stats = await fs.stat(
        this.workerDirectory,
      );

      return stats.isDirectory();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return false;
      }

      throw error;
    }
  }

  private async removeTemporaryFile(
    temporaryPath: string,
  ): Promise<void> {
    try {
      await fs.rm(
        temporaryPath,
        {
          force: true,
        },
      );
    } catch {
      // Preserve the original write/rename error.
    }
  }
}
