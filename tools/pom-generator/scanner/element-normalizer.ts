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
import { resolveQuestionLabel } from './question-label-resolver';
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
    '.form-group', '.input-group', 'fieldset',
    '[role="group"]', '[role="radiogroup"]',
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
    return (
        getReferencedText(container, 'aria-labelledby') ||
        getAttribute(container, 'aria-label') ||
        getDirectChildText(container, 'legend') ||
        getDirectChildText(container, 'label') ||
        getDirectChildText(container, HEADING_SELECTOR)
    );
}

function getParentContext(
    element: Element,
): string | undefined {
    let parent = element.parentElement;
    while (parent) {
        if (parent.matches(
            'form, section, fieldset, [role="dialog"], ' +
            '[role="region"], [role="group"], ' +
            '[aria-label], [aria-labelledby]',
        )) {
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
    const parentField = resolveQuestionLabel(element)?.label;
    const group = parentGroup || getParentContext(element);
    const source: ElementLabels['source'] =
        direct.text ? 'direct' :
            accessible ? 'accessible' :
                parentField ? 'parent-field' :
                    group ? 'parent-group' : 'attribute';
    return {
        ...(direct.text ? { direct: direct.text } : {}),
        ...(direct.labelFor ? { labelFor: direct.labelFor } : {}),
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
    const view = element.ownerDocument.defaultView;
    if (!view) return 'unknown';
    let current: Element | null = element;
    while (current) {
        if (
            current.hasAttribute('hidden') ||
            current.hasAttribute('inert') ||
            current.getAttribute('aria-hidden') === 'true'
        ) {
            return 'hidden';
        }
        const style = view.getComputedStyle(current);
        if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.visibility === 'collapse'
        ) {
            return 'hidden';
        }
        current = current.parentElement;
    }
    return element.getClientRects().length === 0
        ? 'hidden'
        : 'visible';
}
function getOwnText(
    element: Element,
    kind: ElementKind,
): string | undefined {
    if (kind !== 'button' && kind !== 'link') {
        return undefined;
    }
    // Exclude text inside hidden or decorative descendants.
    const view = element.ownerDocument.defaultView;
    if (!view) return undefined;
    const parts: string[] = [];
    function visit(node: Node): void {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = clean(node.textContent);
            if (text) parts.push(text);
            return;
        }
        if (!(node instanceof Element)) return;
        if (node !== element) {
            if (
                node.matches(
                    '[hidden], [aria-hidden="true"], ' +
                    '[inert], svg, script, style',
                )
            ) {
                return;
            }
            const style = view!.getComputedStyle(node);
            if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.visibility === 'collapse'
            ) {
                return;
            }
        }
        for (const child of Array.from(node.childNodes)) {
            visit(child);
        }
    }
    visit(element);
    const text = clean(parts.join(' '));
    return text && text.length <= 160 ? text : undefined;
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
    ownText?: string,
): ElementFingerprint {
    const attributes = captureAttributes(element);
    return {
        tagName: element.tagName.toUpperCase(),
        ...(attributes.id ? { id: attributes.id } : {}),
        ...(attributes.name ? { name: attributes.name } : {}),
        ...(attributes.type
            ? { inputType: attributes.type } : {}),
        ...(attributes.role ? { role: attributes.role } : {}),
        ...(attributes.value ? { value: attributes.value } : {}),
        ...(attributes.placeholder
            ? { placeholder: attributes.placeholder } : {}),
        ...(ownText ? { text: ownText } : {}),
        ...(attributes['aria-label']
            ? { ariaLabel: attributes['aria-label'] } : {}),
        ...(attributes['aria-labelledby']
            ? { ariaLabelledBy: attributes['aria-labelledby'] } : {}),
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
    const primary = candidates[0] ?? candidate(
        'css', element.tagName.toLowerCase(),
    );
    return {
        primary,
        fallbacks: candidates.slice(1),
    };
}
function toSuggestedName(
    element: Element,
    labels: ElementLabels,
    ownText?: string,
): string {
    const type = getAttribute(element, 'type');
    return (
        labels.direct ||
        labels.accessible ||
        ownText ||
        getAttribute(element, 'placeholder') ||
        getAttribute(element, 'name') ||
        getAttribute(element, 'id') ||
        labels.parentField ||
        labels.parentGroup ||
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
    const labels = collectLabels(element, nearest?.name);
    const kind = classifyElement(element);
    const ownText = getOwnText(element, kind);
    return {
        temporaryId: options.temporaryId,
        kind,
        suggestedName: toSuggestedName(element, labels, ownText),
        fingerprint: getFingerprint(
            element, labels, groupPath, ownText,
        ),
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
