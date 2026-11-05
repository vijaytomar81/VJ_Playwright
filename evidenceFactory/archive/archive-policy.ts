/**
 * Defines archive and retention behavior.
 */
export interface ArchivePolicy {
  /**
   * Compress the completed run directory into a ZIP file.
   */
  compress: boolean;

  /**
   * Delete the original run directory after the ZIP
   * has been created successfully.
   *
   * This is never performed when archive creation fails.
   */
  deleteSourceAfterArchive: boolean;

  /**
   * Number of days completed archives should be retained.
   *
   * Example:
   *   30
   *
   * Set to 0 to disable age-based cleanup.
   */
  retentionDays: number;

  /**
   * Automatically run archive cleanup after successfully
   * archiving a run.
   */
  cleanupAfterRun?: boolean;
}
