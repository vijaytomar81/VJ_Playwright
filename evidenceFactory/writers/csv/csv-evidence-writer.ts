import fs from 'node:fs/promises';
import path from 'node:path';

import type { Evidence } from '../../contracts/evidence';
import type { ReportField } from '../../contracts/report-field';
import type { ReportConfig } from '../../contracts/report-config';

import type { EvidenceWriter } from '../evidence-writer';

/**
 * Generates a CSV report from final evidence.
 *
 * Column identifiers, labels, and order are
 * supplied by configLayer.
 */
export class CsvEvidenceWriter<
  TData extends Record<string, unknown>,
> implements EvidenceWriter<TData> {
  async write(
    evidence: Evidence<TData>[],
    fields: readonly ReportField[],
    config: ReportConfig,
  ): Promise<string> {
    await fs.mkdir(config.outputDir, {
      recursive: true,
    });

    const fileName =
      config.fileName ?? 'evidence-report';

    const reportPath = path.join(
      config.outputDir,
      `${fileName}.csv`,
    );

    const orderedFields = [...fields].sort(
      (a, b) => a.order - b.order,
    );

    /**
     * CSV column headers use display labels.
     */
    const header = orderedFields
      .map(({ label }) => escapeCsv(label))
      .join(',');

    const rows = evidence.map((item) => {
      return orderedFields
        .map(({ field }) => {
          const value = resolveEvidenceValue(
            item,
            field,
          );

          return escapeCsv(value);
        })
        .join(',');
    });

    const csv = [
      header,
      ...rows,
    ].join('\n');

    await fs.writeFile(
      reportPath,
      `${csv}\n`,
      'utf8',
    );

    return reportPath;
  }
}

/**
 * Resolves configured fields from business
 * data or the framework evidence envelope.
 */
function resolveEvidenceValue<
  TData extends Record<string, unknown>,
>(
  evidence: Evidence<TData>,
  field: string,
): unknown {
  const businessData =
    evidence.data as Record<string, unknown>;

  if (
    Object.prototype.hasOwnProperty.call(
      businessData,
      field,
    )
  ) {
    return businessData[field];
  }

  const envelope =
    evidence as unknown as Record<string, unknown>;

  const value = envelope[field];

  if (
    field === 'error' &&
    value !== null &&
    typeof value === 'object' &&
    'message' in value
  ) {
    return value.message;
  }

  return value;
}

/**
 * Escapes values according to CSV rules.
 *
 * Values containing commas, quotes, or
 * line breaks are enclosed in quotes.
 */
function escapeCsv(value: unknown): string {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  const text =
    typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
