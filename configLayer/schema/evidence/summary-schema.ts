/**
 * Consumer-owned execution summary configuration.
 *
 * Single source of truth for:
 * - Summary section names
 * - Summary section order
 * - Fields belonging to each section
 * - Field display labels
 * - Field display order
 *
 * EvidenceFactory must not hardcode these definitions.
 */
export const summarySchema = [
  {
    section: 'Run',
    order: 1,
    fields: [
      { field: 'runId', label: 'Run Id', order: 1 },
      { field: 'mode', label: 'Mode', order: 2 },
      { field: 'environment', label: 'Environment', order: 3 },
      { field: 'evidenceDirectory', label: 'Evidence Directory', order: 4 },
    ],
  },
  {
    section: 'Runtime',
    order: 2,
    fields: [
      { field: 'machineName', label: 'Machine Name', order: 1 },
      { field: 'user', label: 'User', order: 2 },
      { field: 'platform', label: 'Platform', order: 3 },
      { field: 'osVersion', label: 'OS Version', order: 4 },
    ],
  },
  {
    section: 'Browser',
    order: 3,
    fields: [
      { field: 'browser', label: 'Browser', order: 1 },
      { field: 'browserChannel', label: 'Browser Channel', order: 2 },
      { field: 'browserVersion', label: 'Browser Version', order: 3 },
      { field: 'headless', label: 'Headless', order: 4 },
    ],
  },
  {
    section: 'Results',
    order: 4,
    fields: [
      { field: 'totalItems', label: 'Total Items', order: 1 },
      { field: 'passed', label: 'Passed', order: 2 },
      { field: 'failed', label: 'Failed', order: 3 },
      { field: 'notExecuted', label: 'Not Executed', order: 4 },
      { field: 'passRate', label: 'Pass Rate (%)', order: 5 },
    ],
  },
  {
    section: 'Timing',
    order: 5,
    fields: [
      { field: 'executionTime', label: 'Execution Time', order: 1 },
      { field: 'startedAt', label: 'Started At', order: 2 },
      { field: 'finishedAt', label: 'Finished At', order: 3 },
    ],
  },
] as const;

/**
 * Union of configured section names.
 */
export type SummarySection =
  typeof summarySchema[number]['section'];

/**
 * Union of all configured summary field names.
 */
export type SummaryField =
  typeof summarySchema[number]['fields'][number]['field'];
