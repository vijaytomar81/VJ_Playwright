
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
    'form',
    'section',
    '[role="group"]',
    '[role="radiogroup"]',
    '[role="region"]',
    '.form-group',
    '.input-group',
    'div[aria-label]',
    'div[aria-labelledby]',
    'div:has(> h1)',
    'div:has(> h2)',
    'div:has(> h3)',
    'div:has(> h4)',
    'div:has(> h5)',
    'div:has(> h6)',
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
        .split(/\s+/)
        .filter(Boolean);

    return ids
        .map((id) => element.ownerDocument.getElementById(id))
        .filter((node): node is HTMLElement =>
            node instanceof HTMLElement,
        )
        .map((node) => normalizeText(node.textContent))
        .filter(Boolean)
        .join(' ');
}

function getDirectChildText(
    element: Element,
    selector: string,
): string {
    for (const child of Array.from(element.children)) {
        if (child.matches(selector)) {
            const text = normalizeText(child.textContent);

            if (text) return text;
        }
    }

    return '';
}

function getNestedHeading(element: Element): string {
    const direct = getDirectChildText(
        element,
        HEADING_SELECTOR,
    );

    if (direct) return direct;

    // Inspect only shallow wrappers to avoid borrowing
    // a heading from an unrelated nested form or section.
    for (const child of Array.from(element.children)) {
        if (
            child.matches(
                'form, section, fieldset, [role="group"], ' +
                '[role="region"], [role="radiogroup"]',
            )
        ) {
            continue;
        }

        if (!child.matches('div, header')) {
            continue;
        }

        const heading = getDirectChildText(
            child,
            HEADING_SELECTOR,
        );

        if (heading) return heading;
    }

    return '';
}

function detectGroupName(
    element: Element,
): { name: string; source: GroupSource } | null {
    if (element.matches('fieldset')) {
        const legend = getDirectChildText(
            element,
            'legend',
        );

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

    const heading = getNestedHeading(element);

    if (heading) {
        return {
            name: heading,
            source: 'section-heading',
        };
    }

    if (element.matches('.form-group, .input-group')) {
        const label = getDirectChildText(
            element,
            'label',
        );

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

    const path = parentKey
        ? `${parentKey}.${slug}`
        : slug;

    return occurrence > 1
        ? `${path}-${occurrence}`
        : path;
}

function getParentGroup(
    element: Element,
    groupMap: Map<Element, DetectedGroup>,
): DetectedGroup | undefined {
    let ancestor = element.parentElement;

    while (ancestor) {
        const group = groupMap.get(ancestor);

        if (group) return group;

        ancestor = ancestor.parentElement;
    }

    return undefined;
}

function isMeaningfulGroup(
    element: Element,
): boolean {
    if (
        element.matches(
            'fieldset, form, section, [role="group"], ' +
            '[role="radiogroup"], [role="region"], ' +
            '.form-group, .input-group',
        )
    ) {
        return true;
    }

    if (!element.matches('div')) {
        return false;
    }

    // Generic divs qualify only when they carry their
    // own label or a heading directly within them.
    return Boolean(
        normalizeText(element.getAttribute('aria-label')) ||
        normalizeText(element.getAttribute('aria-labelledby')) ||
        getDirectChildText(element, HEADING_SELECTOR),
    );
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
        if (!isMeaningfulGroup(element)) {
            continue;
        }

        const identity = detectGroupName(element);

        if (!identity) {
            continue;
        }

        const parent = getParentGroup(
            element,
            groupMap,
        );

        const occurrenceKey = [
            parent?.key ?? '',
            identity.name.toLowerCase(),
        ].join('|');

        const occurrence =
            (occurrences.get(occurrenceKey) ?? 0) + 1;

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

    const groups: ElementGroup[] = detected.map(
        (group) => ({
            key: group.key,
            name: group.name,
            source: group.source,
            ...(group.parentKey
                ? { parentKey: group.parentKey }
                : {}),
        }),
    );

    return { groups, detected };
}

export function findNearestGroup(
    element: Element,
    detected: readonly DetectedGroup[],
): DetectedGroup | undefined {
    const groupMap = new Map(
        detected.map((group) => [
            group.element,
            group,
        ]),
    );

    let current: Element | null = element;

    while (current) {
        const match = groupMap.get(current);

        if (match) return match;

        current = current.parentElement;
    }

    return undefined;
}

export function getGroupPath(
    group: DetectedGroup | undefined,
    detected: readonly DetectedGroup[],
): string[] {
    if (!group) return [];

    const byKey = new Map(
        detected.map((item) => [
            item.key,
            item,
        ]),
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
