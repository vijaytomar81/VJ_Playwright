import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Result returned by archive cleanup.
 */
export interface ArchiveCleanupResult {
  deleted: string[];
  retained: string[];
}

/**
 * Removes expired ZIP archives based on file age.
 */
export class ArchiveCleaner {
  /**
   * Deletes ZIP archives older than retentionDays.
   *
   * retentionDays <= 0 disables cleanup.
   */
  async cleanup(
    archiveDir: string,
    retentionDays: number,
  ): Promise<ArchiveCleanupResult> {
    const result: ArchiveCleanupResult = {
      deleted: [],
      retained: [],
    };

    if (retentionDays <= 0) {
      return result;
    }

    if (!(await this.directoryExists(archiveDir))) {
      return result;
    }

    const entries = await fs.readdir(
      archiveDir,
      {
        withFileTypes: true,
      },
    );

    const cutoffTime =
      Date.now() -
      retentionDays *
        24 *
        60 *
        60 *
        1000;

    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !entry.name
          .toLowerCase()
          .endsWith('.zip')
      ) {
        continue;
      }

      const filePath = path.join(
        archiveDir,
        entry.name,
      );

      const stats =
        await fs.stat(filePath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.rm(
          filePath,
          {
            force: true,
          },
        );

        result.deleted.push(filePath);
      } else {
        result.retained.push(filePath);
      }
    }

    return result;
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
