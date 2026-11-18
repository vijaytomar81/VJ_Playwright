
import type {
    ElementFingerprint,
    ElementKind,
    ElementLabels,
    ElementVisibility,
    LocatorCandidate,
    LocatorDefinition,
    ScannedElement,
} from '../models/generator.types';

import {
    findNearestGroup,
    getGroupPath,
    type DetectedGroup,
} from './group-detector';

export interface NormalizeElementOptions {
    temporaryId: string;
    groups?: readonly DetectedGroup[];
    repeatableGroupKey?: string;
    repeatableInstance?: number;
}

const CAPTURED_ATTRIBUTES = [
    'id',
    'name',
    'type',
    'role',
    'value',
    'placeholder',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-autocomplete',
    'aria-haspopup',
    'data-testid',
    'data-test',
    'data-cy',
    'maxlength',
] as const;

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function getAttribute(
    element: Element,
    name: string,
): string | undefined {
    return clean(element.getAttribute(name)) || undefined;
}

function getReferencedLabel(element: Element): string | undefined {
    const ids = getAttribute(element, 'aria-labelledby')
        ?.split(/\s+/) ?? [];

    const texts = ids
        .map((id) => element.ownerDocument.getElementById(id))
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
        .map((node) => clean(node.textContent))
        .filter(Boolean);

    return texts.join(' ') || undefined;
}

function getDirectLabel(element: Element): {
    text?: string;
    labelFor?: string;
} {
    const labels = Array.from(
        element.ownerDocument.querySelectorAll('label'),
    );

    const matches = labels.filter((label) => {
        if (label.control === element) {
            return true;
        }

        return label.contains(element);
    });

    const label = matches[0];

    return {
        text: label ? clean(label.textContent) : undefined,
        labelFor: label?.getAttribute('for') || undefined,
    };
}

function getParentFieldLabel(element: Element): string | undefined {
    let parent = element.parentElement;

    while (parent) {
        if (parent.matches('.form-group, fieldset, [role="group"]')) {
            const labels = Array.from(parent.children)
                .filter((child) => child.tagName.toLowerCase() === 'label');

            const label = labels[0];

            if (label) {
                return clean(label.textContent) || undefined;
            }

            const legend = parent.querySelector(':scope > legend');

            if (legend) {
                return clean(legend.textContent) || undefined;
            }
        }

        parent = parent.parentElement;
    }

    return undefined;
}

function collectLabels(
    element: Element,
    parentGroup?: string,
): ElementLabels {
    const direct = getDirectLabel(element);
    const referenced = getReferencedLabel(element);
    const ariaLabel = getAttribute(element, 'aria-label');
    const parentField = getParentFieldLabel(element);

    const accessible = referenced || ariaLabel;

    const source: ElementLabels['source'] =
        direct.text
            ? 'direct'
            : accessible
                ? 'accessible'
                : parentField
                    ? 'parent-field'
                    : parentGroup
                        ? 'parent-group'
                        : 'attribute';

    return {
        ...(direct.text ? { direct: direct.text } : {}),
        ...(direct.labelFor ? { labelFor: direct.labelFor } : {}),
        ...(accessible ? { accessible } : {}),
        ...(parentField ? { parentField } : {}),
        ...(parentGroup ? { parentGroup } : {}),
        source,
    };
}

function classifyElement(element: Element): ElementKind {
    const tag = element.tagName.toLowerCase();
    const role = getAttribute(element, 'role');
    const type = getAttribute(element, 'type')?.toLowerCase();

    if (role === 'combobox') return 'combobox';
    if (role === 'checkbox') return 'checkbox';
    if (role === 'radio') return 'radio';
    if (role === 'button') return 'button';
    if (role === 'link') return 'link';

    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';

    if (tag === 'input') {
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'date') return 'date';
        return 'input';
    }

    return 'unknown';
}

function getVisibility(element: Element): ElementVisibility {
    if (!element.isConnected) return 'not-rendered';

    if (element.closest('[hidden], [aria-hidden="true"], [inert]')) {
        return 'hidden';
    }

    const view = element.ownerDocument.defaultView;

    if (!view) return 'unknown';

    const style = view.getComputedStyle(element);

    if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse'
    ) {
        return 'hidden';
    }

    if (element.getClientRects().length === 0) {
        return 'hidden';
    }

    return 'visible';
}

