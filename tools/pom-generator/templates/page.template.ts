import type {
    GeneratedElement,
    GeneratedPage,
} from '../models/page.model';

import {
    PageNameGenerator,
} from '../naming/page-name-generator';


export class PageTemplate {

    constructor(
        private readonly pageNameGenerator =
            new PageNameGenerator(),
    ) { }


    render(
        page: GeneratedPage,
        resolverImportPath = './locator-resolver',
    ): string {

        const pageName =
            this.pageNameGenerator.generate(
                page.pageName,
            );

        const declarations =
            page.elements.map(
                element =>
                    this.renderDeclaration(
                        element,
                    ),
            );

        const assignments =
            page.elements.map(
                element =>
                    this.renderAssignment(
                        element,
                    ),
            );

        return [
            '// AUTO-GENERATED FILE.',
            '// Changes may be overwritten by the POM generator.',
            `// pageKey: ${page.pageKey}`,
            `// scannedAt: ${page.scannedAt}`,
            '',
            'import type {',
            '    Locator,',
            '    Page,',
            "} from '@playwright/test';",
            '',
            "import { elements } from './elements';",
            '',
            'import {',
            '    resolveLocator,',
            `} from ${JSON.stringify(resolverImportPath)};`,
            '',
            `export class ${pageName.className}Page {`,
            '',
            ...declarations,
            '',
            '    constructor(',
            '        page: Page,',
            '    ) {',
            ...assignments,
            '    }',
            '}',
            '',
        ].join('\n');
    }


    private renderDeclaration(
        element: GeneratedElement,
    ): string {

        return [
            '    readonly ',
            this.renderPropertyName(
                element.name,
            ),
            ': Locator;',
        ].join('');
    }


    private renderAssignment(
        element: GeneratedElement,
    ): string {

        const propertyAccess =
            this.renderPropertyAccess(
                element.name,
            );

        return [
            '',
            `        this${propertyAccess} =`,
            '            resolveLocator(',
            '                page,',
            `                elements${propertyAccess}.preferred,`,
            '            );',
        ].join('\n');
    }


    private renderPropertyName(
        value: string,
    ): string {

        if (
            this.isValidIdentifier(
                value,
            )
        ) {
            return value;
        }

        return this.quote(value);
    }


    private renderPropertyAccess(
        value: string,
    ): string {

        if (
            this.isValidIdentifier(
                value,
            )
        ) {
            return `.${value}`;
        }

        return `[${this.quote(value)}]`;
    }


    private isValidIdentifier(
        value: string,
    ): boolean {

        return /^[A-Za-z_$][A-Za-z0-9_$]*$/
            .test(value);
    }


    private quote(
        value: string,
    ): string {

        return JSON.stringify(value);
    }
}
