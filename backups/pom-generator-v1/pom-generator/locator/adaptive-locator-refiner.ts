import type {
    ElementHandle,
} from '@playwright/test';

import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    LocatorCandidate,
} from '../models/locator.model';

export class AdaptiveLocatorRefiner {

    private readonly maxAncestorDepth = 5;

    async refine(
        element: CapturedElement,
        originalElement: ElementHandle<
            HTMLElement | SVGElement
        >,
    ): Promise<LocatorCandidate[]> {

        const selectors =
            await originalElement.evaluate(
                (node, maxDepth) => {

                    const escapeIdentifier = (
                        value: string,
                    ): string =>
                        CSS.escape(value);

                    const escapeAttribute = (
                        value: string,
                    ): string =>
                        value
                            .replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"')
                            .replace(/\n/g, '\\a ');

                    const getSegments = (
                        target: Element,
                    ): string[] => {

                        const tag =
                            target.tagName.toLowerCase();

                        const segments: string[] = [];

                        if (target.id) {
                            segments.push(
                                `#${escapeIdentifier(target.id)}`,
                            );
                        }

                        for (const attribute of [
                            'data-testid',
                            'data-qa',
                            'data-test',
                        ]) {
                            const value =
                                target.getAttribute(attribute);

                            if (value) {
                                segments.push(
                                    `${tag}[${attribute}="${escapeAttribute(value)}"]`,
                                );
                            }
                        }

                        if (
                            target instanceof HTMLAnchorElement &&
                            target.hasAttribute('href')
                        ) {
                            segments.push(
                                `a[href="${escapeAttribute(
                                    target.getAttribute('href') ?? '',
                                )}"]`,
                            );
                        }

                        const classes =
                            Array.from(target.classList)
                                .filter(Boolean)
                                .slice(0, 5);

                        for (const className of classes) {
                            segments.push(
                                `${tag}.${escapeIdentifier(className)}`,
                            );
                        }

                        if (classes.length > 1) {
                            segments.push(
                                tag +
                                classes
                                    .map(name =>
                                        `.${escapeIdentifier(name)}`,
                                    )
                                    .join(''),
                            );
                        }

                        return [...new Set(segments)];
                    };

                    const childSegments =
                        getSegments(node);

                    if (childSegments.length === 0) {
                        childSegments.push(
                            node.tagName.toLowerCase(),
                        );
                    }

                    const results: string[] = [];

                    let ancestor = node.parentElement;
                    let depth = 0;

                    while (
                        ancestor &&
                        depth < maxDepth
                    ) {
                        const parentSegments =
                            getSegments(ancestor);

                        for (const parent of parentSegments) {
                            for (const child of childSegments) {
                                results.push(
                                    `${parent} ${child}`,
                                );

                                if (
                                    depth === 0
                                ) {
                                    results.push(
                                        `${parent} > ${child}`,
                                    );
                                }
                            }
                        }

                        ancestor = ancestor.parentElement;
                        depth++;
                    }

                    return [...new Set(results)];
                },
                this.maxAncestorDepth,
            );

        return selectors.map(selector => ({
            strategy: 'css',
            value: selector,
            descriptor: `css=${selector}`,
            unique: false,
        }));
    }
}
