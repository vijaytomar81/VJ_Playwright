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
export interface NamingConflict {
    temporaryId: string;
    name: string;
    reason: string;
}
export interface ElementNamingResult {
    elements: NamedElement[];
    warnings: string[];
    conflicts: NamingConflict[];
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
        .trim().split(/\s+/).filter(Boolean)
        .map((part) => part.toLowerCase());
}
function camelCase(value: string): string {
    const parts = words(value);
    if (!parts.length) return 'unnamedElement';
    const result = parts[0] + parts.slice(1)
        .map((part) => part[0].toUpperCase() + part.slice(1))
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
        .replace(/\s+/g, ' ').trim();
}
function endsWith(parts: string[], suffix: string[]): boolean {
    return suffix.length <= parts.length &&
        suffix.every((part, index) =>
            parts[parts.length - suffix.length + index] === part,
        );
}
function combine(parent?: string, child?: string): string {
    const a = words(parent ?? '');
    const b = words(child ?? '');
    if (!a.length) return b.join(' ');
    if (!b.length) return a.join(' ');
    if (endsWith(a, b)) return a.join(' ');
    if (endsWith(b, a)) return b.join(' ');
    let overlap = 0;
    for (let size = 1; size <= Math.min(a.length, b.length); size++) {
        if (endsWith(a, b.slice(0, size))) overlap = size;
    }
    return [...a, ...b.slice(overlap)].join(' ');
}
function meaningful(
    ...values: Array<string | undefined>
): string | undefined {
    return values.map(simplify)
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
    const fp = element.fingerprint;
    // Do not prefix parent context unless a collision occurs.
    let phrase = meaningful(
        labels.direct,
        labels.accessible,
        fp.text,
        fp.placeholder,
        fp.name,
        fp.id,
        element.suggestedName,
    ) ?? '';
    if (!phrase || isGeneric(phrase)) {
        phrase = meaningful(
            labels.parentField,
            labels.parentGroup,
            fp.id,
            fp.name,
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
    if (!suffix || endsWith(words(baseName), words(suffix))) {
        return baseName;
    }
    return `${baseName}${suffix}`;
}
function getLogicalIdentity(
    element: ScannedElement,
    semantic: string,
): string {
    if (!element.repeatableGroupKey) {
        return `single|${element.temporaryId}`;
    }
    const fp = element.fingerprint;
    return [
        'repeatable',
        element.repeatableGroupKey,
        semantic,
        element.kind,
        normalized(fp.labels.parentField),
        normalized(fp.labels.direct),
        normalized(fp.labels.accessible),
        normalized(fp.inputType),
        normalized(fp.id).replace(/\b\d+\b/g, '#'),
        normalized(fp.name).replace(/\b\d+\b/g, '#'),
    ].join('|');
}
function getExistingName(
    element: ScannedElement,
    existing: readonly StoredElement[],
): string | undefined {
    const id = element.fingerprint.id;
    if (!id) return undefined;
    const matches = existing.filter((stored) =>
        stored.fingerprint.id === id &&
        stored.kind === element.kind,
    );
    if (matches.length !== 1) return undefined;
    const name = matches[0].name;
    if (isGeneric(name) || /^unnamedElement\d*$/i.test(name)) {
        return undefined;
    }
    return name;
}
function getContextualNames(
    element: ScannedElement,
    semantic: string,
): string[] {
    const labels = element.fingerprint.labels;
    const result: string[] = [];
    for (const context of [
        labels.parentField,
        labels.parentGroup,
    ]) {
        if (isGeneric(context)) continue;
        const candidate = withControlSuffix(
            camelCase(combine(context, semantic)),
            element.kind,
        );
        if (candidate !== semantic && !result.includes(candidate)) {
            result.push(candidate);
        }
    }
    return result;
}
interface LogicalEntry {
    identity: string;
    element: ScannedElement;
    baseName: string;
    name: string;
    members: ScannedElement[];
}
function groupByName(
    entries: readonly LogicalEntry[],
): Map<string, LogicalEntry[]> {
    const groups = new Map<string, LogicalEntry[]>();
    for (const entry of entries) {
        const group = groups.get(entry.name) ?? [];
        group.push(entry);
        groups.set(entry.name, group);
    }
    return groups;
}
function resolveCollisions(
    entries: LogicalEntry[],
    warnings: string[],
): void {
    // Multiple rounds allow collisions introduced by context
    // to be resolved without depending on DOM scan order.
    for (let round = 0; round < entries.length; round++) {
        const groups = groupByName(entries);
        let changed = false;
        for (const [name, group] of groups) {
            if (group.length < 2) continue;
            const occupied = new Set(
                entries.filter((entry) => !group.includes(entry))
                    .map((entry) => entry.name),
            );
            // A context candidate must distinguish one logical
            // element from all other elements in this collision.
            const proposals = group.map((entry) => ({
                entry,
                candidates: getContextualNames(
                    entry.element, entry.baseName,
                ),
            }));
            for (const proposal of proposals) {
                const candidate = proposal.candidates.find((value) =>
                    !occupied.has(value) &&
                    proposals.filter((other) =>
                        other.candidates.includes(value),
                    ).length === 1,
                );
                if (!candidate) continue;
                proposal.entry.name = candidate;
                changed = true;
                warnings.push(
                    `Resolved name collision for "${name}" ` +
                    `using parent context: "${candidate}".`,
                );
            }
        }
        if (!changed) break;
    }
}
export function nameElements(
    elements: readonly ScannedElement[],
    existing: readonly StoredElement[] = [],
): ElementNamingResult {
    const warnings: string[] = [];
    const conflicts: NamingConflict[] = [];
    const entries: LogicalEntry[] = [];
    const byIdentity = new Map<string, LogicalEntry>();
    for (const element of elements) {
        const semantic = withControlSuffix(
            deriveSemanticName(element), element.kind,
        );
        const identity = getLogicalIdentity(element, semantic);
        // Only genuine repeatable members share an identity.
        const repeatable = element.repeatableGroupKey
            ? byIdentity.get(identity)
            : undefined;
        if (repeatable) {
            repeatable.members.push(element);
            continue;
        }
        const entry: LogicalEntry = {
            identity,
            element,
            baseName: semantic,
            name: getExistingName(element, existing) ?? semantic,
            members: [element],
        };
        entries.push(entry);
        byIdentity.set(identity, entry);
    }
    resolveCollisions(entries, warnings);
    for (const [name, group] of groupByName(entries)) {
        if (group.length < 2) continue;
        const reason =
            `Naming collision for "${name}": ` +
            `${group.length} distinct logical elements remain ` +
            `indistinguishable after parent-context resolution. ` +
            `Manual review required; no numeric suffix assigned.`;
        warnings.push(reason);
        for (const entry of group) {
            for (const member of entry.members) {
                conflicts.push({
                    temporaryId: member.temporaryId,
                    name,
                    reason,
                });
            }
        }
    }
    const namedById = new Map<string, NamedElement>();
    for (const entry of entries) {
        for (const member of entry.members) {
            namedById.set(member.temporaryId, {
                temporaryId: member.temporaryId,
                name: entry.name,
                baseName: entry.baseName,
                ...(member.repeatableGroupKey
                    ? { repeatableGroupKey: member.repeatableGroupKey }
                    : {}),
            });
        }
    }
    return {
        elements: elements.map((element) => {
            const named = namedById.get(element.temporaryId);
            if (!named) {
                throw new Error(
                    `Missing name for ${element.temporaryId}`,
                );
            }
            return named;
        }),
        warnings,
        conflicts,
    };
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
