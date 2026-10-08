/**
 * Public API for EvidenceFactory.
 *
 * Only framework-level contracts and components are exported here.
 * Consumer business evidence fields are owned outside EvidenceFactory.
 */

// Main factory
export {
  EvidenceFactory,
} from './evidence-factory';

export type {
  EvidenceFactoryConfig,
  EvidenceReportResult,
  EvidenceFinalizationResult,
} from './evidence-factory';

// Evidence contracts
export type {
  Evidence,
  EvidenceError,
} from './contracts/evidence';

export {
  EvidenceStatus,
} from './contracts/evidence-status';

// Report contracts
export type {
  ReportConfig,
} from './contracts/report-config';

export {
  ReportFormat,
} from './contracts/report-format';

// Evidence stores
export type {
  EvidenceStore,
} from './store/evidence-store';

export {
  FileEvidenceStore,
} from './store/file-evidence-store';

export type {
  FileEvidenceStoreConfig,
} from './store/file-evidence-store';

export {
  MemoryEvidenceStore,
} from './store/memory-evidence-store';

// Archive configuration
export type {
  ArchiveConfig,
} from './archive/archive-config';

export type {
  ArchivePolicy,
} from './archive/archive-policy';

export type {
  ArchiveResult,
} from './archive/archive-manager';

export type {
  ArchiveCleanupResult,
} from './archive/archive-cleaner';

/**
 * Consumer-configurable report field definition.
 *
 * Field names and order values are owned by configLayer.
 */
export type { ReportField } from './contracts/report-field';
