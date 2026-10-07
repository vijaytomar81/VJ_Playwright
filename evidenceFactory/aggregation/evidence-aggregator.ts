import fs from 'node:fs/promises';
import path from 'node:path';

import type { Evidence } from '../contracts/evidence';

/**
 * Configuration used by EvidenceAggregator.
 */
export interface EvidenceAggregatorConfig {
  /**
   * Root directory containing execution results.
   *
   * Example:
   *   ./results
   */
  resultsDir: string;

  /**
   * Run identifier whose evidence should be aggregated.
   *
   * Example:
   *   RUN-20261007-001
   */
  runId: string;
}

/**
 * Reads evidence produced by all workers participating
 * in a single execution run.
 *
 * Raw evidence files remain untouched.
 *
 * Example:
 *
 * results/
 *   RUN-001/
 *     evidence/
 *       worker-0/
 *         TC001_attempt-0.json
 *       worker-1/
 *         TC002_attempt-0.json
 *         TC002_attempt-1.json
 *
 * By default, getLatestAttempts() returns only the latest
 * attempt for each scenario.
 */
export class EvidenceAggregator<
  TData extends Record<string, unknown>,
> {
  private readonly evidenceDirectory: string;

  constructor(
    private readonly config: EvidenceAggregatorConfig,
  ) {
    this.evidenceDirectory = path.join(
      config.resultsDir,
      config.runId,
      'evidence',
    );
  }

  /**
   * Reads every valid evidence JSON file from every worker
   * directory for the configured run.
   *
   * No retry filtering is performed here.
   */
  async getAllAttempts(): Promise<Evidence<TData>[]> {
    if (!(await this.directoryExists(this.evidenceDirectory))) {
      return [];
    }

    const workerEntries = await fs.readdir(
      this.evidenceDirectory,
      {
        withFileTypes: true,
      },
    );

    const workerDirectories = workerEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    const evidence: Evidence<TData>[] = [];

    for (const workerDirectory of workerDirectories) {
      const workerPath = path.join(
        this.evidenceDirectory,
        workerDirectory,
      );

      const workerEvidence =
        await this.readWorkerEvidence(workerPath);

      evidence.push(...workerEvidence);
    }

    return this.sortEvidence(evidence);
  }

  /**
   * Returns only the latest attempt for each scenario.
   *
   * Example:
   *
   * TC001 attempt 0 FAILED
   * TC001 attempt 1 PASSED
   *
   * becomes:
   *
   * TC001 attempt 1 PASSED
   *
   * All raw attempt files remain on disk.
   */
  async getLatestAttempts(): Promise<Evidence<TData>[]> {
    const allAttempts =
      await this.getAllAttempts();

    const latestByScenario =
      new Map<string, Evidence<TData>>();

    for (const evidence of allAttempts) {
      const existing =
        latestByScenario.get(
          evidence.scenarioId,
        );

      if (
        !existing ||
        evidence.attempt > existing.attempt
      ) {
        latestByScenario.set(
          evidence.scenarioId,
          evidence,
        );

        continue;
      }

      if (
        evidence.attempt === existing.attempt
      ) {
        throw new Error(
          `Duplicate evidence detected for scenario "${evidence.scenarioId}" attempt ${evidence.attempt}.`,
        );
      }
    }

    return this.sortEvidence(
      [...latestByScenario.values()],
    );
  }

  /**
   * Reads all JSON evidence files belonging to one worker.
   */
  private async readWorkerEvidence(
    workerDirectory: string,
  ): Promise<Evidence<TData>[]> {
    const entries = await fs.readdir(
      workerDirectory,
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

    const evidence: Evidence<TData>[] = [];

    for (const fileName of evidenceFiles) {
      const filePath = path.join(
        workerDirectory,
        fileName,
      );

      const record =
        await this.readEvidenceFile(filePath);

      this.validateRun(record, filePath);

      evidence.push(record);
    }

    return evidence;
  }

  /**
   * Reads and parses a single evidence JSON file.
   */
  private async readEvidenceFile(
    filePath: string,
  ): Promise<Evidence<TData>> {
    let content: string;

    try {
      content = await fs.readFile(
        filePath,
        'utf8',
      );
    } catch (error) {
      throw new Error(
        `Unable to read evidence file "${filePath}".`,
        {
          cause: error,
        },
      );
    }

    try {
      return JSON.parse(
        content,
      ) as Evidence<TData>;
    } catch (error) {
      throw new Error(
        `Invalid JSON in evidence file "${filePath}".`,
        {
          cause: error,
        },
      );
    }
  }

  /**
   * Protects against evidence from another run being placed
   * accidentally inside the configured run directory.
   */
  private validateRun(
    evidence: Evidence<TData>,
    filePath: string,
  ): void {
    if (
      evidence.runId !==
      this.config.runId
    ) {
      throw new Error(
        `Evidence file "${filePath}" belongs to run "${evidence.runId}" but aggregator is processing run "${this.config.runId}".`,
      );
    }
  }

  /**
   * Provides deterministic ordering for report generation.
   *
   * Primary:
   *   scenarioId
   *
   * Secondary:
   *   attempt
   */
  private sortEvidence(
    evidence: Evidence<TData>[],
  ): Evidence<TData>[] {
    return [...evidence].sort(
      (left, right) => {
        const scenarioComparison =
          left.scenarioId.localeCompare(
            right.scenarioId,
            undefined,
            {
              numeric: true,
              sensitivity: 'base',
            },
          );

        if (scenarioComparison !== 0) {
          return scenarioComparison;
        }

        return left.attempt - right.attempt;
      },
    );
  }

  private async directoryExists(
    directory: string,
  ): Promise<boolean> {
    try {
      const stats =
        await fs.stat(directory);

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
}
