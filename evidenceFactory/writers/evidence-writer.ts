import type { Evidence } from '../contracts/evidence';
import type { ReportConfig } from '../contracts/report-config';
import type { ReportField } from '../contracts/report-field';

/**
 * Common contract for all final report writers.
 *
 * Every report column comes from consumer-owned
 * field configuration.
 */
export interface EvidenceWriter<
  TData extends Record<string, unknown>,
> {
  write(
    evidence: Evidence<TData>[],
    fields: readonly ReportField[],
    config: ReportConfig,
  ): Promise<string>;
}
