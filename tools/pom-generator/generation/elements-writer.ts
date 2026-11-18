
import type {
    ElementGroup,
    LocatorCandidate,
    LocatorDefinition,
    PageMetadata,
    RepeatableGroup,
} from '../models/generator.types';

export interface ElementsWriterOptions {
    typesImportPath?: string;
    includeInactive?: boolean;
}

export interface ElementsWriterResult {
    fileName: string;
    content: string;
    elementCount: number;
    groupCount: number;
    repeatableGroupCount: number;
    warnings: string[];
}

interface LocatorEntry {
    key: string;
    definition: LocatorDefinition;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function quote(value: string): string {
    return JSON.stringify(value);
}

function validateImportPath(value: string): string {
    if (!value.startsWith('.') || /[\r\n'"\\]/.test(value)) {
        throw new Error(`Invalid relative import path: ${value}`);
    }
    return value;
}

function validLocator(
    definition: LocatorDefinition | undefined,
): definition is LocatorDefinition {
    return Boolean(
        definition?.primary?.strategy &&
        definition.primary.value &&
        Array.isArray(definition.fallbacks),
    );
}

function renderCandidate(
    candidate: LocatorCandidate,
    indent: string,
): string {
    const fields = [
        `strategy: ${quote(candidate.strategy)}`,
        `value: ${quote(candidate.value)}`,
    ];

    if (candidate.role !== undefined) {
        fields.push(`role: ${quote(candidate.role)}`);
    }
    if (candidate.name !== undefined) {
        fields.push(`name: ${quote(candidate.name)}`);
    }
    if (candidate.exact !== undefined) {
        fields.push(`exact: ${candidate.exact}`);
    }
    if (candidate.scopeGroupKey !== undefined) {
        fields.push(
            `scopeGroupKey: ${quote(candidate.scopeGroupKey)}`,
        );
    }

    return [
        `${indent}{`,
        ...fields.map((field) => `${indent}  ${field},`),
        `${indent}}`,
    ].join('\n');
}

function renderDefinition(
    definition: LocatorDefinition,
    indent: string,
): string {
    const primary = renderCandidate(
        definition.primary,
        `${indent}  `,
    );

    const fallbacks = definition.fallbacks.map((candidate) =>
        renderCandidate(candidate, `${indent}    `) + ',',
    );

    return [
        `${indent}{`,
        `${indent}  primary: ${primary.trimStart()},`,
        `${indent}  fallbacks: [`,
        ...fallbacks,
        `${indent}  ],`,
        `${indent}}`,
    ].join('\n');
}

function renderRecord(entries: readonly LocatorEntry[]): string {
    return [
        '{',
        ...entries.map(({ key, definition }) => {
            const body = renderDefinition(definition, '    ');
            return `  ${quote(key)}: ${body.trimStart()},`;
        }),
        '}',
    ].join('\n');
}

function renderGroupMap(entries: readonly LocatorEntry[]): string {
    return [
        'new Map<string, LocatorDefinition>([',
        ...entries.map(({ key, definition }) => {
            const body = renderDefinition(definition, '      ');
            return [
                `  [${quote(key)},`,
                `${body},`,
                '  ],',
            ].join('\n');
        }),
        '])',
    ].join('\n');
}

function collectElements(
    metadata: PageMetadata,
    includeInactive: boolean,
    warnings: string[],
): LocatorEntry[] {
    const entries: LocatorEntry[] = [];
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    for (const element of metadata.elements) {
        if (!includeInactive && element.status !== 'active') {
            continue;
        }

        if (seenIds.has(element.stableKey)) {
            throw new Error(
                `Duplicate stable element ID: ${element.stableKey}`,
            );
        }
        seenIds.add(element.stableKey);

        if (
            !IDENTIFIER.test(element.name) ||
            element.name === '__proto__'
        ) {
            throw new Error(
                `Invalid element name for ${element.stableKey}: ` +
                element.name,
            );
        }

        if (seenNames.has(element.name)) {
            throw new Error(
                `Duplicate generated element name: ${element.name}`,
            );
        }
        seenNames.add(element.name);

        if (!validLocator(element.locators)) {
            warnings.push(
                `Element "${element.name}" has invalid locators.`,
            );
            continue;
        }

        entries.push({
            key: element.name,
            definition: element.locators,
        });
    }

    return entries;
}

function collectGroups(
    groups: readonly ElementGroup[],
    warnings: string[],
): LocatorEntry[] {
    const entries: LocatorEntry[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
        if (!group.locator) continue;

        if (seen.has(group.key)) {
            warnings.push(`Duplicate group key "${group.key}".`);
            continue;
        }

        if (!validLocator(group.locator)) {
            warnings.push(
                `Group "${group.key}" has invalid locators.`,
            );
            continue;
        }

        seen.add(group.key);
        entries.push({
            key: group.key,
            definition: group.locator,
        });
    }

    return entries;
}

function collectRepeatables(
    groups: readonly RepeatableGroup[],
    warnings: string[],
): RepeatableGroup[] {
    const entries: RepeatableGroup[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
        if (seen.has(group.key)) {
            warnings.push(
                `Duplicate repeatable group key "${group.key}".`,
            );
            continue;
        }

        if (!validLocator(group.locator)) {
            warnings.push(
                `Repeatable group "${group.key}" has invalid locators.`,
            );
            continue;
        }

        seen.add(group.key);
        entries.push(group);
    }

    return entries;
}

function renderRepeatable(group: RepeatableGroup): string {
    const locator = renderDefinition(group.locator, '      ');
    const fields = [
        `key: ${quote(group.key)}`,
        `name: ${quote(group.name)}`,
        ...(group.parentKey
            ? [`parentKey: ${quote(group.parentKey)}`]
            : []),
        `instanceCount: ${group.instanceCount}`,
        ...(group.maxInstances !== undefined
            ? [`maxInstances: ${group.maxInstances}`]
            : []),
        `selection: ${quote(group.selection)}`,
        'publicIndexBase: 1',
    ];

    return [
        `  [${quote(group.key)}, {`,
        ...fields.map((field) => `    ${field},`),
        `    locator: ${locator.trimStart()},`,
        '  }],',
    ].join('\n');
}

export function generateElementsFile(
    metadata: PageMetadata,
    options: ElementsWriterOptions = {},
): ElementsWriterResult {
    const typesPath = validateImportPath(
        options.typesImportPath ??
        '../../tools/pom-generator/models/generator.types',
    );
    const warnings: string[] = [];

    const elements = collectElements(
        metadata,
        options.includeInactive ?? false,
        warnings,
    );
    const groups = collectGroups(metadata.groups, warnings);
    const repeatables = collectRepeatables(
        metadata.repeatableGroups,
        warnings,
    );

    const groupMap = renderGroupMap(groups);
    const repeatableMap = [
        'new Map<string, RepeatableGroup>([',
        ...repeatables.map(renderRepeatable),
        '])',
    ].join('\n');

    const content = [
        '// AUTO-GENERATED BY POM GENERATOR V2.',
        '// Locator definitions are managed by the generator.',
        '// Stable element IDs are stored in POM metadata.',
        '// Engineer-owned workflows belong in group-actions.',
        '',
        'import type {',
        '  LocatorDefinition,',
        '  RepeatableGroup,',
        `} from '${typesPath}';`,
        '',
        'export const elementDefinitions:',
        '  Record<string, LocatorDefinition> =',
        `${renderRecord(elements)};`,
        '',
        'export const groupDefinitions:',
        '  ReadonlyMap<string, LocatorDefinition> =',
        `${groupMap};`,
        '',
        'export const repeatableGroupDefinitions:',
        '  ReadonlyMap<string, RepeatableGroup> =',
        `${repeatableMap};`,
        '',
    ].join('\n');

    return {
        fileName: `${metadata.pageName}.elements.ts`,
        content,
        elementCount: elements.length,
        groupCount: groups.length,
        repeatableGroupCount: repeatables.length,
        warnings,
    };
}
