
import type {
    ElementGroup,
    LocatorDefinition,
    PageScan,
    RepeatableGroup,
    ScannedElement,
} from '../models/generator.types';

import { rankLocators } from '../core/locator-strategy';
import {
    candidateDiagnostic,
    type DomScanDiagnostics,
    type ScanCandidateDiagnostic,
} from './scan-diagnostics';
import { detectGroups } from './group-detector';
import { normalizeElement } from './element-normalizer';
import {
    detectRepeatableGroups,
    type DetectedRepeatableGroup,
} from './repeatable-group-detector';

export interface DomScanOptions {
    pageName: string;
    url?: string;
    includeHidden?: boolean;
}

export interface DomScanResult {
    scan: PageScan;
    warnings: string[];
    diagnostics: DomScanDiagnostics;
}

interface RepeatableMembership {
    group: DetectedRepeatableGroup;
    instance: number;
    section: Element;
}

const INTERACTIVE_SELECTOR = [
    'input:not([type="hidden"])',
    'textarea',
    'select',
    'button',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
].join(', ');

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function collectInteractiveElements(
    root: ParentNode,
): Element[] {
    return Array.from(
        root.querySelectorAll(INTERACTIVE_SELECTOR),
    );
}

function findRepeatableMembership(
    element: Element,
    groups: readonly DetectedRepeatableGroup[],
): RepeatableMembership | undefined {
    for (const group of groups) {
        for (const section of group.sections) {
            if (section.element.contains(element)) {
                return {
                    group,
                    instance: section.index,
                    section: section.element,
                };
            }
        }
    }
    return undefined;
}

function isStableAttribute(value: string): boolean {
    return Boolean(value) &&
        !/^(react-select-|css-|sc-|jsx-)/i.test(value);
}

function getSectionLocator(
    group: DetectedRepeatableGroup,
): LocatorDefinition | undefined {
    if (!group.locator) return undefined;

    return {
        primary: group.locator,
        fallbacks: [],
    };
}

function toStoredRepeatableGroup(
    group: DetectedRepeatableGroup,
): RepeatableGroup | undefined {
    const locator = getSectionLocator(group);
    if (!locator) return undefined;

    return {
        key: group.key,
        name: group.name,
        ...(group.parentKey
            ? { parentKey: group.parentKey }
            : {}),
        locator,
        instanceCount: group.sections.length,
        selection: group.selection,
        publicIndexBase: 1,
    };
}

function collectRepeatableGroups(
    detected: readonly DetectedRepeatableGroup[],
    warnings: string[],
): RepeatableGroup[] {
    const result: RepeatableGroup[] = [];

    for (const group of detected) {
        if (group.confidence < 0.9) {
            warnings.push(
                `Repeatable group "${group.name}" has low confidence ` +
                `(${group.confidence.toFixed(2)}).`,
            );
            continue;
        }

        const stored = toStoredRepeatableGroup(group);

        if (!stored) {
            warnings.push(
                `Repeatable group "${group.name}" has no validated ` +
                'section locator and was not persisted.',
            );
            continue;
        }

        result.push(stored);
    }

    return result;
}

function collectElementWarnings(
    elements: readonly ScannedElement[],
): string[] {
    const warnings: string[] = [];
    const byId = new Map<string, number>();

    for (const element of elements) {
        const id = element.fingerprint.id;

        if (id) {
            byId.set(id, (byId.get(id) ?? 0) + 1);
        }
    }

    for (const [id, count] of byId) {
        if (count > 1) {
            warnings.push(
                `Duplicate DOM id "${id}" found ${count} times.`,
            );
        }
    }

    return warnings;
}

function getPageUrl(
    root: ParentNode,
    supplied?: string,
): string {
    if (supplied) return supplied;

    const doc = root instanceof Document
        ? root
        : root.ownerDocument;

    return doc?.location?.href ?? '';
}

function getActiveRepeatableGroups(
    detected: readonly DetectedRepeatableGroup[],
    persisted: readonly RepeatableGroup[],
): DetectedRepeatableGroup[] {
    const keys = new Set(
        persisted.map((group) => group.key),
    );

    return detected.filter(
        (group) => keys.has(group.key),
    );
}

