import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Evidence } from '../contracts/evidence';

/**
 * Configuration for evidence consolidation.
 */
export interface EvidenceConsolidatorConfig {
  resultsDir: string;
  runId: string;
}

/**
 * Writes all recorded evidence attempts into a single
 * consolidated JSON file.
 *
 * Output:
 * results/<runId>/evidence/consolidated-evidence.json
 *
 * The consolidated file preserves:
 * - Passed scenarios
 * - Failed scenarios
 * - Partial business data
 * - Error details
 * - All retry attempts
 *
 * It does not delete worker JSON files.
 */
export class EvidenceConsolidator<
  TData extends Record<string, unknown>,
> {
  private readonly outputPath: string;

  constructor(
    private readonly config: EvidenceConsolidatorConfig,
  ) {
    this.outputPath = path.join(
      config.resultsDir,
      config.runId,
      'evidence',
      'consolidated-evidence.json',
    );
  }

  /**
   * Writes all evidence attempts into a single JSON array.
   *
   * Returns the path of the consolidated JSON file.
   */
  async consolidate(
    evidence: Evidence<TData>[],
  ): Promise<string> {
    this.validateEvidence(evidence);

    await fs.mkdir(
      path.dirname(this.outputPath),
      {
        recursive: true,
      },
    );

    const temporaryPath =
      `${this.outputPath}.${process.pid}.${randomUUID()}.tmp`;

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
        this.outputPath,
      );
    } finally {
      await fs.rm(
        temporaryPath,
        {
          force: true,
        },
      ).catch(() => undefined);
    }

    return this.outputPath;
  }

  /**
   * Ensures evidence from another execution run
   * cannot be included in the consolidated file.
   */
  private validateEvidence(
    evidence: Evidence<TData>[],
  ): void {
    for (const record of evidence) {
      if (
        record.runId !== this.config.runId
      ) {
        throw new Error(
          `Evidence scenario "${record.scenarioId}" belongs to run "${record.runId}" but consolidator is processing run "${this.config.runId}".`,
        );
      }
    }
  }
}
