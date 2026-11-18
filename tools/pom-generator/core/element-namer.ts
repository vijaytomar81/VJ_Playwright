
import type {
    ElementKind,
    ScannedElement,
    StoredElement,
} from '../models/generator.types';

export interface NamedElement {
    temporaryId: string;
    name: string;
    baseName: string;
    repeatableGroupKey?: string;
}

export interface ElementNamingResult {
    elements: NamedElement[];
    warnings: string[];
}

const GENERIC_LABELS = new Set([
    'input',
    'field',
    'text',
    'text field',
    'select',
    'dropdown',
    'button',
    'checkbox',
    'radio',
    'yes',
    'no',
    'month',
    'year',
    'day',
]);

function words(value: string): string[] {
    return value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.toLowerCase());
}

function camelCase(value: string): string {
    const parts = words(value);

    if (parts.length === 0) return 'unnamedElement';

    const result = parts[0] + parts
        .slice(1)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');

    return /^[a-zA-Z_$]/.test(result)
        ? result
        : `element${result[0].toUpperCase()}${result.slice(1)}`;
}

function normalizePhrase(value: string | undefined): string {
    return words(value ?? '').join(' ');
}

function isGeneric(value: string | undefined): boolean {
    const normalized = normalizePhrase(value);
    return !normalized || GENERIC_LABELS.has(normalized);
}

function endsWithWords(
    phrase: string[],
    suffix: string[],
): boolean {
    if (suffix.length > phrase.length) return false;

    return suffix.every(
        (word, index) =>
            phrase[phrase.length - suffix.length + index] === word,
    );
}

function combineContext(
    parent: string | undefined,
    child: string | undefined,
): string {
    const parentWords = words(parent ?? '');
    const childWords = words(child ?? '');

    if (parentWords.length === 0) {
        return childWords.join(' ');
    }

    if (childWords.length === 0) {
        return parentWords.join(' ');
    }

    if (endsWithWords(parentWords, childWords)) {
        return parentWords.join(' ');
    }

    if (endsWithWords(childWords, parentWords)) {
        return childWords.join(' ');
    }

    // Remove the largest repeated boundary.
    let overlap = 0;

    for (
        let size = 1;
        size <= Math.min(parentWords.length, childWords.length);
        size++
    ) {
        if (
            endsWithWords(
                parentWords,
                childWords.slice(0, size),
            )
        ) {
            overlap = size;
        }
    }

    return [
        ...parentWords,
        ...childWords.slice(overlap),
    ].join(' ');
}

function simplifyLabel(value: string): string {
    return value
        .replace(/\binput field\b/gi, '')
        .replace(/\bplease (enter|select|choose)\b/gi, '')
        .replace(/\bdid the\b/gi, '')
        .replace(/\bresult in a\b/gi, '')
        .replace(/[?*:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function deriveSemanticName(
    element: ScannedElement,
): string {
    const labels = element.fingerprint.labels;

    const direct = simplifyLabel(labels.direct ?? '');
    const accessible = simplifyLabel(labels.accessible ?? '');
    const parentField = simplifyLabel(labels.parentField ?? '');
    const parentGroup = simplifyLabel(labels.parentGroup ?? '');

    let name = '';

    if (direct && !isGeneric(direct)) {
        name = direct;
    } else if (direct && parentField) {
        name = combineContext(parentField, direct);
    } else if (accessible && !isGeneric(accessible)) {
        name = accessible;
    } else if (parentField) {
        name = parentField;
    } else if (parentGroup) {
        name = parentGroup;
    } else {
        name =
            element.fingerprint.placeholder ??
            element.fingerprint.name ??
            element.fingerprint.id ??
            element.suggestedName;
    }

    // Parent field context is valuable for short labels.
    if (
        direct &&
        words(direct).length <= 2 &&
        parentField &&
        normalizePhrase(parentField) !== normalizePhrase(direct)
    ) {
        name = combineContext(parentField, direct);
    }

    // Add group context when it provides new information.
    if (
        parentGroup &&
        !normalizePhrase(name).includes(normalizePhrase(parentGroup))
    ) {
        const context = words(parentGroup);

        if (context.length <= 5 && !isGeneric(parentGroup)) {
            name = combineContext(parentGroup, name);
        }
    }

    return camelCase(name);
}

function appendControlMeaning(
    baseName: string,
    element: ScannedElement,
): string {
    if (element.kind !== 'radio') {
        return baseName;
    }

    const value = element.fingerprint.value?.toLowerCase();
    const direct = element.fingerprint.labels.direct?.toLowerCase();

    const choice =
        direct === 'yes' || direct === 'no'
            ? direct
            : value === 'true'
                ? 'yes'
                : value === 'false'
                    ? 'no'
                    : undefined;

    if (!choice) return baseName;

    const suffix = choice[0].toUpperCase() + choice.slice(1);

    return baseName.endsWith(suffix)
        ? baseName
        : `${baseName}${suffix}`;
}

function getLogicalIdentity(
    element: ScannedElement,
    baseName: string,
): string {
    const repeatable = element.repeatableGroupKey;

    if (repeatable) {
        return [
            'repeatable',
            repeatable,
            baseName,
            element.kind,
        ].join('|');
    }

    return [
        'single',
        element.groupKey ?? '',
        baseName,
        element.kind,
    ].join('|');
}

function getExistingName(
    element: ScannedElement,
    existing: readonly StoredElement[],
): string | undefined {
    const id = element.fingerprint.id;

    if (!id) return undefined;

    const matches = existing.filter(
        (stored) =>
            stored.fingerprint.id === id &&
            stored.kind === element.kind,
    );

    return matches.length === 1
        ? matches[0].name
        : undefined;
}

export function nameElements(
    elements: readonly ScannedElement[],
    existing: readonly StoredElement[] = [],
): ElementNamingResult {
    const warnings: string[] = [];
    const names: NamedElement[] = [];

    const identities = new Map<string, string>();
    const usedNames = new Map<string, string>();
    const counters = new Map<string, number>();

    for (const element of elements) {
        const semantic = appendControlMeaning(
            deriveSemanticName(element),
            element,
        );

        const identity = getLogicalIdentity(element, semantic);

        let name = identities.get(identity);

        if (!name) {
            name = getExistingName(element, existing) ?? semantic;

            const claimedBy = usedNames.get(name);

            if (claimedBy && claimedBy !== identity) {
                const next = (counters.get(name) ?? 1) + 1;
                counters.set(name, next);

                warnings.push(
                    `Name collision for "${name}"; ` +
                    `assigned suffix ${next}.`,
                );

                name = `${name}${next}`;
            }

            identities.set(identity, name);
            usedNames.set(name, identity);
        }

        names.push({
            temporaryId: element.temporaryId,
            name,
            baseName: semantic,
            ...(element.repeatableGroupKey
                ? { repeatableGroupKey: element.repeatableGroupKey }
                : {}),
        });
    }

    return { elements: names, warnings };
}

export function actionStem(
    kind: ElementKind,
    elementName: string,
): string {
    const capitalized =
        elementName[0].toUpperCase() + elementName.slice(1);

    switch (kind) {
        case 'input':
        case 'textarea':
        case 'date':
            return `enter${capitalized}`;

        case 'select':
        case 'combobox':
            return `select${capitalized}`;

        case 'checkbox':
        case 'radio':
            return `choose${capitalized}`;

        case 'button':
        case 'link':
            return `click${capitalized}`;

        default:
            return `interactWith${capitalized}`;
    }
}
