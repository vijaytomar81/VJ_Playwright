import type {
    GeneratedPage,
} from '../models/page.model';


export class ElementsTemplate {

    render(
        page: GeneratedPage,
    ): string {

        const elementEntries =
            page.elements.map(
                element =>
                    this.renderElement(
                        element.name,
                        element.type,
                        element.locator.preferred,
                        element.locator.fallbacks,
                        element.stableKey,
                    ),
            );


        const elementsBody =
            elementEntries.length > 0
                ? `\n${elementEntries.join('\n\n')}\n`
                : '\n';


        return [
            '// AUTO-GENERATED FILE.',
            '// Changes may be overwritten by the POM generator.',
            `// pageKey: ${page.pageKey}`,
            `// scannedAt: ${page.scannedAt}`,
            '',
            'export const elements = {' +
            elementsBody +
            '} as const;',
            '',
        ].join('\n');
    }


    private renderElement(
        name: string,
        type: string,
        preferred: string,
        fallbacks: readonly string[],
        stableKey: string,
    ): string {

        const fallbackLines =
            fallbacks.map(
                fallback =>
                    `            ${this.quote(fallback)},`,
            );


        const renderedFallbacks =
            fallbackLines.length > 0
                ? [
                    '        fallbacks: [',
                    ...fallbackLines,
                    '        ],',
                ]
                : [
                    '        fallbacks: [],',
                ];


        return [
            `    ${this.renderPropertyName(name)}: {`,
            `        type: ${this.quote(type)},`,
            `        preferred: ${this.quote(preferred)},`,
            ...renderedFallbacks,
            `        stableKey: ${this.quote(stableKey)},`,
            '    },',
        ].join('\n');
    }


    private renderPropertyName(
        value: string,
    ): string {

        if (
            /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
                value,
            )
        ) {
            return value;
        }

        return this.quote(value);
    }


    private quote(
        value: string,
    ): string {

        return JSON.stringify(value);
    }
}