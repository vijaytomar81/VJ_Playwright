
import type {
    LocatorCandidate,
    ScannedElement,
} from '../models/generator.types';

import type {
    LocatorEvaluation,
} from '../core/locator-strategy';

export type ScanCandidateStatus =
    | 'accepted'
    | 'hidden'
    | 'rejected';

export interface ScanCandidateDiagnostic {
    temporaryId: string;
    status: ScanCandidateStatus;
    kind: ScannedElement['kind'];
    tagName: string;
    name: string;
    id?: string;
    visibility: ScannedElement['visibility'];
    locator?: LocatorCandidate;
    evaluations?: LocatorEvaluation[];
    reason?: string;
}

export interface DomScanDiagnostics {
    candidates: ScanCandidateDiagnostic[];
    total: number;
    accepted: number;
    hidden: number;
    rejected: number;
}

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function candidateDiagnostic(
    element: ScannedElement,
    status: ScanCandidateStatus,
): ScanCandidateDiagnostic {
    const fingerprint = element.fingerprint;
    const labels = fingerprint.labels;

    return {
        temporaryId: element.temporaryId,
        status,
        kind: element.kind,
        tagName: fingerprint.tagName,
        name: clean(
            fingerprint.text ||
            labels.direct ||
            labels.accessible ||
            fingerprint.placeholder ||
            fingerprint.name ||
            fingerprint.id ||
            labels.parentField ||
            labels.parentGroup ||
            element.suggestedName,
        ),
        ...(fingerprint.id ? { id: fingerprint.id } : {}),
        visibility: element.visibility,
    };
}
