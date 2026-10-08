/**
 * Consumer-owned evidence field configuration.
 *
 * Single source of truth for:
 * - All final report field names
 * - Final report column order
 *
 * EvidenceFactory receives this configuration and sorts
 * fields by their order number.
 *
 * EvidenceFactory must not define report fields or their order.
 */
export const evidenceFields = [
  // Execution fields
  { field: 'scenarioId', order: 1 },
  { field: 'scenarioName', order: 2 },
  { field: 'status', order: 3 },

  // Business fields
  { field: 'policyNumber', order: 4 },
  { field: 'customerNumber', order: 5 },
  { field: 'premium', order: 6 },

  // Execution metadata
  { field: 'attempt', order: 7 },
  { field: 'workerId', order: 8 },
  { field: 'startTime', order: 9 },
  { field: 'endTime', order: 10 },
  { field: 'durationMs', order: 11 },
  { field: 'error', order: 12 },
] as const;

/**
 * Union of all configured report field names.
 */
export type EvidenceField =
  typeof evidenceFields[number]['field'];

/**
 * Framework-owned fields stored in the Evidence envelope.
 */
export type FrameworkEvidenceField =
  | 'runId'
  | 'workerId'
  | 'attempt'
  | 'scenarioId'
  | 'scenarioName'
  | 'status'
  | 'startTime'
  | 'endTime'
  | 'durationMs'
  | 'error';

/**
 * Business fields populated by executionFactory.
 */
export type BusinessEvidenceField =
  Exclude<EvidenceField, FrameworkEvidenceField>;

/**
 * Consumer business evidence data.
 *
 * Not every scenario needs to populate every business field.
 */
export type EvidenceData = Partial<
  Record<BusinessEvidenceField, unknown>
>;
