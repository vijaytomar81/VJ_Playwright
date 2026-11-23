
import type {
    DomScanDiagnostics,
    ScanCandidateDiagnostic,
} from '../scanner/scan-diagnostics';

function formatLocator(
    locator: NonNullable<ScanCandidateDiagnostic['locator']>,
): string {
    const details = [
        `strategy=${locator.strategy}`,
        `value=${JSON.stringify(locator.value)}`,
    ];

    if (locator.role) {
        details.push(`role=${JSON.stringify(locator.role)}`);
    }

    if (locator.name) {
        details.push(`name=${JSON.stringify(locator.name)}`);
    }

    if (locator.exact !== undefined) {
        details.push(`exact=${locator.exact}`);
    }

    if (locator.scopeGroupKey) {
        details.push(
            `scope=${JSON.stringify(locator.scopeGroupKey)}`,
        );
    }

    return details.join(' ');
}

function formatCandidate(
    candidate: ScanCandidateDiagnostic,
): string[] {
    const lines = [
        `  ${candidate.temporaryId} ` +
        `<${candidate.tagName.toLowerCase()}> ` +
        `kind=${candidate.kind} ` +
        `name=${JSON.stringify(candidate.name)} ` +
        `id=${JSON.stringify(candidate.id ?? '')}`,
    ];

    if (candidate.status === 'hidden') {
        lines.push(
            `    Visibility: ${candidate.visibility}`,
        );
    }

    if (candidate.locator) {
        lines.push(
            `    Primary: ${formatLocator(candidate.locator)}`,
        );
    }

    if (candidate.reason) {
        lines.push(`    Reason: ${candidate.reason}`);
    }

    for (const evaluation of candidate.evaluations ?? []) {
        lines.push(
            `    Attempt: ${formatLocator(evaluation.candidate)}`,
        );
        lines.push(
            `      matches=${evaluation.matchCount} ` +
            `target=${evaluation.matchesTarget} ` +
            `accepted=${evaluation.accepted} ` +
            `score=${evaluation.score}`,
        );
        lines.push(
            `      Reason: ${evaluation.reason}`,
        );
    }

    if (
        candidate.status === 'rejected' &&
        !candidate.evaluations?.length
    ) {
        lines.push('    No locator candidates were available.');
    }

    return lines;
}

export function formatScanDiagnostics(
    diagnostics: DomScanDiagnostics,
): string {
    const lines = [
        '',
        'DOM SCAN DIAGNOSTICS',
        '====================',
        `Total candidates: ${diagnostics.total}`,
        `Accepted: ${diagnostics.accepted}`,
        `Hidden:   ${diagnostics.hidden}`,
        `Rejected: ${diagnostics.rejected}`,
    ];

    const groups = [
        { status: 'accepted', title: 'ACCEPTED' },
        { status: 'hidden', title: 'HIDDEN' },
        { status: 'rejected', title: 'REJECTED' },
    ] as const;

    for (const group of groups) {
        const candidates = diagnostics.candidates.filter(
            (candidate) => candidate.status === group.status,
        );

        lines.push('');
        lines.push(
            `${group.title} (${candidates.length})`,
        );
        lines.push('-'.repeat(40));

        if (candidates.length === 0) {
            lines.push('  None');
            continue;
        }

        for (const candidate of candidates) {
            lines.push(...formatCandidate(candidate));
        }
    }

    return lines.join('\n');
}
