import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Evidence } from '../../contracts/evidence';
import type { ReportConfig } from '../../contracts/report-config';
import type { ReportField } from '../../contracts/report-field';
import type { EvidenceWriter } from '../evidence-writer';

/**
 * Generates a CSV evidence report.
 *
 * All report columns and their order come from
 * consumer-owned configuration in configLayer.
 *
 * EvidenceFactory does not define report columns.
 */
export class CsvEvidenceWriter<
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
     * Sort fields using the configured order numbers.
     */
    const orderedFields = [...fields].sort(
      (a, b) => a.order - b.order,
    );

    /**
     * Generate CSV headers dynamically.
     */
    const headers = orderedFields.map(
      ({ field }) => escapeCsv(field),
    );

    /**
     * Generate evidence rows using the same field order.
     */
    const rows = evidence.map((item) =>
      orderedFields
        .map(({ field }) =>
          escapeCsv(
            normalizeValue(
              resolveFieldValue(item, field),
            ),
          ),
        )
        .join(','),
    );

    /**
     * UTF-8 BOM improves compatibility with Excel.
     */
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows].join('\r\n') +
      '\r\n';

    const baseName = (
      config.fileName ?? 'execution-report'
    ).replace(/\.csv$/i, '');

    const reportPath = path.join(
      config.outputDir,
      `${baseName}.csv`,
    );

    const temporaryPath =
      `${reportPath}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(
        temporaryPath,
        csvContent,
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
 * Reads a configured field from the evidence record.
 *
 * Business fields are stored in evidence.data.
 * Framework metadata fields are stored in the
 * evidence envelope.
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
   * Display error.message instead of the complete
   * error object when the configured field is "error".
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

/**
 * Converts evidence values into CSV-compatible strings.
 */
function normalizeValue(
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

/**
 * Escapes CSV values containing:
 * - commas
 * - double quotes
 * - line breaks
 */
function escapeCsv(
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
