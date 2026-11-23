import type {
    ElementGroup,
    LocatorDefinition,
} from '../models/generator.types';
import type { DetectedGroup } from './group-detector';

export interface RadioGroupValidationResult {
    groups: ElementGroup[];
    warnings: string[];
}

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function referencedName(element: Element): string {
    const ids = clean(element.getAttribute('aria-labelledby'))
        .split(/\s+/)
        .filter(Boolean);

    if (!ids.length) return '';

    const parts: string[] = [];

    for (const id of ids) {
        const referenced = element.ownerDocument.getElementById(id);
        if (!referenced) return '';

        const text = clean(referenced.textContent);
        if (!text) return '';

        parts.push(text);
    }

    return parts.join(' ');
}

function groupName(element: Element): string {
    return (
        referencedName(element) ||
        clean(element.getAttribute('aria-label'))
    );
}

function radioName(element: Element): string {
    const referenced = referencedName(element);
    if (referenced) return referenced;

    const ariaLabel = clean(element.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;

    if (element instanceof HTMLInputElement) {
        const labels = Array.from(element.labels ?? [])
            .map((label) => clean(label.textContent))
            .filter(Boolean);

        return labels.join(' ');
    }

    return clean(element.textContent);
}

function isRadio(element: Element): boolean {
    return (
        element.getAttribute('role') === 'radio' ||
        (
            element instanceof HTMLInputElement &&
            element.type === 'radio'
        )
    );
}

function validateOptions(
    element: Element,
): string | undefined {
    const radios = Array.from(
        element.querySelectorAll('input[type="radio"], [role="radio"]'),
    ).filter(isRadio);

    if (!radios.length) {
        return 'Group contains no radio options.';
    }

    const names = new Set<string>();

    for (const radio of radios) {
        const name = radioName(radio);
        const normalized = name.toLowerCase();

        if (!name) {
            return 'A radio option has no accessible name.';
        }

        if (names.has(normalized)) {
            return `Duplicate radio option name "${name}".`;
        }

        names.add(normalized);
    }

    return undefined;
}

function validateGroup(
    group: DetectedGroup,
    root: ParentNode,
): { locator?: LocatorDefinition; reason?: string } {
    const element = group.element;
    const role = element.getAttribute('role');

    if (role !== 'group' && role !== 'radiogroup') {
        return { reason: 'Not an explicit ARIA radio group.' };
    }

    const name = groupName(element);

    if (!name) {
        return { reason: 'Group has no explicit accessible name.' };
    }

    if (name !== group.name) {
        return { reason: 'Detected group name differs from ARIA name.' };
    }

    const matching = Array.from(
        root.querySelectorAll('[role="group"], [role="radiogroup"]'),
    ).filter((candidate) =>
        candidate.getAttribute('role') === role &&
        groupName(candidate) === name
    );

    if (matching.length !== 1 || matching[0] !== element) {
        return {
            reason: `Group role/name matches ${matching.length} elements.`,
        };
    }

    const optionError = validateOptions(element);

    if (optionError) {
        return { reason: optionError };
    }

    return {
        locator: {
            primary: {
                strategy: 'role',
                value: role,
                role,
                name,
                exact: true,
            },
            fallbacks: [],
        },
    };
}

export function validateRadioGroups(
    detected: readonly DetectedGroup[],
    root: ParentNode,
): RadioGroupValidationResult {
    const groups: ElementGroup[] = [];
    const warnings: string[] = [];

    for (const group of detected) {
        const element = group.element;

        const base: ElementGroup = {
            key: group.key,
            name: group.name,
            source: group.source,
            ...(group.parentKey
                ? { parentKey: group.parentKey }
                : {}),
        };

        const containsRadio = Boolean(
            element.querySelector('input[type="radio"], [role="radio"]'),
        );

        if (!containsRadio) {
            groups.push(base);
            continue;
        }

        const result = validateGroup(group, root);

        if (result.locator) {
            groups.push({
                ...base,
                locator: result.locator,
            });
        } else {
            groups.push(base);

            // Nested structural containers are expected to lack
            // an explicit ARIA role; avoid noisy warnings for them.
            if (
                element.getAttribute('role') === 'group' ||
                element.getAttribute('role') === 'radiogroup'
            ) {
                warnings.push(
                    `Radio group "${group.name}" was not validated: ` +
                    (result.reason ?? 'Unknown reason.'),
                );
            }
        }
    }

    return { groups, warnings };
}
