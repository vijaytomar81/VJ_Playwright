/**
 * Generic Summary field definition.
 *
 * Actual field names, labels, and order numbers
 * are defined by configLayer.
 */
export interface SummaryFieldConfig {
  field: string;
  label: string;
  order: number;
}

/**
 * Generic Summary section definition.
 *
 * EvidenceFactory does not define section names.
 */
export interface SummarySectionConfig {
  section: string;
  order: number;
  fields: readonly SummaryFieldConfig[];
}

/**
 * Complete consumer-owned Summary configuration.
 */
export type SummarySchema =
  readonly SummarySectionConfig[];

/**
 * Summary values supplied by executionFactory
 * and calculated by evidenceFactory.
 */
export type SummaryData =
  Record<string, unknown>;
