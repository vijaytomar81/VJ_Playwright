import type { ArchivePolicy } from './archive-policy';

/**
 * Configuration for post-execution archiving and retention.
 */
export interface ArchiveConfig {
  /**
   * Enables or disables archiving completely.
   */
  enabled: boolean;

  /**
   * Directory where completed run archives are stored.
   *
   * Example:
   *   ./archive
   */
  archiveDir: string;

  /**
   * Archive and retention behavior.
   */
  policy: ArchivePolicy;
}
