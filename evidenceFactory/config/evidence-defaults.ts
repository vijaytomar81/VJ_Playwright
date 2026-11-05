
import type {
    EvidenceConfiguration,
} from './evidence-config';

export const defaultEvidenceConfig: EvidenceConfiguration = {
    storage: {
        resultsDirectory: 'results',
        evidenceDirectoryName: 'evidence',
        metadataDirectoryName: 'metadata',
    },

    report: {
        directoryName: 'reports',
        title: 'Automation Execution Report',
        fileNamePrefix: 'execution-report',
        format: 'excel',
    },

    archive: {
        enabled: false,
        directoryName: 'evidence-archives',

        policy: {
            compress: true,
            deleteSourceAfterArchive: false,
            retentionDays: 30,
            cleanupAfterRun: false,
        },
    },
};
