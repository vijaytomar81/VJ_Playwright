import fs from 'node:fs/promises';
import path from 'node:path';

import type { Evidence } from '../contracts/evidence';

export interface EvidenceAggregatorConfig {
  resultsDir: string;
  runId: string;
}

/**
 * Aggregates evidence from logical Playwright workers.
 *
 * During execution:
 *
 * results/<runId>/evidence/
 *   worker-0.json
 *   worker-1.json
 *   worker-2.json
 *   worker-3.json
 *
 * After finalization:
 *
 * results/<runId>/evidence/
 *   consolidated-evidence.json
 */
export class EvidenceAggregator<
  TData extends Record<string, unknown>,
> {
  private readonly evidenceDirectory: string;

  private readonly consolidatedFilePath: string;

  constructor(
    private readonly config: EvidenceAggregatorConfig,
  ) {
    this.evidenceDirectory = path.join(
      config.resultsDir,
      config.runId,
      'evidence',
    );

    this.consolidatedFilePath = path.join(
      this.evidenceDirectory,
      'consolidated-evidence.json',
    );
  }

  /**
   * Returns all evidence attempts from every worker.
   *
   * If worker files have already been cleaned up,
   * reads consolidated-evidence.json instead.
   */
  async getAllAttempts(): Promise<Evidence<TData>[]> {
    if (!(await this.directoryExists(this.evidenceDirectory))) {
      return [];
    }

    const entries = await fs.readdir(
      this.evidenceDirectory,
      {
        withFileTypes: true,
      },
    );

    const workerFiles = entries
      .filter(
        entry =>
          entry.isFile() &&
          /^worker-\d+\.json$/.test(entry.name),
      )
      .map(entry => entry.name)
      .sort();

    let evidence: Evidence<TData>[];

    if (workerFiles.length > 0) {
      evidence = [];

      for (const fileName of workerFiles) {
        const filePath = path.join(
          this.evidenceDirectory,
          fileName,
        );

        const records = await this.readEvidenceArray(
          filePath,
        );

        const expectedWorkerId = path.basename(
          fileName,
          '.json',
        );

        for (const record of records) {
          this.validateEvidence(
            record,
            filePath,
            expectedWorkerId,
          );
        }

        evidence.push(...records);
      }
    } else if (await this.fileExists(this.consolidatedFilePath)) {
      evidence = await this.readEvidenceArray(
        this.consolidatedFilePath,
      );

      for (const record of evidence) {
        this.validateEvidence(
          record,
          this.consolidatedFilePath,
        );
      }
    } else {
      evidence = [];
    }

    this.validateUniqueAttempts(evidence);

    return this.sortEvidence(evidence);
  }

  /**
   * Returns only the latest attempt for each scenario.
   */
  async getLatestAttempts(): Promise<Evidence<TData>[]> {
    const allAttempts = await this.getAllAttempts();

    const latestByScenario =
      new Map<string, Evidence<TData>>();

    for (const record of allAttempts) {
      const existing = latestByScenario.get(
        record.scenarioId,
      );

      if (
        !existing ||
        record.attempt > existing.attempt
      ) {
        latestByScenario.set(
          record.scenarioId,
          record,
        );
      }
    }

    return this.sortEvidence(
      [...latestByScenario.values()],
    );
  }

  /**
   * Reads an array of Evidence records from a JSON file.
   */
  private async readEvidenceArray(
    filePath: string,
  ): Promise<Evidence<TData>[]> {
    let content: string;

    try {
      content = await fs.readFile(
        filePath,
        'utf8',
      );
    } catch (error) {
      throw new Error(
        `Unable to read evidence file "${filePath}".`,
        { cause: error },
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid JSON in evidence file "${filePath}".`,
        { cause: error },
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        `Evidence file "${filePath}" must contain a JSON array.`,
      );
    }

    return parsed as Evidence<TData>[];
  }

  /**
   * Validates evidence ownership and required identifiers.
   */
  private validateEvidence(
    record: Evidence<TData>,
    filePath: string,
    expectedWorkerId?: string,
  ): void {
    if (
      !record ||
      typeof record !== 'object' ||
      record.runId !== this.config.runId
    ) {
      throw new Error(
        `Invalid run ownership in evidence file "${filePath}".`,
      );
    }

    if (
      typeof record.workerId !== 'string' ||
      !record.workerId
    ) {
      throw new Error(
        `Missing workerId in evidence file "${filePath}".`,
      );
    }

    if (
      expectedWorkerId &&
      record.workerId !== expectedWorkerId
    ) {
      throw new Error(
        `Worker ownership mismatch in "${filePath}".`,
      );
    }

    if (
      typeof record.scenarioId !== 'string' ||
      !record.scenarioId ||
      !Number.isInteger(record.attempt) ||
      record.attempt < 0
    ) {
      throw new Error(
        `Invalid scenarioId or attempt in "${filePath}".`,
      );
    }
  }

  /**
   * Rejects duplicate scenario/attempt combinations.
   */
  private validateUniqueAttempts(
    evidence: Evidence<TData>[],
  ): void {
    const seen = new Set<string>();

    for (const record of evidence) {
      const key = JSON.stringify([
        record.scenarioId,
        record.attempt,
      ]);

      if (seen.has(key)) {
        throw new Error(
          `Duplicate evidence detected for scenario "${record.scenarioId}" attempt ${record.attempt}.`,
        );
      }

      seen.add(key);
    }
  }

  /**
   * Sorts evidence by scenarioId, then attempt.
   */
  private sortEvidence(
    evidence: Evidence<TData>[],
  ): Evidence<TData>[] {
    return [...evidence].sort(
      (left, right) => {
        const comparison =
          left.scenarioId.localeCompare(
            right.scenarioId,
            undefined,
            {
              numeric: true,
              sensitivity: 'base',
            },
          );

        if (comparison !== 0) {
          return comparison;
        }

        return left.attempt - right.attempt;
      },
    );
  }

  private async directoryExists(
    directory: string,
  ): Promise<boolean> {
    try {
      const stats = await fs.stat(directory);
      return stats.isDirectory();
    } catch (error) {
      if (this.hasCode(error, 'ENOENT')) {
        return false;
      }

      throw error;
    }
  }

  private async fileExists(
    filePath: string,
  ): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch (error) {
      if (this.hasCode(error, 'ENOENT')) {
        return false;
      }

      throw error;
    }
  }

  private hasCode(
    error: unknown,
    code: string,
  ): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}
