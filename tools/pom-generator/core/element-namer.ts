
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
    'input', 'field', 'text', 'text field',
    'select', 'dropdown', 'button', 'checkbox',
    'radio', 'yes', 'no', 'month', 'year', 'day',
    'submit', 'element', 'unknown', 'div',
]);

const CONTROL_SUFFIX: Partial<Record<ElementKind, string>> = {
    input: 'Input',
    textarea: 'Textarea',
    date: 'DateInput',
    select: 'Select',
    combobox: 'Combobox',
    checkbox: 'Checkbox',
    radio: 'Radio',
    button: 'Button',
    link: 'Link',
};

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
        .map((part) => part.toLowerCase());
}

function camelCase(value: string): string {
    const parts = words(value);
    if (!parts.length) return 'unnamedElement';

    const result = parts[0] + parts
        .slice(1)
        .map((part) =>
            part[0].toUpperCase() + part.slice(1),
        )
        .join('');

    return /^[a-zA-Z_$]/.test(result)
        ? result
        : `element${result[0].toUpperCase()}${result.slice(1)}`;
}

function normalized(value?: string): string {
    return words(value ?? '').join(' ');
}

function isGeneric(value?: string): boolean {
    const phrase = normalized(value);
    return !phrase || GENERIC_LABELS.has(phrase);
}

function simplify(value?: string): string {
    return (value ?? '')
        .replace(/\binput field\b/gi, '')
        .replace(/\bplease (enter|select|choose)\b/gi, '')
        .replace(/\bdid the\b/gi, '')
        .replace(/\bresult in a\b/gi, '')
        .replace(/[?*:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function endsWith(
    parts: string[],
    suffix: string[],
): boolean {
    return suffix.length <= parts.length &&
        suffix.every(
            (part, index) =>
                parts[parts.length - suffix.length + index] === part,
        );
}

function combine(
    parent?: string,
    child?: string,
): string {
    const a = words(parent ?? '');
    const b = words(child ?? '');

    if (!a.length) return b.join(' ');
    if (!b.length) return a.join(' ');

    if (endsWith(a, b)) return a.join(' ');
    if (endsWith(b, a)) return b.join(' ');

    let overlap = 0;

    for (let size = 1; size <= Math.min(a.length, b.length); size++) {
        if (endsWith(a, b.slice(0, size))) {
            overlap = size;
        }
    }

    return [...a, ...b.slice(overlap)].join(' ');
}

function meaningful(
    ...values: Array<string | undefined>
): string | undefined {
    return values
        .map(simplify)
        .find((value) => !isGeneric(value));
}

function getChoice(element: ScannedElement): string | undefined {
    if (element.kind !== 'radio') return undefined;

    const labels = element.fingerprint.labels;
    const direct = normalized(labels.direct);
    const value = normalized(element.fingerprint.value);

    if (direct === 'yes' || direct === 'no') return direct;
    if (value === 'true' || value === 'yes') return 'yes';
    if (value === 'false' || value === 'no') return 'no';

    return meaningful(labels.direct, element.fingerprint.value);
}

function deriveSemanticName(element: ScannedElement): string {
    const labels = element.fingerprint.labels;

    const direct = simplify(labels.direct);
    const accessible = simplify(labels.accessible);
    const parentField = simplify(labels.parentField);
    const parentGroup = simplify(labels.parentGroup);

    let phrase = meaningful(
        direct,
        accessible,
        parentField,
        element.fingerprint.placeholder,
        element.fingerprint.name,
        element.fingerprint.id,
        element.suggestedName,
    ) ?? '';

    if (
        direct &&
        words(direct).length <= 2 &&
        !isGeneric(parentField) &&
        normalized(parentField) !== normalized(direct)
    ) {
        phrase = combine(parentField, phrase);
    }

    if (
        !isGeneric(parentGroup) &&
        !normalized(phrase).includes(normalized(parentGroup)) &&
        words(parentGroup).length <= 5
    ) {
        phrase = combine(parentGroup, phrase);
    }

    if (!phrase || isGeneric(phrase)) {
        phrase = meaningful(
            parentGroup,
            parentField,
            element.fingerprint.id,
            element.fingerprint.name,
        ) ?? 'unnamed';
    }

    const choice = getChoice(element);

    if (choice && !endsWith(words(phrase), words(choice))) {
        phrase = combine(phrase, choice);
    }

    return camelCase(phrase);
}

function withControlSuffix(
    baseName: string,
    kind: ElementKind,
): string {
    const suffix = CONTROL_SUFFIX[kind];
    if (!suffix) return baseName;

    const suffixWords = words(suffix);
    const nameWords = words(baseName);

    if (endsWith(nameWords, suffixWords)) {
        return baseName;
    }

    // "Date" already describes a date input sufficiently
    // when the full suffix is "DateInput".
    return `${baseName}${suffix}`;
}

function getLogicalIdentity(
    element: ScannedElement,
    semantic: string,
): string {
    if (element.repeatableGroupKey) {
        return [
            'repeatable',
            element.repeatableGroupKey,
            semantic,
            element.kind,
        ].join('|');
    }

    return [
        'single',
        element.groupKey ?? '',
        semantic,
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

    if (matches.length !== 1) return undefined;

    const name = matches[0].name;

    // Don't perpetuate legacy generic names.
    if (isGeneric(name) || /^unnamedElement\d*$/i.test(name)) {
        return undefined;
    }

    return name;
}

function getContextualName(
    element: ScannedElement,
    semantic: string,
): string | undefined {
    const labels = element.fingerprint.labels;

    const context = meaningful(
        labels.parentField,
        labels.parentGroup,
    );

    if (!context) return undefined;

    const contextual = camelCase(combine(context, semantic));

    return contextual !== semantic
        ? contextual
        : undefined;
}

function allocateName(
    preferred: string,
    identity: string,
    element: ScannedElement,
    used: Map<string, string>,
    warnings: string[],
): string {
    if (!used.has(preferred) || used.get(preferred) === identity) {
        return preferred;
    }

    const contextual = getContextualName(element, preferred);

    if (
        contextual &&
        (!used.has(contextual) || used.get(contextual) === identity)
    ) {
        warnings.push(
            `Resolved name collision for "${preferred}" ` +
            `using parent context: "${contextual}".`,
        );
        return contextual;
    }

    let suffix = 2;
    while (used.has(`${preferred}${suffix}`)) {
        suffix++;
    }

    const result = `${preferred}${suffix}`;

    warnings.push(
        `Name collision for "${preferred}"; ` +
        `assigned "${result}".`,
    );

    return result;
}

export function nameElements(
    elements: readonly ScannedElement[],
    existing: readonly StoredElement[] = [],
): ElementNamingResult {
    const warnings: string[] = [];
    const names: NamedElement[] = [];

    const identities = new Map<string, string>();
    const usedNames = new Map<string, string>();

    for (const element of elements) {
        const semantic = withControlSuffix(
            deriveSemanticName(element),
            element.kind,
        );

        const identity = getLogicalIdentity(element, semantic);

        let name = identities.get(identity);

        if (!name) {
            const previous = getExistingName(element, existing);

            name = allocateName(
                previous ?? semantic,
                identity,
                element,
                usedNames,
                warnings,
            );

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
