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
import type { ElementComparison } from './element-matcher';
import { nameElements } from '../core/element-namer';
export interface ChangePlannerOptions {
    mode: GeneratorMode;
    blockNewWhenUnresolved?: boolean;
}
interface ScanLookup {
    byTemporaryId: Map<string, ScannedElement>;
    namesByTemporaryId: Map<string, string>;
    conflictsByTemporaryId: Map<string, string>;
}
function createLookup(
    scan: PageScan,
    metadata: PageMetadata | undefined,
): ScanLookup {
    const naming = nameElements(
        scan.elements,
        metadata?.elements ?? [],
    );
    return {
        byTemporaryId: new Map(
            scan.elements.map((element) => [
                element.temporaryId,
                element,
            ]),
        ),
        namesByTemporaryId: new Map(
            naming.elements.map((element) => [
                element.temporaryId,
                element.name,
            ]),
        ),
        conflictsByTemporaryId: new Map(
            naming.conflicts.map((conflict) => [
                conflict.temporaryId,
                conflict.reason,
            ]),
        ),
    };
}
function sameLocator(
    left: LocatorDefinition,
    right: LocatorDefinition,
): boolean {
    return JSON.stringify(left.primary) ===
        JSON.stringify(right.primary);
}
function sameFallbacks(
    left: LocatorDefinition,
    right: LocatorDefinition,
): boolean {
    return JSON.stringify(left.fallbacks) ===
        JSON.stringify(right.fallbacks);
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
    const exists = changes.some((entry) =>
        [
            entry.kind,
            entry.elementKey ?? '',
            entry.actionKey ?? '',
        ].join('|') === identity,
    );
    if (!exists) changes.push(change);
}
function findStoredElement(
    metadata: PageMetadata | undefined,
    key: string,
): StoredElement | undefined {
    return metadata?.elements.find(
        (element) => element.stableKey === key,
    );
}
function resolveName(
    match: ElementMatch,
    lookup: ScanLookup,
    metadata: PageMetadata | undefined,
): string | undefined {
    const stored = match.existingKey
        ? findStoredElement(metadata, match.existingKey)
        : undefined;
    const generated = match.scannedId
        ? lookup.namesByTemporaryId.get(match.scannedId)
        : undefined;
    return stored?.name ?? generated;
}
function getNamingConflict(
    match: ElementMatch,
    lookup: ScanLookup,
): string | undefined {
    return match.scannedId
        ? lookup.conflictsByTemporaryId.get(match.scannedId)
        : undefined;
}
function planNamingConflict(
    match: ElementMatch,
    lookup: ScanLookup,
    metadata: PageMetadata | undefined,
    changes: GeneratorChange[],
): void {
    const reason = getNamingConflict(match, lookup);
    if (!reason) return;
    const elementName = resolveName(match, lookup, metadata);
    addChange(changes, {
        kind: 'element-ambiguous',
        ...(match.existingKey
            ? { elementKey: match.existingKey }
            : {}),
        ...(elementName ? { elementName } : {}),
        description:
            `REVIEW REQUIRED: Naming conflict for ` +
            `"${elementName ?? 'unknown'}". ${reason}`,
        safeToApply: false,
    });
}
function planMatchedElement(
    match: ElementMatch,
    lookup: ScanLookup,
    metadata: PageMetadata | undefined,
    changes: GeneratorChange[],
): void {
    if (!match.existingKey || !match.scannedId) return;
    const scanned = lookup.byTemporaryId.get(match.scannedId);
    const stored = findStoredElement(
        metadata,
        match.existingKey,
    );
    const elementName = resolveName(
        match,
        lookup,
        metadata,
    );
    if (!scanned || !stored) {
        addChange(changes, {
            kind: 'element-ambiguous',
            elementKey: match.existingKey,
            ...(elementName ? { elementName } : {}),
            description:
                `Matched element "${elementName ?? 'unknown'}" ` +
                'could not be found in scan or stored metadata.',
            safeToApply: false,
        });
        return;
    }
    if (!sameLocator(stored.locators, scanned.locators)) {
        addChange(changes, {
            kind: 'primary-locator-changed',
            elementKey: stored.stableKey,
            elementName: stored.name,
            description:
                `Primary locator changed for "${stored.name}".`,
            safeToApply: true,
        });
    }
    if (!sameFallbacks(stored.locators, scanned.locators)) {
        addChange(changes, {
            kind: 'fallback-locators-changed',
            elementKey: stored.stableKey,
            elementName: stored.name,
            description:
                `Fallback locators changed for "${stored.name}".`,
            safeToApply: true,
        });
    }
    if (
        stored.groupKey !== scanned.groupKey ||
        stored.repeatableGroupKey !== scanned.repeatableGroupKey
    ) {
        addChange(changes, {
            kind: 'group-changed',
            elementKey: stored.stableKey,
            elementName: stored.name,
            description:
                `Group association changed for "${stored.name}".`,
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
    if (!match.scannedId || !match.existingKey) return;
    const elementName = lookup.namesByTemporaryId.get(
        match.scannedId,
    );
    addChange(changes, {
        kind: 'element-added',
        elementKey: match.existingKey,
        ...(elementName ? { elementName } : {}),
        description:
            `New element "${elementName ?? 'unknown'}"` +
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
    if (!match.existingKey) return;
    const stored = findStoredElement(
        metadata,
        match.existingKey,
    );
    addChange(changes, {
        kind: 'element-not-found',
        elementKey: match.existingKey,
        ...(stored?.name ? { elementName: stored.name } : {}),
        description:
            `Existing element "${stored?.name ?? 'unknown'}" ` +
            'was not found. Preserve it.',
        safeToApply: false,
    });
}
function planAmbiguousElement(
    match: ElementMatch,
    lookup: ScanLookup,
    metadata: PageMetadata | undefined,
    changes: GeneratorChange[],
): void {
    const elementName = resolveName(
        match,
        lookup,
        metadata,
    );
    addChange(changes, {
        kind: 'element-ambiguous',
        ...(match.existingKey
            ? { elementKey: match.existingKey }
            : {}),
        ...(elementName ? { elementName } : {}),
        description:
            `Ambiguous identity for "${elementName ?? 'unknown'}": ` +
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
    const lookup = createLookup(scan, metadata);
    const blockNewWhenUnresolved =
        options.blockNewWhenUnresolved ?? true;
    const unresolvedExisting =
        comparison.notFound > 0 ||
        comparison.ambiguous > 0;
    const safeNewElements =
        options.mode === 'create' ||
        !blockNewWhenUnresolved ||
        !unresolvedExisting;
    const processedScannedIds = new Set<string>();
    for (const match of comparison.matches) {
        if (match.scannedId) {
            processedScannedIds.add(match.scannedId);
        }
        // A naming conflict takes precedence over matching
        // and prevents SAFE additions or locator updates.
        if (getNamingConflict(match, lookup)) {
            planNamingConflict(
                match,
                lookup,
                metadata,
                changes,
            );
            continue;
        }
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
                planAmbiguousElement(
                    match,
                    lookup,
                    metadata,
                    changes,
                );
                break;
        }
    }
    // Do not silently discard naming conflicts when the
    // element matcher has not returned a corresponding match.
    for (const [scannedId, reason] of lookup.conflictsByTemporaryId) {
        if (processedScannedIds.has(scannedId)) continue;
        const elementName =
            lookup.namesByTemporaryId.get(scannedId);
        changes.push({
            kind: 'element-ambiguous',
            ...(elementName ? { elementName } : {}),
            description:
                `REVIEW REQUIRED: Unmatched scanned element ` +
                `"${elementName ?? scannedId}" (${scannedId}). ` +
                reason,
            safeToApply: false,
        });
    }
    if (options.mode === 'update' && !metadata) {
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
