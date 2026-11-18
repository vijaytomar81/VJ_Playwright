
import type {
    GeneratedPage,
} from '../models/page.model';

import type {
    ElementType,
} from '../models/captured-element.model';

import {
    PageNameGenerator,
} from '../naming/page-name-generator';


interface GeneratedAction {
    name: string;
    parameter: string;
    operation: string;
}


export class ActionsTemplate {

    constructor(
        private readonly pageNameGenerator =
            new PageNameGenerator(),
    ) { }


    render(
        page: GeneratedPage,
    ): string {

        const pageName =
            this.pageNameGenerator.generate(
                page.pageName,
            );

        const methods: string[] = [];

        const methodNames =
            new Set<string>();

        for (const element of page.elements) {

            const actions =
                this.getActionNames(
                    element.type,
                    element.name,
                );

            const resolverName =
                this.getResolverMethodName(
                    element.name,
                );

            for (const action of actions) {

                if (methodNames.has(action.name)) {
                    throw new Error(
                        `Duplicate generated action method: ${action.name}`,
                    );
                }

                methodNames.add(action.name);

                methods.push(
                    [
                        `    async ${action.name}(${action.parameter}): Promise<void> {`,
                        '        const locator =',
                        `            await this.page.${resolverName}();`,
                        '',
                        `        await locator.${action.operation};`,
                        '    }',
                    ].join('\n'),
                );
            }
        }

        return [
            '// AUTO-GENERATED ATOMIC ACTIONS',
            '// Changes may be overwritten by the POM generator.',
            '',
            'import {',
            `    ${pageName.className}Page,`,
            `} from '../pages/${pageName.fileName}/${pageName.fileName}.page';`,
            '',
            `export class ${pageName.className}Actions {`,
            '',
            '    constructor(',
            `        private readonly page: ${pageName.className}Page,`,
            '    ) { }',
            '',
            ...methods.flatMap(
                method => [method, ''],
            ),
            '}',
            '',
        ].join('\n');
    }


    private getResolverMethodName(
        elementName: string,
    ): string {

        const suffix =
            elementName.charAt(0).toUpperCase() +
            elementName.slice(1);

        return `resolve${suffix}`;
    }


    private getActionNames(
        type: ElementType,
        elementName: string,
    ): readonly GeneratedAction[] {

        const suffix =
            elementName.charAt(0).toUpperCase() +
            elementName.slice(1);

        switch (type) {

            case 'button':
            case 'link':
                return [{
                    name: `click${suffix}`,
                    parameter: '',
                    operation: 'click()',
                }];

            case 'input':
            case 'textarea':
                return [{
                    name: `fill${suffix}`,
                    parameter: 'value: string',
                    operation: 'fill(value)',
                }];

            case 'checkbox':
                return [
                    {
                        name: `check${suffix}`,
                        parameter: '',
                        operation: 'check()',
                    },
                    {
                        name: `uncheck${suffix}`,
                        parameter: '',
                        operation: 'uncheck()',
                    },
                ];

            case 'radio':
                return [{
                    name: `check${suffix}`,
                    parameter: '',
                    operation: 'check()',
                }];

            case 'select':
                return [{
                    name: `select${suffix}`,
                    parameter: 'value: string',
                    operation: 'selectOption(value)',
                }];

            case 'text':
                return [];

            default:
                return [];
        }
    }
}