function captureAttributes(element: Element): Record<string, string> {
    const result: Record<string, string> = {};

    for (const name of CAPTURED_ATTRIBUTES) {
        const value = getAttribute(element, name);

        if (value !== undefined) {
            result[name] = value;
        }
    }

    return result;
}

function getFingerprint(
    element: Element,
    labels: ElementLabels,
    groupPath: string[],
): ElementFingerprint {
    return {
        tagName: element.tagName.toUpperCase(),
        ...(getAttribute(element, 'id')
            ? { id: getAttribute(element, 'id') }
            : {}),
        ...(getAttribute(element, 'name')
            ? { name: getAttribute(element, 'name') }
            : {}),
        ...(getAttribute(element, 'type')
            ? { inputType: getAttribute(element, 'type') }
            : {}),
        ...(getAttribute(element, 'role')
            ? { role: getAttribute(element, 'role') }
            : {}),
        ...(getAttribute(element, 'value')
            ? { value: getAttribute(element, 'value') }
            : {}),
        ...(getAttribute(element, 'placeholder')
            ? { placeholder: getAttribute(element, 'placeholder') }
            : {}),
        ...(getAttribute(element, 'aria-label')
            ? { ariaLabel: getAttribute(element, 'aria-label') }
            : {}),
        ...(getAttribute(element, 'aria-labelledby')
            ? { ariaLabelledBy: getAttribute(element, 'aria-labelledby') }
            : {}),
        labels,
        groupPath,
        attributes: captureAttributes(element),
    };
}

function candidate(
    strategy: LocatorCandidate['strategy'],
    value: string,
): LocatorCandidate {
    return { strategy, value };
}

function getLocatorCandidates(
    element: Element,
    labels: ElementLabels,
): LocatorCandidate[] {
    const result: LocatorCandidate[] = [];

    const testId = getAttribute(element, 'data-testid');
    const id = getAttribute(element, 'id');
    const name = getAttribute(element, 'name');
    const placeholder = getAttribute(element, 'placeholder');

    if (testId) result.push(candidate('testId', testId));
    if (id) result.push(candidate('id', id));

    if (labels.direct) {
        result.push(candidate('label', labels.direct));
    }

    if (labels.accessible) {
        result.push(candidate('label', labels.accessible));
    }

    if (name) result.push(candidate('name', name));
    if (placeholder) result.push(candidate('placeholder', placeholder));

    return result;
}

function getInitialLocators(
    element: Element,
    labels: ElementLabels,
): LocatorDefinition {
    const candidates = getLocatorCandidates(element, labels);

    // Phase 3 will validate uniqueness and rank these candidates.
    // This fallback is provisional and must not be emitted as final.
    const primary = candidates[0] ?? candidate(
        'css',
        element.tagName.toLowerCase(),
    );

    return {
        primary,
        fallbacks: candidates.slice(1),
    };
}

function toSuggestedName(
    element: Element,
    labels: ElementLabels,
): string {
    return (
        labels.direct ||
        labels.accessible ||
        labels.parentField ||
        labels.parentGroup ||
        getAttribute(element, 'placeholder') ||
        getAttribute(element, 'name') ||
        getAttribute(element, 'id') ||
        element.tagName.toLowerCase()
    );
}

export function normalizeElement(
    element: Element,
    options: NormalizeElementOptions,
): ScannedElement {
    const groups = options.groups ?? [];
    const nearest = findNearestGroup(element, groups);
    const groupPath = getGroupPath(nearest, groups);

    const labels = collectLabels(element, nearest?.name);

    return {
        temporaryId: options.temporaryId,
        kind: classifyElement(element),
        suggestedName: toSuggestedName(element, labels),
        fingerprint: getFingerprint(element, labels, groupPath),
        locators: getInitialLocators(element, labels),
        visibility: getVisibility(element),
        ...(nearest ? { groupKey: nearest.key } : {}),
        ...(options.repeatableGroupKey
            ? { repeatableGroupKey: options.repeatableGroupKey }
            : {}),
        ...(options.repeatableInstance !== undefined
            ? { repeatableInstance: options.repeatableInstance }
            : {}),
    };
}
