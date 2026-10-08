import type { ReportFormat } from './report-format';

import type {
  SummaryData,
  SummarySchema,
} from './summary-schema';

/**
 * Configuration for generating a final evidence report.
 */
export interface ReportConfig {
  format: ReportFormat;

  outputDir: string;
  fileName?: string;

  reportTitle?: string;
  environment?: string;

  /**
   * Consumer-owned Summary section/field configuration.
   */
  summarySchema?: SummarySchema;

  /**
   * Summary values supplied by the execution layer.
   *
   * EvidenceFactory adds calculated result statistics.
   */
  summaryData?: SummaryData;
}
