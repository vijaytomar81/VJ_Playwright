
import type { ArchivePolicy } from '../archive/archive-policy';

export interface EvidenceConfiguration {
    storage: {
        resultsDirectory: string;
        evidenceDirectoryName: string;
        metadataDirectoryName: string;
    };

    report: {
        directoryName: string;
        title: string;
        fileNamePrefix: string;
        format: 'excel';
    };

    archive: {
        enabled: boolean;
        directoryName: string;
        policy: ArchivePolicy;
    };
}

export type EvidenceConfigurationOverrides = {
    [K in keyof EvidenceConfiguration]?:
    Partial<EvidenceConfiguration[K]>;
};
