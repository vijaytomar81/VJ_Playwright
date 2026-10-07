import { ReportFormat } from './report-format';

/**
 * Configuration for final evidence report generation.
 */
export interface ReportConfig {
  /**
   * Final output format.
   */
  format: ReportFormat;

  /**
   * Directory where the final report is written.
   */
  outputDir: string;

  /**
   * Optional report file name.
   *
   * The writer adds the appropriate extension.
   */
  fileName?: string;

  /**
   * Optional report title.
   */
  reportTitle?: string;

  /**
   * Optional execution environment.
   */
  environment?: string;
}
