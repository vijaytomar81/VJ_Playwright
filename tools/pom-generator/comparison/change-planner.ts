
import type {
    ChangePlan,
    ElementMatch,
    GeneratorChange,
    GeneratorMode,
    LocatorDefinition,
    PageMetadata,
    PageScan,
    ScannedElement,
    StoredElement,
} from '../models/generator.types';

import type {
    ElementComparison,
} from './element-matcher';

export interface ChangePlannerOptions {
    mode: GeneratorMode;
    blockNewWhenUnresolved?: boolean;
}

interface ScanLookup {
    byTemporaryId: Map<string, ScannedElement>;
}

function createLookup(scan: PageScan): ScanLookup {
    return {
        byTemporaryId: new Map(
            scan.elements.map((element) => [
                element.temporaryId,
                element,
            ]),
        ),
    };
}

function sameLocator(
    left: LocatorDefinition,
    right: LocatorDefinition,
): boolean {
    return (
        JSON.stringify(left.primary) ===
        JSON.stringify(right.primary)
    );
}

function sameFallbacks(
    left: LocatorDefinition,
    right: LocatorDefinition,
): boolean {
    return (
        JSON.stringify(left.fallbacks) ===
        JSON.stringify(right.fallbacks)
    );
}

function addChange(
    changes: GeneratorChange[],
    change: GeneratorChange,
): void {
    const identity = [
        change.kind,
        change.elementKey ?? '',
        change.actionKey ?? '',
    ].join('|');

    const existing = changes.find((entry) => {
        const entryIdentity = [
            entry.kind,
            entry.elementKey ?? '',
            entry.actionKey ?? '',
        ].join('|');

        return entryIdentity === identity;
    });

    if (!existing) {
        changes.push(change);
    }
}

function findStoredElement(
    metadata: PageMetadata | undefined,
    key: string,
): StoredElement | undefined {
    return metadata?.elements.find(
        (element) => element.stableKey === key,
    );
}

function describeElement(
    scanned: ScannedElement | undefined,
    stored: StoredElement | undefined,
): string {
    return (
        stored?.name ??
        scanned?.suggestedName ??
        stored?.stableKey ??
        scanned?.temporaryId ??
        'unknown'
    );
}

function planMatchedElement(
    match: ElementMatch,
    lookup: ScanLookup,
    metadata: PageMetadata | undefined,
    changes: GeneratorChange[],
): void {
    if (!match.existingKey || !match.scannedId) {
        return;
    }

    const scanned = lookup.byTemporaryId.get(
        match.scannedId,
    );

    const stored = findStoredElement(
        metadata,
        match.existingKey,
    );

    if (!scanned || !stored) {
        addChange(changes, {
            kind: 'element-ambiguous',
            elementKey: match.existingKey,
            description:
                'Matched element could not be found in ' +
                'scan or stored metadata.',
            safeToApply: false,
        });
        return;
    }

    const label = describeElement(scanned, stored);

    if (!sameLocator(stored.locators, scanned.locators)) {
        addChange(changes, {
            kind: 'primary-locator-changed',
            elementKey: stored.stableKey,
            description:
                `Primary locator changed for "${label}".`,
            safeToApply: true,
        });
    }

    if (!sameFallbacks(stored.locators, scanned.locators)) {
        addChange(changes, {
            kind: 'fallback-locators-changed',
            elementKey: stored.stableKey,
            description:
                `Fallback locators changed for "${label}".`,
            safeToApply: true,
        });
    }

    if (
        stored.groupKey !== scanned.groupKey ||
        stored.repeatableGroupKey !==
        scanned.repeatableGroupKey
    ) {
        addChange(changes, {
            kind: 'group-changed',
            elementKey: stored.stableKey,
            description:
                `Group association changed for "${label}".`,
            safeToApply: false,
        });
    }
}

function planNewElement(
    match: ElementMatch,
    lookup: ScanLookup,
    changes: GeneratorChange[],
    safeToApply: boolean,
): void {
    if (!match.scannedId || !match.existingKey) {
        return;
    }

    const scanned = lookup.byTemporaryId.get(
        match.scannedId,
    );

    addChange(changes, {
        kind: 'element-added',
        elementKey: match.existingKey,
        description:
            `New element "${describeElement(scanned, undefined)}"` +
            (safeToApply
                ? ' can be generated.'
                : ' requires identity review.'),
        safeToApply,
    });
}

function planNotFoundElement(
    match: ElementMatch,
    metadata: PageMetadata | undefined,
    changes: GeneratorChange[],
): void {
    if (!match.existingKey) {
        return;
    }

    const stored = findStoredElement(
        metadata,
        match.existingKey,
    );

    addChange(changes, {
        kind: 'element-not-found',
        elementKey: match.existingKey,
        description:
            `Existing element "${describeElement(
                undefined,
                stored,
            )}" was not found. Preserve it.`,
        safeToApply: false,
    });
}

function planAmbiguousElement(
    match: ElementMatch,
    changes: GeneratorChange[],
): void {
    addChange(changes, {
        kind: 'element-ambiguous',
        elementKey: match.existingKey,
        description:
            `Ambiguous identity for "${match.scannedId ?? 'unknown'}": ` +
            match.reason,
        safeToApply: false,
    });
}

export function planChanges(
    scan: PageScan,
    comparison: ElementComparison,
    metadata: PageMetadata | undefined,
    options: ChangePlannerOptions,
): ChangePlan {
    const changes: GeneratorChange[] = [];
    const lookup = createLookup(scan);

    const blockNewWhenUnresolved =
        options.blockNewWhenUnresolved ?? true;

    const unresolvedExisting =
        comparison.notFound > 0 ||
        comparison.ambiguous > 0;

    const safeNewElements =
        options.mode === 'create' ||
        !blockNewWhenUnresolved ||
        !unresolvedExisting;

    for (const match of comparison.matches) {
        switch (match.status) {
            case 'matched':
                planMatchedElement(
                    match,
                    lookup,
                    metadata,
                    changes,
                );
                break;

            case 'new':
                planNewElement(
                    match,
                    lookup,
                    changes,
                    safeNewElements,
                );
                break;

            case 'not-found':
                planNotFoundElement(
                    match,
                    metadata,
                    changes,
                );
                break;

            case 'ambiguous':
                planAmbiguousElement(match, changes);
                break;
        }
    }

    if (
        options.mode === 'update' &&
        !metadata
    ) {
        addChange(changes, {
            kind: 'element-ambiguous',
            description:
                'UPDATE requires existing page metadata.',
            safeToApply: false,
        });
    }

    const hasConflicts = changes.some(
        (change) => !change.safeToApply,
    );

    return {
        mode: options.mode,
        pageName: scan.pageName,
        changes,
        hasConflicts,
    };
}
