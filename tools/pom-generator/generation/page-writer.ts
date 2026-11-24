
import type {
    PageMetadata,
    StoredElement,
} from '../models/generator.types';

export interface PageWriterOptions {
    runtimeImportPath?: string;
    elementsImportPath?: string;
}

export interface PageWriterResult {
    fileName: string;
    content: string;
    accessorCount: number;
    warnings: string[];
}

interface AccessorDefinition {
    name: string;
    elementKey: string;
    indexed: boolean;
    groupKey?: string;
    repeatableGroupKey?: string;
}

interface GroupAccessorDefinition {
    name: string;
    groupKey: string;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const RESERVED_NAMES = new Set([
    'constructor',
    'page',
    'resolver',
    'resolve',
    'then',
]);

function toPascalCase(value: string): string {
    const parts = value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const result = parts
        .map(
            (part) =>
                part[0].toUpperCase() + part.slice(1),
        )
        .join('');

    if (!result) {
        throw new Error('Page name must not be empty.');
    }

    if (!IDENTIFIER_PATTERN.test(result)) {
        throw new Error(
            `Invalid generated page class name: ${result}`,
        );
    }

    return result;
}

function validateImportPath(
    value: string,
    label: string,
): string {
    if (
        !value.startsWith('.') ||
        /[\r\n'"\\]/.test(value)
    ) {
        throw new Error(
            `${label} must be a safe relative module path.`,
        );
    }

    return value;
}

function toAccessor(
    element: StoredElement,
    warnings: string[],
): AccessorDefinition | undefined {
    if (
        !IDENTIFIER_PATTERN.test(element.name) ||
        RESERVED_NAMES.has(element.name)
    ) {
        warnings.push(
            `Element "${element.stableKey}" has an invalid ` +
            `accessor name "${element.name}".`,
        );
        return undefined;
    }

    if (element.status !== 'active') {
        warnings.push(
            `Element "${element.stableKey}" is ` +
            `"${element.status}"; accessor generation skipped.`,
        );
        return undefined;
    }

    if (element.indexed && !element.repeatableGroupKey) {
        warnings.push(
            `Indexed element "${element.stableKey}" has no ` +
            'repeatable group key.',
        );
        return undefined;
    }

    return {
        name: element.name,
        elementKey: element.stableKey,
        indexed: Boolean(element.indexed),
        ...(element.groupKey
            ? { groupKey: element.groupKey }
            : {}),
        ...(element.repeatableGroupKey
            ? { repeatableGroupKey: element.repeatableGroupKey }
            : {}),
    };
}

function renderAccessor(
    accessor: AccessorDefinition,
): string {
    const parameters = accessor.indexed
        ? 'instance: number'
        : '';

    const resolutionOptions: string[] = [];

    if (accessor.indexed && accessor.repeatableGroupKey) {
        resolutionOptions.push(
            `repeatableGroupKey: ${JSON.stringify(
                accessor.repeatableGroupKey,
            )}`,
            'instance',
        );
    } else if (accessor.groupKey) {
        resolutionOptions.push(
            `groupKey: ${JSON.stringify(accessor.groupKey)}`,
        );
    }

    const options = resolutionOptions.length
        ? `, { ${resolutionOptions.join(', ')} }`
        : '';

    return [
        `  async ${accessor.name}(${parameters}): Promise<Locator> {`,
        '    const result = await this.resolver.resolve(',
        `      elementDefinitions[${JSON.stringify(
            accessor.name,
        )}]${options},`,
        '    );',
        '    return result.locator;',
        '  }',
    ].join('\n');
}

function collectAccessors(
    metadata: PageMetadata,
    warnings: string[],
): AccessorDefinition[] {
    const result: AccessorDefinition[] = [];
    const names = new Set<string>();

    for (const element of metadata.elements) {
        const accessor = toAccessor(element, warnings);

        if (!accessor) {
            continue;
        }

        if (names.has(accessor.name)) {
            throw new Error(
                `Duplicate accessor name "${accessor.name}".`,
            );
        }

        names.add(accessor.name);
        result.push(accessor);
    }

    return result;
}

function toGroupAccessorName(value: string): string {
    const words = value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) {
        throw new Error('Radio group has no usable name.');
    }

    const pascal = words
        .map((word) =>
            word[0].toUpperCase() + word.slice(1),
        )
        .join('');

    return pascal[0].toLowerCase() +
        pascal.slice(1) +
        'Group';
}

function collectGroupAccessors(
    metadata: PageMetadata,
    existingNames: readonly string[],
    warnings: string[],
): GroupAccessorDefinition[] {
    const usedNames = new Set([
        ...existingNames,
        ...RESERVED_NAMES,
    ]);

    const result: GroupAccessorDefinition[] = [];

    for (const group of metadata.groups) {
        const candidate = group.locator?.primary;

        if (
            candidate?.strategy !== 'role' ||
            (candidate.role !== 'group' &&
                candidate.role !== 'radiogroup')
        ) {
            continue;
        }

        const name = toGroupAccessorName(group.name);

        if (
            !IDENTIFIER_PATTERN.test(name) ||
            usedNames.has(name)
        ) {
            warnings.push(
                `Radio group "${group.name}" cannot use ` +
                `accessor "${name}" because it is invalid or duplicated.`,
            );
            continue;
        }

        usedNames.add(name);

        result.push({
            name,
            groupKey: group.key,
        });
    }

    return result;
}

function renderGroupAccessor(
    accessor: GroupAccessorDefinition,
): string {
    return [
        `  async ${accessor.name}(): Promise<Locator> {`,
        '    const result = await this.resolver.resolve(',
        `      groupDefinitions[${JSON.stringify(
            accessor.groupKey,
        )}],`,
        '    );',
        '    return result.locator;',
        '  }',
    ].join('\n');
}

export function generatePageFile(
    metadata: PageMetadata,
    options: PageWriterOptions = {},
): PageWriterResult {
    const className = `${toPascalCase(metadata.pageName)}Page`;

    const runtimePath = validateImportPath(
        options.runtimeImportPath ??
        '../../tools/pom-generator/runtime/locator-resolver',
        'runtimeImportPath',
    );

    const elementsPath = validateImportPath(
        options.elementsImportPath ??
        `./${metadata.pageName}.elements`,
        'elementsImportPath',
    );

    const warnings: string[] = [];
    const accessors = collectAccessors(metadata, warnings);

    const groupAccessors = collectGroupAccessors(
        metadata,
        accessors.map((accessor) => accessor.name),
        warnings,
    );

    const accessorCode = [
        ...accessors.map(renderAccessor),
        ...groupAccessors.map(renderGroupAccessor),
    ].join('\n\n');

    const content = [
        '// AUTO-GENERATED BY POM GENERATOR V2.',
        '// Regenerate this file through the generator.',
        '// Put engineer-owned workflows in group-actions.',
        '',
        "import type { Locator, Page } from '@playwright/test';",
        `import { LocatorResolver } from '${runtimePath}';`,
        'import {',
        '  elementDefinitions,',
        '  groupDefinitions,',
        '  repeatableGroupDefinitions,',
        `} from '${elementsPath}';`,
        '',
        `export class ${className} {`,
        '  private readonly resolver: LocatorResolver;',
        '',
        '  constructor(readonly page: Page) {',
        '    this.resolver = new LocatorResolver(page, {',
        '      groups: groupDefinitions,',
        '      repeatableGroups: repeatableGroupDefinitions,',
        '    });',
        '  }',
        '',
        accessorCode,
        '}',
        '',
    ].join('\n');

    return {
        fileName: `${metadata.pageName}.page.ts`,
        content,
        accessorCount: accessors.length + groupAccessors.length,
        warnings,
    };
}
