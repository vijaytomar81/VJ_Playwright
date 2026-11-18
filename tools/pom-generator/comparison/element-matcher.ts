
import type {
    ElementKey,
    ElementMatch,
    PageScan,
    ScannedElement,
    StoredElement,
} from '../models/generator.types';

import {
    resolveElementIdentities,
} from '../core/element-identity';

export interface ElementComparison {
    matches: ElementMatch[];
    matched: number;
    added: number;
    notFound: number;
    ambiguous: number;
    warnings: string[];
}

interface LogicalScanGroup {
    representative: ScannedElement;
    members: ScannedElement[];
}

function normalize(value: string | undefined): string {
    return (value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function logicalFieldSignature(
    element: ScannedElement,
): string {
    const fingerprint = element.fingerprint;

    const label =
        fingerprint.labels.parentField ||
        fingerprint.labels.direct ||
        fingerprint.labels.accessible ||
        fingerprint.placeholder ||
        element.suggestedName;

    return [
        element.repeatableGroupKey ?? '',
        element.kind,
        normalize(label),
        normalize(fingerprint.inputType),
        normalize(fingerprint.value),
    ].join('|');
}

function groupLogicalScans(
    elements: readonly ScannedElement[],
): LogicalScanGroup[] {
    const groups: LogicalScanGroup[] = [];
    const repeatableBySignature = new Map<
        string,
        LogicalScanGroup
    >();

    for (const element of elements) {
        if (!element.repeatableGroupKey) {
            groups.push({
                representative: element,
                members: [element],
            });
            continue;
        }

        const signature = logicalFieldSignature(element);
        const existing = repeatableBySignature.get(signature);

        if (existing) {
            existing.members.push(element);
        } else {
            const group: LogicalScanGroup = {
                representative: element,
                members: [element],
            };

            repeatableBySignature.set(signature, group);
            groups.push(group);
        }
    }

    return groups;
}

function matchForScanned(
    scannedId: string,
    stableKey: ElementKey | undefined,
    status: ElementMatch['status'],
    reason: string,
    confidence?: number,
): ElementMatch {
    return {
        status,
        scannedId,
        ...(stableKey ? { existingKey: stableKey } : {}),
        ...(confidence !== undefined
            ? { confidence }
            : {}),
        reason,
    };
}

function markAmbiguous(
    group: LogicalScanGroup,
    reason: string,
): ElementMatch[] {
    return group.members.map((element) =>
        matchForScanned(
            element.temporaryId,
            undefined,
            'ambiguous',
            reason,
        ),
    );
}

export function comparePageElements(
    scan: PageScan,
    existing: readonly StoredElement[],
): ElementComparison {
    const warnings: string[] = [];
    const matches: ElementMatch[] = [];

    const logicalGroups = groupLogicalScans(scan.elements);

    const identities = resolveElementIdentities(
        logicalGroups.map((group) => group.representative),
        existing,
    );

    warnings.push(...identities.warnings);

    const decisions = new Map(
        identities.decisions.map((decision) => [
            decision.scannedId,
            decision,
        ]),
    );

    const claimedKeys = new Set<ElementKey>();

    for (const group of logicalGroups) {
        const decision = decisions.get(
            group.representative.temporaryId,
        );

        if (!decision) {
            matches.push(
                ...markAmbiguous(
                    group,
                    'Identity resolver returned no decision.',
                ),
            );
            continue;
        }

        if (decision.status === 'ambiguous') {
            matches.push(
                ...markAmbiguous(group, decision.reason),
            );
            continue;
        }

        if (
            decision.status === 'matched' &&
            decision.stableKey
        ) {
            if (claimedKeys.has(decision.stableKey)) {
                matches.push(
                    ...markAmbiguous(
                        group,
                        `Stable key "${decision.stableKey}" was ` +
                        'claimed by another logical field.',
                    ),
                );
                continue;
            }

            claimedKeys.add(decision.stableKey);

            for (const member of group.members) {
                matches.push(
                    matchForScanned(
                        member.temporaryId,
                        decision.stableKey,
                        'matched',
                        decision.reason,
                        decision.confidence,
                    ),
                );
            }

            continue;
        }

        if (
            decision.status === 'new' &&
            decision.stableKey
        ) {
            for (const member of group.members) {
                matches.push(
                    matchForScanned(
                        member.temporaryId,
                        decision.stableKey,
                        'new',
                        decision.reason,
                        decision.confidence,
                    ),
                );
            }

            continue;
        }

        matches.push(
            ...markAmbiguous(
                group,
                'Identity decision is incomplete.',
            ),
        );
    }

    for (const element of existing) {
        if (claimedKeys.has(element.stableKey)) {
            continue;
        }

        matches.push({
            status: 'not-found',
            existingKey: element.stableKey,
            reason:
                'Existing element was not uniquely matched ' +
                'in the current scan. Preserve its metadata.',
        });
    }

    const matchedKeys = new Set(
        matches
            .filter((match) => match.status === 'matched')
            .map((match) => match.existingKey),
    );

    const newKeys = new Set(
        matches
            .filter((match) => match.status === 'new')
            .map((match) => match.existingKey),
    );

    const notFoundKeys = new Set(
        matches
            .filter((match) => match.status === 'not-found')
            .map((match) => match.existingKey),
    );

    const ambiguous = matches.filter(
        (match) => match.status === 'ambiguous',
    ).length;

    if (ambiguous > 0) {
        warnings.push(
            `${ambiguous} scanned element(s) have ` +
            'ambiguous identities.',
        );
    }

    return {
        matches,
        matched: matchedKeys.size,
        added: newKeys.size,
        notFound: notFoundKeys.size,
        ambiguous,
        warnings,
    };
}
