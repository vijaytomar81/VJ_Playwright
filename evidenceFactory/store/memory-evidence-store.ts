import type { Evidence } from '../contracts/evidence';
import type { EvidenceStore } from './evidence-store';

/**
 * In-memory evidence store.
 *
 * Primarily useful for tests or executions that do not require
 * evidence to survive process termination.
 */
export class MemoryEvidenceStore<
  TData extends Record<string, unknown>,
> implements EvidenceStore<TData> {
  private readonly records: Evidence<TData>[] = [];

  async add(
    evidence: Evidence<TData>,
  ): Promise<void> {
    this.records.push(evidence);
  }

  async getAll(): Promise<Evidence<TData>[]> {
    return [...this.records];
  }

  async clear(): Promise<void> {
    this.records.length = 0;
  }
}
