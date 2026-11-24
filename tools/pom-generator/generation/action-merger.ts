
import { parse } from '@babel/parser';
import type {
    ClassDeclaration,
    ClassMethod,
    File,
} from '@babel/types';
import type {
    PageMetadata,
    StoredAction,
} from '../models/generator.types';

export interface ActionMergeOptions {
    className?: string;
    previousMetadata: PageMetadata;
    currentMetadata: PageMetadata;
}

export interface ActionMergeResult {
    content: string;
    preservedActionIds: string[];
    addedActionIds: string[];
    warnings: string[];
    changed: boolean;
}

interface ParsedMethod {
    name: string;
    source: string;
    actionId?: string;
    elementId?: string;
}

interface ParsedClass {
    node: ClassDeclaration;
    methods: ParsedMethod[];
}

const ACTION_TAG = /@pom-action-id\s+(act_[\w-]+)/g;
const ELEMENT_TAG = /@pom-element-id\s+(el_[\w-]+)/g;

function parseSource(source: string, label: string): File {
    try {
        return parse(source, {
            sourceType: 'module',
            plugins: ['typescript', 'decorators-legacy'],
            attachComment: true,
        });
    } catch (error) {
        throw new Error(`Cannot parse ${label}: ${String(error)}`);
    }
}

function getMethodName(method: ClassMethod): string {
    if (method.computed) {
        throw new Error('Computed action methods are unsupported.');
    }
    if (method.key.type === 'Identifier') {
        return method.key.name;
    }
    if (method.key.type === 'StringLiteral') {
        return method.key.value;
    }
    throw new Error('Unsupported action method name.');
}

function getTag(
    method: ClassMethod,
    pattern: RegExp,
): string | undefined {
    const values: string[] = [];

    for (const comment of method.leadingComments ?? []) {
        const regex = new RegExp(pattern.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(comment.value)) !== null) {
            values.push(match[1]);
        }
    }

    if (values.length > 1) {
        throw new Error('Duplicate generator ID comments.');
    }
    return values[0];
}

function findClass(
    source: string,
    label: string,
    requestedName?: string,
): ParsedClass {
    const ast = parseSource(source, label);
    const classes: ClassDeclaration[] = [];

    for (const statement of ast.program.body) {
        if (statement.type === 'ClassDeclaration') {
            classes.push(statement);
        } else if (
            statement.type === 'ExportNamedDeclaration' &&
            statement.declaration?.type === 'ClassDeclaration'
        ) {
            classes.push(statement.declaration);
        } else if (
            statement.type === 'ExportDefaultDeclaration' &&
            statement.declaration.type === 'ClassDeclaration'
        ) {
            classes.push(statement.declaration);
        }
    }

    const candidates = classes.filter((node) =>
        requestedName
            ? node.id?.name === requestedName
            : node.id?.name.endsWith('Actions'),
    );

    if (candidates.length !== 1) {
        throw new Error(
            `${label} must contain exactly one action class.`,
        );
    }

    const node = candidates[0];
    const methods: ParsedMethod[] = [];

    for (const member of node.body.body) {
        if (member.type !== 'ClassMethod') {
            if (member.type !== 'ClassProperty') {
                throw new Error(
                    `Unsupported class member in ${label}.`,
                );
            }
            continue;
        }

        if (member.kind === 'constructor') continue;

        if (member.start == null || member.end == null) {
            throw new Error(`Missing source offsets in ${label}.`);
        }

        methods.push({
            name: getMethodName(member),
            source: source.slice(member.start, member.end),
            actionId: getTag(member, ACTION_TAG),
            elementId: getTag(member, ELEMENT_TAG),
        });
    }

    return { node, methods };
}

function assertUnique(
    methods: readonly ParsedMethod[],
    label: string,
): void {
    const names = new Set<string>();
    const ids = new Set<string>();

    for (const method of methods) {
        if (names.has(method.name)) {
            throw new Error(
                `Duplicate method "${method.name}" in ${label}.`,
            );
        }
        names.add(method.name);

        if (method.actionId) {
            if (ids.has(method.actionId)) {
                throw new Error(
                    `Duplicate action ID "${method.actionId}".`,
                );
            }
            ids.add(method.actionId);
        }
    }
}

function mapActions(
    actions: readonly StoredAction[],
    label: string,
): Map<string, StoredAction> {
    const result = new Map<string, StoredAction>();
    const names = new Set<string>();

    for (const action of actions) {
        if (
            result.has(action.stableKey) ||
            names.has(action.methodName)
        ) {
            throw new Error(
                `Duplicate action ID or method in ${label}.`,
            );
        }
        result.set(action.stableKey, action);
        names.add(action.methodName);
    }

    return result;
}

