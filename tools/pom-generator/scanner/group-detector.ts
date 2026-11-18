
import type {
    ElementGroup,
    GroupSource,
} from '../models/generator.types';

export interface DetectedGroup {
    key: string;
    name: string;
    source: GroupSource;
    parentKey?: string;
    element: Element;
}

export interface GroupDetectionResult {
    groups: ElementGroup[];
    detected: DetectedGroup[];
}

const GROUP_SELECTOR = [
    'fieldset',
    '[role="group"]',
    '[role="radiogroup"]',
    'section',
    '.form-group',
    '.input-group',
].join(', ');

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

function normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function getReferencedText(
    element: Element,
    attribute: string,
): string {
    const ids = normalizeText(element.getAttribute(attribute))
        .split(' ')
        .filter(Boolean);

    const parts: string[] = [];

    for (const id of ids) {
        const referenced = element.ownerDocument.getElementById(id);

        if (referenced) {
            const text = normalizeText(referenced.textContent);

            if (text) {
                parts.push(text);
            }
        }
    }

    return parts.join(' ');
}

function getDirectLegend(element: Element): string {
    for (const child of Array.from(element.children)) {
        if (child.tagName.toLowerCase() === 'legend') {
            return normalizeText(child.textContent);
        }
    }

    return '';
}

function getDirectHeading(element: Element): string {
    for (const child of Array.from(element.children)) {
        if (child.matches(HEADING_SELECTOR)) {
            return normalizeText(child.textContent);
        }
    }

    return '';
}

function getDirectLabel(element: Element): string {
    for (const child of Array.from(element.children)) {
        if (child.tagName.toLowerCase() === 'label') {
            return normalizeText(child.textContent);
        }
    }

    return '';
}

function detectGroupName(
    element: Element,
): { name: string; source: GroupSource } | null {
    if (element.matches('fieldset')) {
        const legend = getDirectLegend(element);

        if (legend) {
            return {
                name: legend,
                source: 'fieldset-legend',
            };
        }
    }

    const labelledBy = getReferencedText(
        element,
        'aria-labelledby',
    );

    if (labelledBy) {
        return {
            name: labelledBy,
            source: 'accessible-name',
        };
    }

    const ariaLabel = normalizeText(
        element.getAttribute('aria-label'),
    );

    if (ariaLabel) {
        return {
            name: ariaLabel,
            source: 'accessible-name',
        };
    }

    const heading = getDirectHeading(element);

    if (heading) {
        return {
            name: heading,
            source: 'section-heading',
        };
    }

    if (element.matches('.form-group, .input-group')) {
        const label = getDirectLabel(element);

        if (label) {
            return {
                name: label,
                source: 'labelled-container',
            };
        }
    }

    return null;
}

function createGroupKey(
    name: string,
    parentKey: string | undefined,
    occurrence: number,
): string {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'group';

    const path = parentKey ? `${parentKey}.${slug}` : slug;

    return occurrence > 1 ? `${path}-${occurrence}` : path;
}

function getParentGroup(
    element: Element,
    groupMap: Map<Element, DetectedGroup>,
): DetectedGroup | undefined {
    let ancestor = element.parentElement;

    while (ancestor) {
        const group = groupMap.get(ancestor);

        if (group) {
            return group;
        }

        ancestor = ancestor.parentElement;
    }

    return undefined;
}

export function detectGroups(
    root: ParentNode = document,
): GroupDetectionResult {
    const elements = Array.from(
        root.querySelectorAll(GROUP_SELECTOR),
    );

    const detected: DetectedGroup[] = [];
    const groupMap = new Map<Element, DetectedGroup>();
    const occurrences = new Map<string, number>();

    for (const element of elements) {
        const identity = detectGroupName(element);

        if (!identity) {
            continue;
        }

        const parent = getParentGroup(element, groupMap);

        const occurrenceKey = [
            parent?.key ?? '',
            identity.name.toLowerCase(),
        ].join('|');

        const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
        occurrences.set(occurrenceKey, occurrence);

        const group: DetectedGroup = {
            key: createGroupKey(
                identity.name,
                parent?.key,
                occurrence,
            ),
            name: identity.name,
            source: identity.source,
            parentKey: parent?.key,
            element,
        };

        detected.push(group);
        groupMap.set(element, group);
    }

    const groups: ElementGroup[] = detected.map((group) => ({
        key: group.key,
        name: group.name,
        source: group.source,
        ...(group.parentKey
            ? { parentKey: group.parentKey }
            : {}),
    }));

    return { groups, detected };
}

export function findNearestGroup(
    element: Element,
    detected: readonly DetectedGroup[],
): DetectedGroup | undefined {
    const groupMap = new Map(
        detected.map((group) => [group.element, group]),
    );

    let current: Element | null = element;

    while (current) {
        const match = groupMap.get(current);

        if (match) {
            return match;
        }

        current = current.parentElement;
    }

    return undefined;
}

export function getGroupPath(
    group: DetectedGroup | undefined,
    detected: readonly DetectedGroup[],
): string[] {
    if (!group) {
        return [];
    }

    const byKey = new Map(
        detected.map((item) => [item.key, item]),
    );

    const path: string[] = [];
    const visited = new Set<string>();

    let current: DetectedGroup | undefined = group;

    while (current && !visited.has(current.key)) {
        visited.add(current.key);
        path.unshift(current.key);

        current = current.parentKey
            ? byKey.get(current.parentKey)
            : undefined;
    }

    return path;
}
