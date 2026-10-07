import type { Evidence } from '../contracts/evidence';

/**
 * Storage contract for raw evidence records.
 *
 * The store knows nothing about consumer business fields.
 * It persists the generic Evidence<TData> envelope exactly as
 * supplied by the execution layer.
 */
export interface EvidenceStore<
  TData extends Record<string, unknown>,
> {
  /**
   * Persists one evidence record.
   */
  add(
    evidence: Evidence<TData>,
  ): Promise<void>;

  /**
   * Returns all evidence records available to this store.
   */
  getAll(): Promise<Evidence<TData>[]>;

  /**
   * Removes all evidence records owned by this store.
   */
  clear(): Promise<void>;
}
