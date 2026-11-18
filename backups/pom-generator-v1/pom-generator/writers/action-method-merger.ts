
import {
    parse,
} from '@babel/parser';

import type {
    Node,
} from '@babel/types';


interface ActionMethod {
    name: string;
    identity?: string;
    start: number;
    end: number;
    nameStart: number;
    nameEnd: number;
}

interface ParsedActions {
    methods: ActionMethod[];
    insertAt: number;
}

interface Replacement {
    start: number;
    end: number;
    text: string;
}


export class ActionMethodMerger {

    merge(
        existingSource: string,
        generatedSource: string,
    ): string {

        const existing = this.parseActions(
            existingSource,
        );

        const generated = this.parseActions(
            generatedSource,
        );


        const existingByIdentity =
            new Map<string, ActionMethod>();

        for (const method of existing.methods) {
            if (!method.identity) {
                continue;
            }

            if (
                existingByIdentity.has(
                    method.identity,
                )
            ) {
                throw new Error(
                    `Ambiguous existing action: ${method.identity}`,
                );
            }

            existingByIdentity.set(
                method.identity,
                method,
            );
        }


        const matched =
            new Set<ActionMethod>();

        const names =
            new Set<string>();

        const edits: Replacement[] = [];


        for (const method of generated.methods) {
            if (!method.identity) {
                throw new Error(
                    `Unrecognized generated action: ${method.name}`,
                );
            }

            const previous =
                existingByIdentity.get(
                    method.identity,
                );

            const name =
                previous?.name ?? method.name;

            if (names.has(name)) {
                throw new Error(
                    `Duplicate action method: ${name}`,
                );
            }

            names.add(name);

            if (previous) {
                matched.add(previous);

                /*
                 * Preserve the complete existing
                 * action method, including its
                 * engineer-owned name and body.
                 *
                 * Do not replace it with the newly
                 * generated implementation.
                 */
                edits.push({
                    start: method.start,
                    end: method.end,
                    text: existingSource.slice(
                        previous.start,
                        previous.end,
                    ),
                });
            }
        }


        /*
         * Retain custom methods and actions from
         * elements absent in the latest scan.
         */
        const retained =
            existing.methods.filter(
                method => !matched.has(method),
            );

        for (const method of retained) {
            if (names.has(method.name)) {
                throw new Error(
                    `Action method collision: ${method.name}`,
                );
            }

            names.add(method.name);
        }


        if (retained.length > 0) {
            const bodies =
                retained.map(
                    method =>
                        existingSource.slice(
                            method.start,
                            method.end,
                        ),
                );

            edits.push({
                start: generated.insertAt,
                end: generated.insertAt,
                text:
                    '\n' +
                    bodies.join('\n\n') +
                    '\n',
            });
        }


        let result = generatedSource;

        for (
            const edit of edits.sort(
                (a, b) => b.start - a.start,
            )
        ) {
            result =
                result.slice(0, edit.start) +
                edit.text +
                result.slice(edit.end);
        }

        /*
         * Validate that the merged source remains
         * syntactically valid TypeScript.
         */
        this.parseActions(result);

        return result;
    }


    private parseActions(
        source: string,
    ): ParsedActions {

        const ast = parse(source, {
            sourceType: 'module',
            plugins: ['typescript'],
        });

        const classes =
            ast.program.body.filter(
                (
                    statement,
                ): statement is Extract<
                    typeof statement,
                    { type: 'ExportNamedDeclaration' }
                > =>
                    statement.type ===
                    'ExportNamedDeclaration' &&
                    statement.declaration?.type ===
                    'ClassDeclaration',
            );

        if (classes.length !== 1) {
            throw new Error(
                'Expected one exported actions class.',
            );
        }

        const declaration =
            classes[0].declaration;

        if (
            !declaration ||
            declaration.type !== 'ClassDeclaration'
        ) {
            throw new Error(
                'Invalid actions class.',
            );
        }

        const methods: ActionMethod[] = [];

        for (
            const member of declaration.body.body
        ) {
            if (
                member.type !== 'ClassMethod' ||
                member.kind === 'constructor'
            ) {
                continue;
            }

            if (
                member.key.type !== 'Identifier'
            ) {
                throw new Error(
                    'Unsupported action method name.',
                );
            }

            methods.push({
                name: member.key.name,
                identity:
                    this.getIdentity(member),
                start: member.start!,
                end: member.end!,
                nameStart: member.key.start!,
                nameEnd: member.key.end!,
            });
        }

        return {
            methods,
            insertAt:
                declaration.body.end! - 1,
        };
    }


