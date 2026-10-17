import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Configuration for cleaning temporary worker evidence.
 */
export interface WorkerEvidenceCleanerConfig {
  resultsDir: string;
  runId: string;
}

/**
 * Removes temporary worker JSON files after successful
 * evidence consolidation and report generation.
 *
 * Files removed:
 *   worker-0.json
 *   worker-1.json
 *   worker-2.json
 *
 * Files preserved:
 *   consolidated-evidence.json
 *   Other evidence artifacts
 */
export class WorkerEvidenceCleaner {
  private readonly evidenceDirectory: string;

  constructor(
    private readonly config: WorkerEvidenceCleanerConfig,
  ) {
    this.evidenceDirectory = path.join(
      config.resultsDir,
      config.runId,
      'evidence',
    );
  }

  /**
   * Deletes all worker JSON files for this execution run.
   *
   * Returns the number of worker files deleted.
   */
  async cleanup(): Promise<number> {
    let entries;

    try {
      entries = await fs.readdir(
        this.evidenceDirectory,
        {
          withFileTypes: true,
        },
      );
    } catch (error) {
      if (this.hasCode(error, 'ENOENT')) {
        return 0;
      }

      throw error;
    }

    const workerFiles = entries
      .filter(
        entry =>
          entry.isFile() &&
          /^worker-\d+\.json$/.test(entry.name),
      )
      .map(entry => entry.name);

    for (const fileName of workerFiles) {
      const filePath = path.join(
        this.evidenceDirectory,
        fileName,
      );

      await fs.unlink(filePath);
    }

    return workerFiles.length;
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
