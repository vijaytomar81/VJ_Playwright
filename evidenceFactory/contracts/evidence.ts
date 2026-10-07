import { EvidenceStatus } from './evidence-status';

/**
 * Framework-owned error information.
 */
export interface EvidenceError {
  message: string;
  stack?: string;
}

/**
 * Generic evidence envelope produced by the execution layer.
 *
 * EvidenceFactory owns only the execution metadata.
 *
 * Business evidence fields are supplied through TData and are
 * defined outside EvidenceFactory.
 */
export interface Evidence<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  runId: string;
  workerId: string;
  attempt: number;

  scenarioId: string;
  scenarioName: string;

  status: EvidenceStatus;

  startTime?: string;
  endTime?: string;
  durationMs?: number;

  /**
   * Consumer-owned evidence values.
   *
   * Example:
   *
   * {
   *   policyNumber: 'POL-123',
   *   customerNumber: 'CUS-456'
   * }
   *
   * EvidenceFactory does not define these fields.
   */
  data: TData;

  error?: EvidenceError;
}
