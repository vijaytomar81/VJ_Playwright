
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

        const methods =
            page.elements.map(
                element =>
                    this.renderResolverMethod(
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
            '    resolveElement,',
            `} from ${JSON.stringify(resolverImportPath)};`,
            '',
            `export class ${pageName.className}Page {`,
            '',
            '    constructor(',
            '        private readonly page: Page,',
            '    ) { }',
            '',
            ...methods.flatMap(
                method => [method, ''],
            ),
            '}',
            '',
        ].join('\n');
    }


    private renderResolverMethod(
        element: GeneratedElement,
    ): string {

        const methodName =
            this.getResolverMethodName(
                element.name,
            );

        const elementAccess =
            this.renderPropertyAccess(
                element.name,
            );

        return [
            `    async ${methodName}(): Promise<Locator> {`,
            '        return resolveElement(',
            '            this.page,',
            `            elements${elementAccess},`,
            '        );',
            '    }',
        ].join('\n');
    }


    private getResolverMethodName(
        elementName: string,
    ): string {

        const words =
            elementName.match(
                /[A-Za-z0-9]+/g,
            ) ?? [];

        const suffix =
            words.map(
                word =>
                    word.charAt(0).toUpperCase() +
                    word.slice(1),
            ).join('');

        if (!suffix) {
            throw new Error(
                `Cannot generate resolver method for element: ${elementName}`,
            );
        }

        return `resolve${suffix}`;
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