    private getIdentity(
        method: Node,
    ): string | undefined {

        if (
            method.type !== 'ClassMethod'
        ) {
            return undefined;
        }

        const resolverVariables =
            new Map<string, string>();

        const identities =
            new Set<string>();

        const visit = (node: Node): void => {
            if (
                node.type ===
                'VariableDeclarator' &&
                node.id.type === 'Identifier'
            ) {
                const element =
                    this.resolvedElement(
                        node.init,
                    );

                if (element) {
                    resolverVariables.set(
                        node.id.name,
                        element,
                    );
                }
            }

            if (
                node.type === 'CallExpression' &&
                node.callee.type ===
                'MemberExpression'
            ) {
                const operation =
                    this.memberName(
                        node.callee,
                    );

                if (
                    !operation ||
                    ![
                        'click',
                        'fill',
                        'check',
                        'uncheck',
                        'selectOption',
                    ].includes(operation)
                ) {
                    // Continue visiting children.
                } else {
                    const receiver =
                        node.callee.object;

                    let element: string | undefined;

                    if (
                        receiver.type === 'Identifier'
                    ) {
                        element =
                            resolverVariables.get(
                                receiver.name,
                            );
                    } else {
                        element =
                            this.directElement(
                                receiver,
                            );
                    }

                    if (element) {
                        identities.add(
                            JSON.stringify([
                                element,
                                operation,
                            ]),
                        );
                    }
                }
            }

            for (
                const value of Object.values(node)
            ) {
                if (Array.isArray(value)) {
                    for (const child of value) {
                        if (this.isNode(child)) {
                            visit(child);
                        }
                    }
                } else if (this.isNode(value)) {
                    visit(value);
                }
            }
        };

        visit(method.body);

        return identities.size === 1
            ? [...identities][0]
            : undefined;
    }


    private resolvedElement(
        value: Node | null | undefined,
    ): string | undefined {

        const expression =
            value?.type === 'AwaitExpression'
                ? value.argument
                : value;

        if (
            expression?.type !==
            'CallExpression' ||
            expression.callee.type !==
            'MemberExpression'
        ) {
            return undefined;
        }

        const resolver =
            this.memberName(
                expression.callee,
            );

        if (
            !resolver ||
            !/^resolve[A-Z]/.test(resolver) ||
            !this.isThisPage(
                expression.callee.object,
            )
        ) {
            return undefined;
        }

        const suffix =
            resolver.slice(7);

        return (
            suffix.charAt(0).toLowerCase() +
            suffix.slice(1)
        );
    }


    private directElement(
        value: Node,
    ): string | undefined {

        if (
            value.type !==
            'MemberExpression' ||
            !this.isThisPage(
                value.object,
            )
        ) {
            return undefined;
        }

        return this.memberName(value);
    }


    private isThisPage(
        value: Node,
    ): boolean {

        return (
            value.type ===
            'MemberExpression' &&
            this.memberName(value) ===
            'page' &&
            value.object.type ===
            'ThisExpression'
        );
    }


    private memberName(
        member: Node,
    ): string | undefined {

        if (
            member.type !==
            'MemberExpression'
        ) {
            return undefined;
        }

        if (
            !member.computed &&
            member.property.type ===
            'Identifier'
        ) {
            return member.property.name;
        }

        if (
            member.property.type ===
            'StringLiteral'
        ) {
            return member.property.value;
        }

        return undefined;
    }


    private isNode(
        value: unknown,
    ): value is Node {

        return (
            typeof value === 'object' &&
            value !== null &&
            'type' in value &&
            typeof value.type === 'string'
        );
    }
}
