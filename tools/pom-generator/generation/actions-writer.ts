
import type {
    ActionOperation,
    PageMetadata,
    StoredAction,
    StoredElement,
} from '../models/generator.types';

export interface ActionsWriterOptions {
    pageImportPath?: string;
}

export interface ActionsWriterResult {
    fileName: string;
    content: string;
    actionCount: number;
    warnings: string[];
}

interface ActionDefinition {
    action: StoredAction;
    element: StoredElement;
    indexed: boolean;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const RESERVED = new Set([
    'constructor',
    'page',
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
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');

    if (!result || !IDENTIFIER.test(result)) {
        throw new Error(
            `Invalid page name for action class: "${value}".`,
        );
    }

    return result;
}

function validateImportPath(value: string): string {
    if (!value.startsWith('.') || /[\r\n'"\\]/.test(value)) {
        throw new Error(
            `Invalid relative page import path: "${value}".`,
        );
    }

    return value;
}

function isSupportedOperation(
    operation: ActionOperation,
    kind: StoredElement['kind'],
): boolean {
    switch (operation) {
        case 'fill':
            return [
                'input',
                'textarea',
                'date',
                'combobox',
            ].includes(kind);

        case 'click':
            return [
                'button',
                'link',
                'radio',
                'checkbox',
                'combobox',
            ].includes(kind);

        case 'check':
        case 'uncheck':
            return kind === 'checkbox' || kind === 'radio';

        case 'selectOption':
            return kind === 'select';

        case 'press':
            return [
                'input',
                'textarea',
                'combobox',
            ].includes(kind);

        default:
            return false;
    }
}

function valueParameter(
    operation: ActionOperation,
): string | undefined {
    switch (operation) {
        case 'fill':
        case 'press':
        case 'selectOption':
            return 'value: string';

        default:
            return undefined;
    }
}

function actionStatement(
    operation: ActionOperation,
): string {
    switch (operation) {
        case 'fill':
            return 'await locator.fill(value);';

        case 'click':
            return 'await locator.click();';

        case 'check':
            return 'await locator.check();';

        case 'uncheck':
            return 'await locator.uncheck();';

        case 'selectOption':
            return 'await locator.selectOption(value);';

        case 'press':
            return 'await locator.press(value);';
    }
}

function collectActions(
    metadata: PageMetadata,
    warnings: string[],
): ActionDefinition[] {
    const elements = new Map(
        metadata.elements.map((element) => [
            element.stableKey,
            element,
        ]),
    );

    const result: ActionDefinition[] = [];
    const methodNames = new Set<string>();
    const actionKeys = new Set<string>();

    for (const action of metadata.actions) {
        const element = elements.get(action.elementKey);

        if (!element) {
            warnings.push(
                `Action "${action.stableKey}" references ` +
                `unknown element "${action.elementKey}".`,
            );
            continue;
        }

        if (element.status !== 'active') {
            warnings.push(
                `Action "${action.stableKey}" references ` +
                `inactive element "${element.stableKey}".`,
            );
            continue;
        }

        if (
            !IDENTIFIER.test(action.methodName) ||
            RESERVED.has(action.methodName)
        ) {
            warnings.push(
                `Action "${action.stableKey}" has invalid method ` +
                `name "${action.methodName}".`,
            );
            continue;
        }

        if (actionKeys.has(action.stableKey)) {
            throw new Error(
                `Duplicate action ID "${action.stableKey}".`,
            );
        }

        if (methodNames.has(action.methodName)) {
            throw new Error(
                `Duplicate action method "${action.methodName}".`,
            );
        }

        if (!isSupportedOperation(action.operation, element.kind)) {
            warnings.push(
                `Action "${action.stableKey}" has unsupported ` +
                `operation "${action.operation}" for "${element.kind}".`,
            );
            continue;
        }

        const indexed = Boolean(
            action.indexed || element.indexed,
        );

        if (indexed && !element.repeatableGroupKey) {
            warnings.push(
                `Indexed action "${action.stableKey}" has no ` +
                'repeatable group.',
            );
            continue;
        }

        actionKeys.add(action.stableKey);
        methodNames.add(action.methodName);

        result.push({
            action,
            element,
            indexed,
        });
    }

    return result;
}

function renderAction(
    definition: ActionDefinition,
): string {
    const { action, element, indexed } = definition;
    const parameters: string[] = [];

    if (indexed) {
        parameters.push('instance: number');
    }

    const value = valueParameter(action.operation);

    if (value) {
        parameters.push(value);
    }

    const accessorCall = indexed
        ? `this.page.${element.name}(instance)`
        : `this.page.${element.name}()`;

    return [
        `  async ${action.methodName}(${parameters.join(', ')}): Promise<void> {`,
        `    const locator = await ${accessorCall};`,
        `    ${actionStatement(action.operation)}`,
        '  }',
    ].join('\n');
}

export function generateActionsFile(
    metadata: PageMetadata,
    options: ActionsWriterOptions = {},
): ActionsWriterResult {
    const classBase = toPascalCase(metadata.pageName);

    const importPath = validateImportPath(
        options.pageImportPath ??
        `./${metadata.pageName}.page`,
    );

    const warnings: string[] = [];
    const actions = collectActions(metadata, warnings);

    const methods = actions
        .map(renderAction)
        .join('\n\n');

    const content = [
        '// GENERATED BY POM GENERATOR V2.',
        '// Individual actions may be customized by engineers.',
        '// Keep business workflows in engineer-owned group-actions.',
        '',
        `import { ${classBase}Page } from '${importPath}';`,
        '',
        `export class ${classBase}Actions {`,
        `  constructor(private readonly page: ${classBase}Page) {}`,
        '',
        methods,
        '}',
        '',
    ].join('\n');

    return {
        fileName: `${metadata.pageName}.actions.ts`,
        content,
        actionCount: actions.length,
        warnings,
    };
}
