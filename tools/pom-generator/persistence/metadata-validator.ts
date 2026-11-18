
export interface MetadataValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

type Data = Record<string, unknown>;
type Check = (value: unknown, path: string, errors: string[]) => void;

const strategies = new Set([
    'role', 'label', 'placeholder', 'testId',
    'id', 'name', 'css', 'xpath',
]);
const kinds = new Set([
    'input', 'textarea', 'select', 'checkbox', 'radio',
    'button', 'link', 'combobox', 'date', 'unknown',
]);
const statuses = new Set(['active', 'not-found', 'ambiguous']);
const operations = new Set([
    'fill', 'click', 'check', 'uncheck', 'selectOption', 'press',
]);
const sources = new Set([
    'fieldset-legend', 'accessible-name', 'section-heading',
    'labelled-container', 'structural-pattern', 'unknown',
]);
const labelSources = new Set([
    'direct', 'accessible', 'parent-field', 'parent-group', 'attribute',
]);

function object(value: unknown): value is Data {
    return typeof value === 'object' && value !== null &&
        !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): boolean {
    return value === undefined || nonempty(value);
}

function integer(value: unknown, min = 0): boolean {
    return typeof value === 'number' &&
        Number.isInteger(value) && value >= min;
}

function required(
    value: Data, field: string, path: string, errors: string[],
): void {
    if (!nonempty(value[field])) {
        errors.push(`${path}.${field} must be a nonempty string.`);
    }
}

function optional(
    value: Data, fields: string[], path: string, errors: string[],
): void {
    for (const field of fields) {
        if (!optionalString(value[field])) {
            errors.push(`${path}.${field} must be a nonempty string if set.`);
        }
    }
}

function candidate(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    if (!strategies.has(String(value.strategy))) {
        errors.push(`${path}.strategy is invalid.`);
    }
    required(value, 'value', path, errors);
    optional(value, ['role', 'name', 'scopeGroupKey'], path, errors);
    if (value.exact !== undefined &&
        typeof value.exact !== 'boolean') {
        errors.push(`${path}.exact must be boolean.`);
    }
}

function locators(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    candidate(value.primary, `${path}.primary`, errors);
    if (!Array.isArray(value.fallbacks)) {
        errors.push(`${path}.fallbacks must be an array.`);
        return;
    }
    value.fallbacks.forEach((item: unknown, index: number) =>
        candidate(item, `${path}.fallbacks[${index}]`, errors),
    );
}

function fingerprint(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    required(value, 'tagName', path, errors);
    optional(value, [
        'id', 'name', 'inputType', 'role', 'value', 'placeholder',
        'text', 'ariaLabel', 'ariaLabelledBy',
    ], path, errors);
    if (!object(value.labels)) {
        errors.push(`${path}.labels must be an object.`);
    } else {
        optional(value.labels, [
            'direct', 'accessible', 'parentField',
            'parentGroup', 'labelFor',
        ], `${path}.labels`, errors);
        if (value.labels.source !== undefined &&
            !labelSources.has(String(value.labels.source))) {
            errors.push(`${path}.labels.source is invalid.`);
        }
    }
    if (!Array.isArray(value.groupPath) ||
        !value.groupPath.every(nonempty)) {
        errors.push(`${path}.groupPath must be a string array.`);
    }
    if (value.attributes !== undefined &&
        (!object(value.attributes) ||
            !Object.values(value.attributes).every(
                (item) => typeof item === 'string',
            ))) {
        errors.push(`${path}.attributes must contain strings.`);
    }
}

function element(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    required(value, 'stableKey', path, errors);
    required(value, 'name', path, errors);
    if (!kinds.has(String(value.kind))) {
        errors.push(`${path}.kind is invalid.`);
    }
    if (!statuses.has(String(value.status))) {
        errors.push(`${path}.status is invalid.`);
    }
    optional(value, ['groupKey', 'repeatableGroupKey'], path, errors);
    if (value.indexed !== undefined &&
        typeof value.indexed !== 'boolean') {
        errors.push(`${path}.indexed must be boolean.`);
    }
    fingerprint(value.fingerprint, `${path}.fingerprint`, errors);
    locators(value.locators, `${path}.locators`, errors);
}

