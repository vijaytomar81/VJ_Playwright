/**
 * Consumer-owned evidence field configuration.
 *
 * Single source of truth for:
 * - Report field identifiers
 * - Report column labels
 * - Report column order
 *
 * EvidenceFactory must not define report columns.
 */
export const evidenceFields = [
  // Execution fields
  { field: 'scenarioId', label: 'Scenario ID', order: 1 },
  { field: 'scenarioName', label: 'Scenario Name', order: 2 },
  { field: 'status', label: 'Status', order: 3 },

  // Business fields
  { field: 'policyNumber', label: 'Policy Number', order: 4 },
  { field: 'customerNumber', label: 'Customer Number', order: 5 },
  { field: 'premium', label: 'Premium', order: 6 },

  // Execution metadata
  { field: 'attempt', label: 'Attempt', order: 7 },
  { field: 'workerId', label: 'Worker ID', order: 8 },
  { field: 'startTime', label: 'Start Time', order: 9 },
  { field: 'endTime', label: 'End Time', order: 10 },
  { field: 'durationMs', label: 'Duration (ms)', order: 11 },
  { field: 'error', label: 'Error', order: 12 },
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
 */
export type EvidenceData = Partial<
  Record<BusinessEvidenceField, unknown>
>;