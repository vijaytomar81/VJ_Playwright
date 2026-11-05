import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { ZipArchive } from 'archiver';

import type { ArchiveConfig } from './archive-config';

import {
  ArchiveCleaner,
  type ArchiveCleanupResult,
} from './archive-cleaner';

/**
 * Result returned after archiving a completed run.
 */
export interface ArchiveResult {
  archived: boolean;

  archivePath?: string;

  sourceDeleted: boolean;

  cleanup?: ArchiveCleanupResult;
}

/**
 * Handles post-execution archive lifecycle.
 *
 * Responsibilities:
 *
 * - ZIP a completed run directory
 * - optionally delete the source after successful ZIP creation
 * - optionally clean up expired archives
 *
 * ArchiveManager should be invoked by the execution/report
 * coordinator, never by individual Playwright workers.
 */
export class ArchiveManager {
  private readonly cleaner =
    new ArchiveCleaner();

  constructor(
    private readonly config: ArchiveConfig,
  ) { }

  /**
   * Archives a completed execution run.
   *
   * Example source:
   *
   * results/RUN-001/
   *
   * Example output:
   *
   * archive/RUN-001.zip
   */
  async archiveRun(
    runDirectory: string,
  ): Promise<ArchiveResult> {
    if (!this.config.enabled) {
      return {
        archived: false,
        sourceDeleted: false,
      };
    }

    await this.validateConfiguration();

    await this.validateRunDirectory(
      runDirectory,
    );

    await fsPromises.mkdir(
      this.config.archiveDir,
      {
        recursive: true,
      },
    );

    let archivePath:
      | string
      | undefined;

    let sourceDeleted = false;

    if (this.config.policy.compress) {
      archivePath =
        await this.createArchive(
          runDirectory,
        );

      if (
        this.config.policy
          .deleteSourceAfterArchive
      ) {
        await fsPromises.rm(
          runDirectory,
          {
            recursive: true,
            force: true,
          },
        );

        sourceDeleted = true;
      }
    }

    let cleanup:
      | ArchiveCleanupResult
      | undefined;

    if (
      this.config.policy
        .cleanupAfterRun
    ) {
      cleanup =
        await this.cleanExpiredArchives();
    }

    return {
      archived:
        archivePath !== undefined,

      archivePath,

      sourceDeleted,

      cleanup,
    };
  }

  /**
   * Runs retention cleanup independently of archive creation.
   *
   * This can also be called by a global setup/teardown process.
   */
  async cleanExpiredArchives():
    Promise<ArchiveCleanupResult> {
    return this.cleaner.cleanup(
      this.config.archiveDir,
      this.config.policy.retentionDays,
    );
  }

  /**
   * Creates the ZIP in a temporary file first.
   *
   * Only after ZIP generation succeeds is the temporary file
   * renamed to the final .zip path.
   */
  private async createArchive(
    runDirectory: string,
  ): Promise<string> {
    const runName =
      path.basename(
        path.resolve(runDirectory),
      );

    if (!runName) {
      throw new Error(
        `Unable to determine run name from directory "${runDirectory}".`,
      );
    }

    const safeRunName =
      this.sanitizeFileName(runName);

    const archivePath =
      path.join(
        this.config.archiveDir,
        `${safeRunName}.zip`,
      );

    const temporaryPath =
      `${archivePath}.${process.pid}.tmp`;

    try {
      await this.writeZip(
        runDirectory,
        temporaryPath,
      );

      await fsPromises.rename(
        temporaryPath,
        archivePath,
      );

      return archivePath;
    } catch (error) {
      await this.removeTemporaryFile(
        temporaryPath,
      );

      throw error;
    }
  }

  /**
   * Streams a directory into a ZIP file.
   */
  private async writeZip(
    sourceDirectory: string,
    destinationFile: string,
  ): Promise<void> {
    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        const output =
          fs.createWriteStream(
            destinationFile,
          );

        const archive =
          new ZipArchive({
            zlib: {
              level: 9,
            },
          });

        let settled = false;

        const fail = (
          error: Error,
        ): void => {
          if (settled) {
            return;
          }

          settled = true;
          reject(error);
        };

        output.on(
          'close',
          () => {
            if (settled) {
              return;
            }

            settled = true;
            resolve();
          },
        );

        output.on(
          'error',
          fail,
        );

        archive.on(
          'error',
          fail,
        );

        archive.pipe(output);

        /*
         * false means:
         *
         * ZIP contents:
         *   evidence/
         *   report/
         *
         * rather than:
         *   RUN-001/
         *     evidence/
         *     report/
         */
        archive.directory(
          sourceDirectory,
          false,
        );

        archive.finalize().catch(
          fail,
        );
      },
    );
  }

  /**
   * Ensures the source exists and is actually a directory.
   */
  private async validateRunDirectory(
    runDirectory: string,
  ): Promise<void> {
    let stats;

    try {
      stats =
        await fsPromises.stat(
          runDirectory,
        );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new Error(
          `Run directory "${runDirectory}" does not exist.`,
        );
      }

      throw error;
    }

    if (!stats.isDirectory()) {
      throw new Error(
        `Run path "${runDirectory}" is not a directory.`,
      );
    }
  }

  /**
   * Protects against contradictory configuration.
   */
  private async validateConfiguration():
    Promise<void> {
    const policy =
      this.config.policy;

    if (
      policy.deleteSourceAfterArchive &&
      !policy.compress
    ) {
      throw new Error(
        'deleteSourceAfterArchive cannot be enabled when compress is disabled.',
      );
    }

    if (policy.retentionDays < 0) {
      throw new Error(
        'retentionDays cannot be negative.',
      );
    }
  }

  private sanitizeFileName(
    value: string,
  ): string {
    const sanitized =
      value
        .trim()
        .replace(
          /[^a-zA-Z0-9._-]/g,
          '_',
        );

    if (!sanitized) {
      throw new Error(
        'Run directory name cannot produce an empty archive filename.',
      );
    }

    return sanitized;
  }

  private async removeTemporaryFile(
    temporaryPath: string,
  ): Promise<void> {
    try {
      await fsPromises.rm(
        temporaryPath,
        {
          force: true,
        },
      );
    } catch {
      // Preserve the original archive creation error.
    }
  }
}
