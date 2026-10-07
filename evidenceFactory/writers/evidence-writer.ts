import type { Evidence } from '../contracts/evidence';
import type { ReportConfig } from '../contracts/report-config';

/**
 * Common contract implemented by all final evidence report writers.
 *
 * Business evidence fields are defined outside EvidenceFactory.
 * The ordered field list is supplied by the caller.
 */
export interface EvidenceWriter<
  TData extends Record<string, unknown>,
> {
  write(
    evidence: Evidence<TData>[],
    fields: readonly (keyof TData & string)[],
    config: ReportConfig,
  ): Promise<string>;
}
