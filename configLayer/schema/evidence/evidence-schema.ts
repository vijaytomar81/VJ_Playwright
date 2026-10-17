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
 * Union of all configured evidence field names.
 */
export type EvidenceField =
  typeof evidenceFields[number]['field'];

/**
 * Evidence data type derived from the schema.
 */
export type EvidenceData = Partial<
  Record<EvidenceField, unknown>
>;

/**
 * Runtime field identifiers derived from evidenceFields.
 *
 * Field names are defined only once.
 */
export const EvidenceData = Object.fromEntries(
  evidenceFields.map(({ field }) => [field, field]),
) as {
    readonly [K in EvidenceField]: K;
  };