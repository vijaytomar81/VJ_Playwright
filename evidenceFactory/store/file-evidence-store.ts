import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Evidence } from '../contracts/evidence';
import type { EvidenceStore } from './evidence-store';

export interface FileEvidenceStoreConfig {
  resultsDir: string;
  runId: string;
  workerId: string;
}

/**
 * Stores all evidence attempts for one logical worker
 * in a single JSON array.
 *
 * Example:
 * results/RUN-001/evidence/worker-0.json
 */
export class FileEvidenceStore<
  TData extends Record<string, unknown>,
> implements EvidenceStore<TData> {
  private readonly workerFilePath: string;

  constructor(
    private readonly config: FileEvidenceStoreConfig,
  ) {
    if (!/^worker-\d+$/.test(config.workerId)) {
      throw new Error(
        'workerId must have the form "worker-0", "worker-1", etc.',
      );
    }

    this.workerFilePath = path.join(
      config.resultsDir,
      config.runId,
      'evidence',
      `${config.workerId}.json`,
    );
  }

  /**
   * Adds one test attempt to this worker's JSON array.
   */
  async add(evidence: Evidence<TData>): Promise<void> {
    this.validateOwnership(evidence);

    await fs.mkdir(
      path.dirname(this.workerFilePath),
      { recursive: true },
    );

    await this.withLock(async () => {
      const records = await this.readRecords();

      const duplicate = records.some(
        item =>
          item.scenarioId === evidence.scenarioId &&
          item.attempt === evidence.attempt,
      );

      if (duplicate) {
        throw new Error(
          `Duplicate evidence for scenario "${evidence.scenarioId}" attempt ${evidence.attempt}.`,
        );
      }

      records.push(evidence);

      await this.atomicWrite(records);
    });
  }

  /**
   * Returns all attempts recorded by this worker.
   */
  async getAll(): Promise<Evidence<TData>[]> {
    await fs.mkdir(
      path.dirname(this.workerFilePath),
      { recursive: true },
    );

    return this.withLock(
      () => this.readRecords(),
    );
  }

  /**
   * Removes this worker's evidence file only.
   */
  async clear(): Promise<void> {
    await fs.mkdir(
      path.dirname(this.workerFilePath),
      { recursive: true },
    );

    await this.withLock(
      () => fs.rm(this.workerFilePath, { force: true }),
    );
  }

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

  private async readRecords(): Promise<Evidence<TData>[]> {
    let raw: string;

    try {
      raw = await fs.readFile(
        this.workerFilePath,
        'utf8',
      );
    } catch (error) {
      if (hasCode(error, 'ENOENT')) {
        return [];
      }

      throw error;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(
        `Expected JSON array in "${this.workerFilePath}".`,
      );
    }

    for (const record of parsed) {
      if (
        !record ||
        typeof record !== 'object' ||
        record.runId !== this.config.runId ||
        record.workerId !== this.config.workerId
      ) {
        throw new Error(
          `Invalid evidence ownership in "${this.workerFilePath}".`,
        );
      }
    }

    return parsed as Evidence<TData>[];
  }

  /**
   * Writes a complete JSON array to a temporary file,
   * then replaces the worker JSON atomically.
   */
  private async atomicWrite(
    records: Evidence<TData>[],
  ): Promise<void> {
    const temporaryPath =
      `${this.workerFilePath}.${process.pid}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(
        temporaryPath,
        JSON.stringify(records, null, 2),
        {
          encoding: 'utf8',
          flag: 'wx',
        },
      );

      await fs.rename(
        temporaryPath,
        this.workerFilePath,
      );
    } finally {
      await fs.rm(
        temporaryPath,
        { force: true },
      ).catch(() => undefined);
    }
  }

  /**
   * Coordinates writes between Playwright processes
   * using the same logical worker slot.
   *
   * A stale-lock timeout provides crash recovery.
   */
  private async withLock<TResult>(
    action: () => Promise<TResult>,
  ): Promise<TResult> {
    const lockPath = `${this.workerFilePath}.lock`;

    const waitUntil = Date.now() + 30_000;
    const staleAfterMs = 120_000;

    while (true) {
      try {
        await fs.mkdir(lockPath);
        break;
      } catch (error) {
        if (!hasCode(error, 'EEXIST')) {
          throw error;
        }

        try {
          const stat = await fs.stat(lockPath);

          if (Date.now() - stat.mtimeMs > staleAfterMs) {
            await fs.rm(
              lockPath,
              {
                recursive: true,
                force: true,
              },
            );

            continue;
          }
        } catch (statError) {
          if (!hasCode(statError, 'ENOENT')) {
            throw statError;
          }
        }

        if (Date.now() >= waitUntil) {
          throw new Error(
            `Timed out acquiring evidence lock "${lockPath}".`,
          );
        }

        await new Promise<void>(resolve =>
          setTimeout(resolve, 50),
        );
      }
    }

    try {
      return await action();
    } finally {
      await fs.rm(
        lockPath,
        {
          recursive: true,
          force: true,
        },
      );
    }
  }
}

function hasCode(
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
