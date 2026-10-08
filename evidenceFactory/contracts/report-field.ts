/**
 * Generic report field configuration.
 *
 * The consumer defines:
 * - Field identifier
 * - Display label
 * - Column order
 *
 * EvidenceFactory must not define report columns.
 */
export interface ReportField {
  field: string;
  label: string;
  order: number;
}
