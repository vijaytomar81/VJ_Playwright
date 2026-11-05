
import type {
    EvidenceConfigurationOverrides,
} from '../../evidenceFactory/config/evidence-config';

export const evidenceConfig = {
    storage: {
        resultsDirectory: 'custom-test-reports',
    },

    report: {
        title: 'Allianz Automation Execution Report',
        fileNamePrefix: 'execution-report',
    },

    archive: {
        enabled: true,

        policy: {
            compress: true,
            deleteSourceAfterArchive: false,
            retentionDays: 30,
            cleanupAfterRun: false,
        },
    },
} satisfies EvidenceConfigurationOverrides;
