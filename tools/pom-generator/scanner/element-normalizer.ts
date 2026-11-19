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
    'id', 'name', 'type', 'role', 'value',
    'placeholder', 'aria-label', 'aria-labelledby',
    'aria-describedby', 'aria-autocomplete',
    'aria-haspopup', 'data-testid', 'data-test',
    'data-cy', 'maxlength',
] as const;
const FIELD_SELECTOR = [
    '.form-group',
    '.input-group',
    'fieldset',
    '[role="group"]',
    '[role="radiogroup"]',
].join(', ');
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}
function getAttribute(
    element: Element,
    name: string,
): string | undefined {
    return clean(element.getAttribute(name)) || undefined;
}
function getReferencedText(
    element: Element,
    attribute: string,
): string | undefined {
    const ids = (getAttribute(element, attribute) ?? '')
        .split(/\s+/)
        .filter(Boolean);
    const texts = ids
        .map((id) => element.ownerDocument.getElementById(id))
        .filter((node): node is HTMLElement =>
            node instanceof HTMLElement,
        )
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
    const label = labels.find((candidate) =>
        candidate.control === element ||
        candidate.contains(element),
    );
    return {
        text: label ? clean(label.textContent) : undefined,
        labelFor: label?.getAttribute('for') || undefined,
    };
}
function getDirectChildText(
    parent: Element,
    selector: string,
): string | undefined {
    for (const child of Array.from(parent.children)) {
        if (child.matches(selector)) {
            const value = clean(child.textContent);
            if (value) return value;
        }
    }
    return undefined;
}
function getContainerLabel(
    container: Element,
): string | undefined {
    const referenced = getReferencedText(
        container,
        'aria-labelledby',
    );
    if (referenced) return referenced;
    const ariaLabel = getAttribute(container, 'aria-label');
    if (ariaLabel) return ariaLabel;
    const legend = getDirectChildText(container, 'legend');
    if (legend) return legend;
    const label = getDirectChildText(container, 'label');
    if (label) return label;
    return getDirectChildText(
        container,
        HEADING_SELECTOR,
    );
}
function getParentFieldLabel(
    element: Element,
): string | undefined {
    let parent = element.parentElement;
    while (parent) {
        if (parent.matches(FIELD_SELECTOR)) {
            const label = getContainerLabel(parent);
            if (label) return label;
        }
        // A generic div can carry meaningful field context
        // when explicitly named or directly labelled.
        if (parent.matches('div')) {
            const labelledBy = getReferencedText(
                parent,
                'aria-labelledby',
            );
            const ariaLabel = getAttribute(
                parent,
                'aria-label',
            );
            if (labelledBy || ariaLabel) {
                return labelledBy || ariaLabel;
            }
            if (
                parent.matches(
                    '[class*="field"], [class*="form-control"]',
                )
            ) {
                const label = getDirectChildText(
                    parent,
                    'label',
                );
                if (label) return label;
            }
        }
        parent = parent.parentElement;
    }
    return undefined;
}
function getParentContext(
    element: Element,
): string | undefined {
    let parent = element.parentElement;
    while (parent) {
        if (
            parent.matches(
                'form, section, fieldset, [role="region"], ' +
                '[role="group"], div[aria-label], ' +
                'div[aria-labelledby]',
            )
        ) {
            const label = getContainerLabel(parent);
            if (label) return label;
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
    const accessible =
        getReferencedText(element, 'aria-labelledby') ||
        getAttribute(element, 'aria-label');
    const parentField = getParentFieldLabel(element);
    const group = parentGroup || getParentContext(element);
    const source: ElementLabels['source'] =
        direct.text
            ? 'direct'
            : accessible
                ? 'accessible'
                : parentField
                    ? 'parent-field'
                    : group
                        ? 'parent-group'
                        : 'attribute';
    return {
        ...(direct.text ? { direct: direct.text } : {}),
        ...(direct.labelFor
            ? { labelFor: direct.labelFor }
            : {}),
        ...(accessible ? { accessible } : {}),
        ...(parentField ? { parentField } : {}),
        ...(group ? { parentGroup: group } : {}),
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
    if (
        element.closest(
            '[hidden], [aria-hidden="true"], [inert]',
        )
    ) {
        return 'hidden';
    }
    const view = element.ownerDocument.defaultView;
    if (!view) return 'unknown';
    const style = view.getComputedStyle(element);
    if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        element.getClientRects().length === 0
    ) {
        return 'hidden';
    }
    return 'visible';
}
function captureAttributes(
    element: Element,
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const name of CAPTURED_ATTRIBUTES) {
        const value = getAttribute(element, name);
        if (value !== undefined) result[name] = value;
    }
    return result;
}
function getFingerprint(
    element: Element,
    labels: ElementLabels,
    groupPath: string[],
): ElementFingerprint {
    const attributes = captureAttributes(element);
    return {
        tagName: element.tagName.toUpperCase(),
        ...(attributes.id ? { id: attributes.id } : {}),
        ...(attributes.name ? { name: attributes.name } : {}),
        ...(attributes.type
            ? { inputType: attributes.type }
            : {}),
        ...(attributes.role ? { role: attributes.role } : {}),
        ...(attributes.value ? { value: attributes.value } : {}),
        ...(attributes.placeholder
            ? { placeholder: attributes.placeholder }
            : {}),
        ...(attributes['aria-label']
            ? { ariaLabel: attributes['aria-label'] }
            : {}),
        ...(attributes['aria-labelledby']
            ? { ariaLabelledBy: attributes['aria-labelledby'] }
            : {}),
        labels,
        groupPath,
        attributes,
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
    if (
        labels.accessible &&
        labels.accessible !== labels.direct
    ) {
        result.push(candidate('label', labels.accessible));
    }
    if (name) result.push(candidate('name', name));
    if (placeholder) {
        result.push(candidate('placeholder', placeholder));
    }
    return result;
}
function getInitialLocators(
    element: Element,
    labels: ElementLabels,
): LocatorDefinition {
    const candidates = getLocatorCandidates(element, labels);
    // Provisional only. The locator validator must
    // reject any non-unique generic CSS fallback.
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
    const type = getAttribute(element, 'type');
    return (
        labels.direct ||
        labels.accessible ||
        labels.parentField ||
        labels.parentGroup ||
        getAttribute(element, 'placeholder') ||
        getAttribute(element, 'name') ||
        getAttribute(element, 'id') ||
        (type === 'submit' ? 'submit' : '') ||
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
    const labels = collectLabels(
        element,
        nearest?.name,
    );
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
