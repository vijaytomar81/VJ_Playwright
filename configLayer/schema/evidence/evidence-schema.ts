/**
 * Consumer-owned evidence field configuration.
 *
 * This is the single source of truth for:
 *
 * - allowed evidence field names
 * - evidence field/report order
 *
 * The position of each field in this array determines its order
 * in the generated evidence report.
 *
 * EvidenceFactory must not define or maintain these business fields.
 */
export const evidenceFields = [
  'policyNumber',
  'customerNumber',
  'premium',
] as const;

/**
 * Union of all configured evidence field names.
 *
 * Produces:
 *
 * 'policyNumber' | 'customerNumber' | 'premium'
 */
export type EvidenceField =
  typeof evidenceFields[number];

/**
 * Evidence data populated by the execution layer.
 *
 * Not every scenario is required to populate every configured field.
 */
export type EvidenceData = Partial<
  Record<EvidenceField, unknown>
>;
