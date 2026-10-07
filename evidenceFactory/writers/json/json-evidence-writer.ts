import fs from 'node:fs/promises';
import path from 'node:path';

import type { Evidence } from '../../contracts/evidence';
import type { ReportConfig } from '../../contracts/report-config';
import type { EvidenceWriter } from '../evidence-writer';

interface JsonEvidenceReport<
  TData extends Record<string, unknown>,
> {
  metadata: {
    reportTitle?: string;
    environment?: string;
    generatedAt: string;
    total: number;
  };

  evidence: Evidence<TData>[];
}

/**
 * Generates the final JSON evidence report.
 *
 * Business evidence data is preserved exactly as supplied by
 * the execution layer.
 */
export class JsonEvidenceWriter<
  TData extends Record<string, unknown>,
> implements EvidenceWriter<TData> {
  async write(
    evidence: Evidence<TData>[],
    _fields: readonly (keyof TData & string)[],
    config: ReportConfig,
  ): Promise<string> {
    await fs.mkdir(
      config.outputDir,
      {
        recursive: true,
      },
    );

    const fileName = this.normalizeFileName(
      config.fileName ?? 'execution-report',
    );

    const filePath = path.join(
      config.outputDir,
      `${fileName}.json`,
    );

    const report: JsonEvidenceReport<TData> = {
      metadata: {
        reportTitle: config.reportTitle,
        environment: config.environment,
        generatedAt: new Date().toISOString(),
        total: evidence.length,
      },

      evidence,
    };

    await this.writeAtomically(
      filePath,
      JSON.stringify(report, null, 2),
    );

    return filePath;
  }

  private normalizeFileName(
    fileName: string,
  ): string {
    return fileName.replace(
      /\.json$/i,
      '',
    );
  }

  private async writeAtomically(
    filePath: string,
    content: string,
  ): Promise<void> {
    const temporaryPath =
      `${filePath}.${process.pid}.tmp`;

    try {
      await fs.writeFile(
        temporaryPath,
        content,
        {
          encoding: 'utf8',
          flag: 'w',
        },
      );

      await fs.rename(
        temporaryPath,
        filePath,
      );
    } catch (error) {
      try {
        await fs.rm(
          temporaryPath,
          {
            force: true,
          },
        );
      } catch {
        // Preserve the original error.
      }

      throw error;
    }
  }
}