function indentMethod(source: string): string {
    const lines = source.trim().split(/\r?\n/);
    const nonempty = lines.filter((line) => line.trim());
    const minimum = Math.min(
        ...nonempty.map(
            (line) => line.match(/^\s*/)?.[0].length ?? 0,
        ),
    );

    return lines
        .map((line) => `  ${line.slice(minimum)}`)
        .join('\n');
}

function removeLegacyIdComments(source: string): string {
    return source.replace(
        /^[ \t]*\/\*\*[ \t]*\r?\n(?:[ \t]*\*[ \t]*@pom-(?:action|element)-id[ \t]+(?:act|el)_[\w-]+[ \t]*\r?\n)+[ \t]*\*\/[ \t]*\r?\n/gm,
        '',
    );
}

function sameActionAssociation(
    previous: StoredAction,
    current: StoredAction,
): boolean {
    return previous.operation === current.operation &&
        (previous.operation === 'selectRadio'
            ? previous.groupKey === current.groupKey
            : previous.elementKey === current.elementKey);
}

export function mergeActionFiles(
    existingSource: string,
    generatedSource: string,
    options: ActionMergeOptions,
): ActionMergeResult {
    const existing = findClass(
        existingSource,
        'existing actions',
        options.className,
    );
    const generated = findClass(
        generatedSource,
        'generated actions',
        options.className,
    );

    if (existing.node.id?.name !== generated.node.id?.name) {
        throw new Error('Action class names differ.');
    }

    assertUnique(existing.methods, 'existing actions');
    assertUnique(generated.methods, 'generated actions');

    const previous = mapActions(
        options.previousMetadata.actions,
        'previous metadata',
    );
    const current = mapActions(
        options.currentMetadata.actions,
        'current metadata',
    );

    const existingByName = new Map(
        existing.methods.map((method) => [method.name, method]),
    );
    const existingById = new Map(
        existing.methods
            .filter((method) => method.actionId)
            .map((method) => [method.actionId!, method]),
    );
    const generatedByName = new Map(
        generated.methods.map((method) => [method.name, method]),
    );

    const preservedActionIds: string[] = [];
    const addedActionIds: string[] = [];
    const warnings: string[] = [];
    const additions: ParsedMethod[] = [];
    const claimed = new Set<string>();

    for (const [id, action] of current) {
        const generatedMethod = generatedByName.get(
            action.methodName,
        );

        if (!generatedMethod) {
            throw new Error(
                `Generated method missing for action "${id}".`,
            );
        }

        const oldAction = previous.get(id);

        if (oldAction) {
            if (!sameActionAssociation(oldAction, action)) {
                throw new Error(
                    `Action "${id}" changed its element or group association.`,
                );
            }

            if (oldAction.methodName !== action.methodName) {
                throw new Error(
                    `Action "${id}" changed its method name. ` +
                    'Manual review is required.',
                );
            }

            const byId = existingById.get(id);
            const byName = existingByName.get(
                oldAction.methodName,
            );

            if (byId && byName && byId !== byName) {
                throw new Error(
                    `Ambiguous existing method for action "${id}".`,
                );
            }

            const original = byId ?? byName;

            if (!original) {
                throw new Error(
                    `Existing action "${id}" is missing. ` +
                    'Manual review is required.',
                );
            }

            if (
                (original.actionId && original.actionId !== id) ||
                (original.elementId &&
                    original.elementId !== action.elementKey)
            ) {
                throw new Error(
                    `Conflicting legacy ID for action "${id}".`,
                );
            }

            if (claimed.has(original.name)) {
                throw new Error(
                    `Existing method "${original.name}" matched twice.`,
                );
            }

            claimed.add(original.name);
            preservedActionIds.push(id);
            continue;
        }

        if (
            existingById.has(id) ||
            existingByName.has(action.methodName)
        ) {
            throw new Error(
                `New action "${id}" conflicts with an existing method.`,
            );
        }

        addedActionIds.push(id);
        additions.push(generatedMethod);
    }

    if (existing.node.body.end == null) {
        throw new Error('Cannot locate action class closing brace.');
    }

    const insertionPoint = existing.node.body.end - 1;

    if (existingSource[insertionPoint] !== '}') {
        throw new Error('Unexpected action class boundary.');
    }

    const insertion = additions.length
        ? '\n' +
        additions.map(
            (method) => indentMethod(method.source) + '\n',
        ).join('\n')
        : '';

    const combined =
        existingSource.slice(0, insertionPoint) +
        insertion +
        existingSource.slice(insertionPoint);

    const content = removeLegacyIdComments(combined);

    parseSource(content, 'merged actions');

    return {
        content,
        preservedActionIds,
        addedActionIds,
        warnings,
        changed: content !== existingSource,
    };
}
