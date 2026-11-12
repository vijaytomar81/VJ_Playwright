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
    { field: 'VRN', label: 'VRN', order: 4 },
    { field: 'Email', label: 'Email', order: 5 },
    { field: 'InteractionID', label: 'Interaction ID', order: 6 },
    { field: 'AnnualCoverPolicyNumber', label: 'Policy Number', order: 7 },
    { field: 'AnnualCoverStartDate', label: 'Cover Start Date', order: 8 },
    { field: 'NBStartTime', label: 'NB Start Time', order: 9 },
    { field: 'Bripremium', label: 'Bri Premium', order: 10 },
    { field: 'CardNumber', label: 'Card Number', order: 11 },

    // Execution metadata
    { field: 'retry', label: 'Retry', order: 12 },
    { field: 'workerId', label: 'Worker ID', order: 13 },
    { field: 'startTime', label: 'Start Time', order: 14 },
    { field: 'endTime', label: 'End Time', order: 15 },
    { field: 'duration', label: 'Duration', order: 16 },
    { field: 'error', label: 'Error', order: 17 },
    { field: 'screenshot', label: 'Screenshot', order: 18 },

    // Execution environment
    { field: 'executionMode', label: 'Execution Mode', order: 19 },
    { field: 'device', label: 'Device', order: 20 },
    { field: 'browser', label: 'Browser', order: 21 },
    { field: 'browserChannel', label: 'Browser Channel', order: 22 },
    { field: 'browserVersion', label: 'Browser Version', order: 23 },
    { field: 'viewport', label: 'Viewport', order: 24 },
    { field: 'headless', label: 'Headless', order: 25 },
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