function action(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    for (const field of ['stableKey', 'elementKey', 'methodName']) {
        required(value, field, path, errors);
    }
    if (!operations.has(String(value.operation))) {
        errors.push(`${path}.operation is invalid.`);
    }
    if (value.indexed !== undefined &&
        typeof value.indexed !== 'boolean') {
        errors.push(`${path}.indexed must be boolean.`);
    }
}

function group(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    required(value, 'key', path, errors);
    required(value, 'name', path, errors);
    optional(value, ['parentKey'], path, errors);
    if (!sources.has(String(value.source))) {
        errors.push(`${path}.source is invalid.`);
    }
    if (value.locator !== undefined) {
        locators(value.locator, `${path}.locator`, errors);
    }
}

function repeatable(
    value: unknown, path: string, errors: string[],
): void {
    if (!object(value)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    required(value, 'key', path, errors);
    required(value, 'name', path, errors);
    optional(value, ['parentKey'], path, errors);
    locators(value.locator, `${path}.locator`, errors);
    if (!integer(value.instanceCount)) {
        errors.push(`${path}.instanceCount must be nonnegative.`);
    }
    if (value.maxInstances !== undefined &&
        !integer(value.maxInstances, 1)) {
        errors.push(`${path}.maxInstances must be positive.`);
    }
    if (integer(value.instanceCount) &&
        integer(value.maxInstances, 1) &&
        (value.instanceCount as number) >
        (value.maxInstances as number)) {
        errors.push(`${path}.instanceCount exceeds maxInstances.`);
    }
    if (value.selection !== 'stable-attribute' &&
        value.selection !== 'validated-position') {
        errors.push(`${path}.selection is invalid.`);
    }
    if (value.publicIndexBase !== 1) {
        errors.push(`${path}.publicIndexBase must be 1.`);
    }
}

function unique(
    items: Data[], field: string, label: string, errors: string[],
): void {
    const seen = new Set<string>();
    for (const item of items) {
        const key = item[field];
        if (!nonempty(key)) continue;
        if (seen.has(key)) {
            errors.push(`Duplicate ${label} key "${key}".`);
        }
        seen.add(key);
    }
}

export function validateMetadata(
    value: unknown,
): MetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!object(value)) {
        return {
            valid: false,
            errors: ['Metadata must be a JSON object.'],
            warnings,
        };
    }
    if (value.schemaVersion !== 2) {
        errors.push('Metadata schemaVersion must be 2.');
    }
    required(value, 'pageName', 'metadata', errors);

    const validators: Record<string, Check> = {
        elements: element,
        actions: action,
        groups: group,
        repeatableGroups: repeatable,
    };
    const arrays: Record<string, Data[]> = {};

    for (const [field, check] of Object.entries(validators)) {
        const items = value[field];
        if (!Array.isArray(items)) {
            errors.push(`${field} must be an array.`);
            continue;
        }
        items.forEach((item: unknown, index: number) =>
            check(item, `${field}[${index}]`, errors),
        );
        if (items.every(object)) arrays[field] = items;
    }
    if (errors.length) return { valid: false, errors, warnings };

    const elements = arrays.elements;
    const actions = arrays.actions;
    const groups = arrays.groups;
    const repeats = arrays.repeatableGroups;

    unique(elements, 'stableKey', 'element', errors);
    unique(actions, 'stableKey', 'action', errors);
    unique(groups, 'key', 'group', errors);
    unique(repeats, 'key', 'repeatable group', errors);

    const elementKeys = new Set(elements.map((x) => x.stableKey));
    const repeatKeys = new Set(repeats.map((x) => x.key));
    const groupKeys = new Set([
        ...groups.map((x) => x.key),
        ...repeatKeys,
    ]);

    for (const item of actions) {
        if (!elementKeys.has(item.elementKey)) {
            errors.push(`Action "${item.stableKey}" references missing element.`);
        }
    }
    for (const item of elements) {
        if (item.groupKey && !groupKeys.has(item.groupKey)) {
            warnings.push(`Element "${item.stableKey}" has unknown group.`);
        }
        if (item.repeatableGroupKey &&
            !repeatKeys.has(item.repeatableGroupKey)) {
            errors.push(
                `Element "${item.stableKey}" has missing repeatable group.`,
            );
        }
        if (item.indexed && !item.repeatableGroupKey) {
            errors.push(
                `Indexed element "${item.stableKey}" lacks repeatable group.`,
            );
        }
    }
    return { valid: errors.length === 0, errors, warnings };
}