function validateRepeatableLocator(
    group: DetectedRepeatableGroup,
    root: ParentNode,
): boolean {
    const locator = group.locator;

    if (!locator || locator.strategy !== 'css') {
        return false;
    }

    const selector = locator.value;

    if (
        !selector.startsWith('.') ||
        !isStableAttribute(selector.slice(1))
    ) {
        return false;
    }

    try {
        const matches = Array.from(
            root.querySelectorAll(selector),
        );

        if (matches.length !== group.sections.length) {
            return false;
        }

        return group.sections.every(
            (section, index) =>
                matches[index] === section.element,
        );
    } catch {
        return false;
    }
}

function filterValidatedRepeatables(
    groups: readonly DetectedRepeatableGroup[],
    root: ParentNode,
    warnings: string[],
): DetectedRepeatableGroup[] {
    return groups.filter((group) => {
        if (!validateRepeatableLocator(group, root)) {
            warnings.push(
                `Repeatable group "${group.name}" does not have a ` +
                'unique, ordered section selector.',
            );
            return false;
        }

        return true;
    });
}

export function scanDom(
    root: ParentNode,
    options: DomScanOptions,
): DomScanResult {
    const warnings: string[] = [];

    const groupResult = detectGroups(root);
    const repeatableResult = detectRepeatableGroups(root);

    warnings.push(...repeatableResult.warnings);

    const validatedRepeatables = filterValidatedRepeatables(
        repeatableResult.groups,
        root,
        warnings,
    );

    const repeatableGroups = collectRepeatableGroups(
        validatedRepeatables,
        warnings,
    );

    const activeRepeatables = getActiveRepeatableGroups(
        validatedRepeatables,
        repeatableGroups,
    );

    const controls = collectInteractiveElements(root);
    const elements: ScannedElement[] = [];
    const candidates: ScanCandidateDiagnostic[] = [];

    for (const [index, control] of controls.entries()) {
        const membership = findRepeatableMembership(
            control,
            activeRepeatables,
        );

        const normalized = normalizeElement(control, {
            temporaryId: `scan_${String(index + 1).padStart(4, '0')}`,
            groups: groupResult.detected,
            ...(membership
                ? {
                    repeatableGroupKey: membership.group.key,
                    repeatableInstance: membership.instance,
                }
                : {}),
        });

        if (
            !options.includeHidden &&
            normalized.visibility !== 'visible'
        ) {
            candidates.push({
                ...candidateDiagnostic(normalized, 'hidden'),
                reason: `Visibility: ${normalized.visibility}`,
            });
            continue;
        }

        const scope = membership
            ? membership.section
            : control.ownerDocument;

        const ranking = rankLocators(
            control,
            normalized,
            { scope },
        );

        warnings.push(...ranking.warnings);

        if (!ranking.locators) {
            const reason = membership
                ? 'No unique, stable locator within repeatable section.'
                : 'No unique, stable locator.';

            warnings.push(
                `Skipped ${normalized.temporaryId}: ${reason}`,
            );

            candidates.push({
                ...candidateDiagnostic(normalized, 'rejected'),
                evaluations: ranking.evaluations,
                reason,
            });
            continue;
        }

        const ranked: ScannedElement = {
            ...normalized,
            locators: ranking.locators,
        };

        elements.push(ranked);

        candidates.push({
            ...candidateDiagnostic(ranked, 'accepted'),
            locator: ranking.locators.primary,
        });
    }

    warnings.push(...collectElementWarnings(elements));

    const groups: ElementGroup[] = groupResult.groups;

    const scan: PageScan = {
        pageName: clean(options.pageName),
        url: getPageUrl(root, options.url),
        scannedAt: new Date().toISOString(),
        elements,
        groups,
        repeatableGroups,
    };

    const diagnostics: DomScanDiagnostics = {
        candidates,
        total: candidates.length,
        accepted: elements.length,
        hidden: candidates.filter(
            (item) => item.status === 'hidden',
        ).length,
        rejected: candidates.filter(
            (item) => item.status === 'rejected',
        ).length,
    };

    return {
        scan,
        warnings,
        diagnostics,
    };
}
