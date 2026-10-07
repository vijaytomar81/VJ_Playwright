import fs from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
import { EvidenceStatus } from '../../contracts/evidence-status';
import type { ReportConfig } from '../../contracts/report-config';
import type { EvidenceWriter } from '../evidence-writer';
import { createEvidenceSheet } from './evidence-sheet';
import { createSummarySheet } from './summary-sheet';

/**
 * Generates the final Excel evidence workbook.
 *
 * Workbook structure:
 *
 * - Summary
 * - All
 * - Passed
 * - Failed
 * - Not Executed
 *
 * Business columns are supplied by the consuming automation.
 */
export class ExcelEvidenceWriter<
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

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Evidence Factory';
    workbook.created = new Date();
    workbook.modified = new Date();

    createSummarySheet(
      workbook,
      evidence,
      config,
    );

    createEvidenceSheet(
      workbook,
      evidence,
      fields,
      {
        name: 'All',
      },
    );

    createEvidenceSheet(
      workbook,
      evidence.filter(
        (item) =>
          item.status === EvidenceStatus.PASSED,
      ),
      fields,
      {
        name: 'Passed',
        status: EvidenceStatus.PASSED,
      },
    );

    createEvidenceSheet(
      workbook,
      evidence.filter(
        (item) =>
          item.status === EvidenceStatus.FAILED,
      ),
      fields,
      {
        name: 'Failed',
        status: EvidenceStatus.FAILED,
      },
    );

    createEvidenceSheet(
      workbook,
      evidence.filter(
        (item) =>
          item.status === EvidenceStatus.NOT_EXECUTED,
      ),
      fields,
      {
        name: 'Not Executed',
        status: EvidenceStatus.NOT_EXECUTED,
      },
    );

    const fileName = this.normalizeFileName(
      config.fileName ?? 'execution-report',
    );

    const filePath = path.join(
      config.outputDir,
      `${fileName}.xlsx`,
    );

    await this.writeAtomically(
      workbook,
      filePath,
    );

    return filePath;
  }

  private normalizeFileName(
    fileName: string,
  ): string {
    return fileName.replace(
      /\.xlsx$/i,
      '',
    );
  }

  private async writeAtomically(
    workbook: ExcelJS.Workbook,
    filePath: string,
  ): Promise<void> {
    const temporaryPath =
      `${filePath}.${process.pid}.tmp`;

    try {
      await workbook.xlsx.writeFile(
        temporaryPath,
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
