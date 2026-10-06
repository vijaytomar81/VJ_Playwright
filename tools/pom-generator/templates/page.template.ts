import type {
    GeneratedElement,
    GeneratedPage,
} from '../models/page.model';

import {
    PageNameGenerator,
} from '../naming/page-name-generator';

import {
    LocatorCodeGenerator,
} from '../locator/locator-code-generator';


export class PageTemplate {

    constructor(
        private readonly pageNameGenerator =
            new PageNameGenerator(),

        private readonly locatorCodeGenerator =
            new LocatorCodeGenerator(),
    ) { }


    render(
        page: GeneratedPage,
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

        const locatorCode =
            this.locatorCodeGenerator.generate(
                element.locator.preferred,
            );

        const indentedLocatorCode =
            this.indent(
                locatorCode,
                12,
            );


        return [
            '',
            `        this${this.renderPropertyAccess(
                element.name,
            )} =`,
            indentedLocatorCode + ';',
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


    private indent(
        value: string,
        spaces: number,
    ): string {

        const indentation =
            ' '.repeat(spaces);

        return value
            .split('\n')
            .map(
                line =>
                    `${indentation}${line}`,
            )
            .join('\n');
    }


    private quote(
        value: string,
    ): string {

        return JSON.stringify(value);
    }
}