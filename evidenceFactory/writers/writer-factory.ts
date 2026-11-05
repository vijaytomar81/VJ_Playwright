import { ReportFormat } from '../contracts/report-format';

import type { EvidenceWriter } from './evidence-writer';

import {
  CsvEvidenceWriter,
} from './csv/csv-evidence-writer';

import {
  ExcelEvidenceWriter,
} from './excel/excel-evidence-writer';

import {
  JsonEvidenceWriter,
} from './json/json-evidence-writer';

/**
 * Creates the report writer corresponding to the configured
 * report format.
 */
export function createEvidenceWriter<
  TData extends Record<string, unknown>,
>(
  format: ReportFormat,
): EvidenceWriter<TData> {
  switch (format) {
    case ReportFormat.JSON:
      return new JsonEvidenceWriter<TData>();

    case ReportFormat.CSV:
      return new CsvEvidenceWriter<TData>();

    case ReportFormat.EXCEL:
      return new ExcelEvidenceWriter<TData>();

    default:
      return assertNever(format);
  }
}

/**
 * Compile-time exhaustive check for ReportFormat.
 */
function assertNever(
  value: never,
): never {
  throw new Error(
    `Unsupported report format: ${String(value)}`,
  );
}
