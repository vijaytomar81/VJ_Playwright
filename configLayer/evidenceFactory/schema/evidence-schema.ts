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
    { field: 'Bripremium', label: 'Bri Premium', order: 7 },

    // Execution metadata
    { field: 'retry', label: 'Retry', order: 8 },
    { field: 'workerId', label: 'Worker ID', order: 9 },
    { field: 'startTime', label: 'Start Time', order: 10 },
    { field: 'endTime', label: 'End Time', order: 11 },
    { field: 'duration', label: 'Duration', order: 12 },
    { field: 'error', label: 'Error', order: 13 },

    // Execution environment
    { field: 'executionMode', label: 'Execution Mode', order: 14 },
    { field: 'device', label: 'Device', order: 15 },
    { field: 'browser', label: 'Browser', order: 16 },
    { field: 'browserChannel', label: 'Browser Channel', order: 17 },
    { field: 'browserVersion', label: 'Browser Version', order: 18 },
    { field: 'headless', label: 'Headless', order: 19 },
] as const;

/**
 * Union of all configured evidence field names.
 *
 * Automatically derived from evidenceFields.
 */
export type EvidenceField =
    (typeof evidenceFields)[number]['field'];

/**
 * Evidence data type derived from the schema.
 *
 * Allows only configured field identifiers.
 */
export type EvidenceData = Partial<
    Record<EvidenceField, unknown>
>;

/**
 * Runtime field identifiers derived from evidenceFields.
 *
 * Field names are defined only once.
 *
 * Examples:
 * EvidenceData.scenarioId    -> 'scenarioId'
 * EvidenceData.policyNumber  -> 'policyNumber'
 * EvidenceData.duration      -> 'duration'
 * EvidenceData.browser       -> 'browser'
 */
export const EvidenceData = Object.fromEntries(
    evidenceFields.map(({ field }) => [field, field]),
) as {
        readonly [K in EvidenceField]: K;
    };
