import fs from 'node:fs/promises';
import path from 'node:path';

import type { Evidence } from '../../contracts/evidence';
import type { ReportConfig } from '../../contracts/report-config';
import type { EvidenceWriter } from '../evidence-writer';

/**
 * Generates the final CSV evidence report.
 *
 * Framework-owned columns are written first.
 * Consumer-owned evidence columns are then written in exactly
 * the order supplied through the fields parameter.
 *
 * EvidenceFactory does not define or maintain business field names.
 */
export class CsvEvidenceWriter<
  TData extends Record<string, unknown>,
> implements EvidenceWriter<TData> {
  async write(
    evidence: Evidence<TData>[],
    fields: readonly (keyof TData & string)[],
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
      `${fileName}.csv`,
    );

    const rows: string[][] = [
      this.createHeader(fields),
      ...evidence.map((item) =>
        this.createRow(
          item,
          fields,
        ),
      ),
    ];

    const content = rows
      .map((row) =>
        row
          .map((value) => this.escapeCsvValue(value))
          .join(','),
      )
      .join('\n');

    // UTF-8 BOM improves Excel compatibility when opening CSV files.
    await this.writeAtomically(
      filePath,
      `\uFEFF${content}`,
    );

    return filePath;
  }

  private createHeader(
    fields: readonly (keyof TData & string)[],
  ): string[] {
    return [
      'Scenario ID',
      'Scenario Name',
      'Status',
      'Attempt',
      'Worker',
      'Start Time',
      'End Time',
      'Duration (ms)',
      ...fields,
      'Error',
    ];
  }

  private createRow(
    evidence: Evidence<TData>,
    fields: readonly (keyof TData & string)[],
  ): string[] {
    return [
      evidence.scenarioId,
      evidence.scenarioName,
      evidence.status,
      String(evidence.attempt),
      evidence.workerId,
      evidence.startTime ?? '',
      evidence.endTime ?? '',
      evidence.durationMs !== undefined
        ? String(evidence.durationMs)
        : '',

      ...fields.map((field) =>
        this.normalizeValue(
          evidence.data[field],
        ),
      ),

      evidence.error?.message ?? '',
    ];
  }

  private normalizeValue(
    value: unknown,
  ): string {
    if (
      value === undefined ||
      value === null
    ) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private escapeCsvValue(
    value: string,
  ): string {
    if (
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  private normalizeFileName(
    fileName: string,
  ): string {
    return fileName.replace(
      /\.csv$/i,
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
