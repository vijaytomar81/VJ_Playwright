import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Evidence } from '../../contracts/evidence';
import type { ReportConfig } from '../../contracts/report-config';
import type { ReportField } from '../../contracts/report-field';
import type { EvidenceWriter } from '../evidence-writer';

/**
 * Generates the final JSON evidence report.
 *
 * All report fields and their order are supplied
 * through consumer-owned configuration.
 *
 * Raw evidence files remain unchanged.
 */
export class JsonEvidenceWriter<
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

    /**
     * Sort fields by their configured order numbers.
     */
    const orderedFields = [...fields].sort(
      (a, b) => a.order - b.order,
    );

    /**
     * Build each report record using the configured
     * field names and order.
     */
    const reportRecords = evidence.map((item) => {
      const record: Record<string, unknown> = {};

      for (const { field } of orderedFields) {
        record[field] = resolveFieldValue(
          item,
          field,
        ) ?? null;
      }

      return record;
    });

    /**
     * Final JSON report structure.
     */
    const report = {
      metadata: {
        reportTitle: config.reportTitle,
        environment: config.environment,
        generatedAt: new Date().toISOString(),
        total: evidence.length,
      },

      evidence: reportRecords,
    };

    const baseName = (
      config.fileName ?? 'execution-report'
    ).replace(/\.json$/i, '');

    const reportPath = path.join(
      config.outputDir,
      `${baseName}.json`,
    );

    const temporaryPath =
      `${reportPath}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(
        temporaryPath,
        JSON.stringify(report, null, 2),
        'utf8',
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

/**
 * Resolves a configured report field.
 *
 * Business fields come from evidence.data.
 * Framework metadata fields come from the
 * evidence envelope.
 *
 * EvidenceFactory does not define business fields.
 */
function resolveFieldValue<
  TData extends Record<string, unknown>,
>(
  evidence: Evidence<TData>,
  field: string,
): unknown {
  if (
    Object.prototype.hasOwnProperty.call(
      evidence.data,
      field,
    )
  ) {
    return evidence.data[field];
  }

  const envelope =
    evidence as unknown as Record<string, unknown>;

  const value = envelope[field];

  /**
   * Use the error message when the configured
   * field is "error".
   */
  if (
    field === 'error' &&
    value &&
    typeof value === 'object' &&
    'message' in value
  ) {
    return value.message;
  }

  return value;
}
