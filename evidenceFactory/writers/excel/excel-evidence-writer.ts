import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import ExcelJS from 'exceljs';

import type { Evidence } from '../../contracts/evidence';
import { EvidenceStatus } from '../../contracts/evidence-status';
import type { ReportConfig } from '../../contracts/report-config';
import type { ReportField } from '../../contracts/report-field';

import type { EvidenceWriter } from '../evidence-writer';

import { createEvidenceSheet } from './evidence-sheet';
import { createSummarySheet } from './summary-sheet';

/**
 * Generates the final Excel evidence report.
 *
 * All report column names and their order are supplied
 * through the consumer-owned field configuration.
 *
 * This writer does not define report columns.
 */
export class ExcelEvidenceWriter<
  TData extends Record<string, unknown>,
> implements EvidenceWriter<TData> {
  async write(
    evidence: Evidence<TData>[],
    fields: readonly ReportField[],
    config: ReportConfig,
  ): Promise<string> {
    await fs.mkdir(
      config.outputDir,
      { recursive: true },
    );

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Evidence Factory';
    workbook.created = new Date();
    workbook.modified = new Date();

    /**
     * Summary worksheet.
     *
     * Contains execution statistics rather than
     * scenario evidence columns.
     */
    createSummarySheet(
      workbook,
      evidence,
      config,
    );

    /**
     * All scenarios.
     */
    createEvidenceSheet(
      workbook,
      evidence,
      fields,
      {
        name: 'All',
      },
    );

    /**
     * Passed scenarios.
     */
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

    /**
     * Failed scenarios.
     */
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

    /**
     * Not executed scenarios.
     */
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

    /**
     * Prepare the final Excel file path.
     */
    const baseName = (
      config.fileName ?? 'execution-report'
    ).replace(/\.xlsx$/i, '');

    const reportPath = path.join(
      config.outputDir,
      `${baseName}.xlsx`,
    );

    /**
     * Write to a temporary file first.
     *
     * This reduces the risk of leaving a partially
     * written report if generation fails.
     */
    const temporaryPath =
      `${reportPath}.${randomUUID()}.tmp`;

    try {
      await workbook.xlsx.writeFile(
        temporaryPath,
      );

      await fs.rename(
        temporaryPath,
        reportPath,
      );

      return reportPath;
    } catch (error) {
      await fs.rm(
        temporaryPath,
        { force: true },
      );

      throw error;
    }
  }
}
