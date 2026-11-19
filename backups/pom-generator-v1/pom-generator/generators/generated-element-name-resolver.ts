
import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    GeneratedElement,
} from '../models/page.model';

import {
    StringUtils,
} from '../../../../utils/string/string.utils';


export interface NamedGeneratedElement {
    generated: GeneratedElement;
    captured: CapturedElement;
}


export class GeneratedElementNameResolver {

    resolve(
        items: readonly NamedGeneratedElement[],
    ): GeneratedElement[] {

        const nameCounts =
            new Map<string, number>();

        for (const item of items) {
            const name = item.generated.name;

            nameCounts.set(
                name,
                (nameCounts.get(name) ?? 0) + 1,
            );
        }

        const usedNames =
            new Set<string>();

        // Reserve names that are already unique.
        for (const item of items) {
            const name = item.generated.name;

            if (nameCounts.get(name) === 1) {
                usedNames.add(name);
            }
        }

        const results: GeneratedElement[] = [];

        for (const item of items) {
            const originalName =
                item.generated.name;

            if (nameCounts.get(originalName) === 1) {
                results.push(item.generated);
                continue;
            }

            const candidates =
                this.buildCandidateNames(item);

            const resolvedName =
                candidates.find(
                    candidate =>
                        !usedNames.has(candidate),
                );

            if (!resolvedName) {
                throw new Error(
                    [
                        'Unable to resolve generated element name collision.',
                        `Original name: ${originalName}`,
                        `Element type: ${item.generated.type}`,
                        `Preferred locator: ${item.generated.locator.preferred}`,
                        `Context: ${item.captured.context ?? '(none)'}`,
                        'No unique semantic or attribute-based name could be derived.',
                    ].join('\n'),
                );
            }

            usedNames.add(resolvedName);

            results.push({
                ...item.generated,
                name: resolvedName,
            });
        }

        return results;
    }


    private buildCandidateNames(
        item: NamedGeneratedElement,
    ): string[] {

        const originalName =
            item.generated.name;

        const locator =
            item.generated.locator.preferred;

        const candidates: string[] = [];

        const addCandidate = (
            prefix: string | undefined,
        ): void => {

            if (!prefix) {
                return;
            }

            const normalized =
                StringUtils.toCamelCase(prefix);

            if (!normalized) {
                return;
            }

            const candidate =
                this.prependName(
                    normalized,
                    originalName,
                );

            if (
                candidate !== originalName &&
                !candidates.includes(candidate)
            ) {
                candidates.push(candidate);
            }
        };

        // Preserve existing contextual naming priority.
        const contextualPrefixes =
            this.extractContextualPrefixes(
                locator,
                item.captured.context,
            );

        for (const prefix of contextualPrefixes) {
            addCandidate(prefix);
        }

        // New: deterministic target-attribute fallback.
        addCandidate(item.captured.testId);
        addCandidate(item.captured.id);
        addCandidate(item.captured.name);

        // Extract target ID from a validated CSS locator.
        if (locator.startsWith('css=')) {

            const selector =
                locator.slice(4);

            const targetSelector =
                selector
                    .trim()
                    .split(/\s*[>+~]\s*|\s+/)
                    .filter(Boolean)
                    .pop() ?? '';

            const idMatch =
                targetSelector.match(
                    /#([a-zA-Z_][\w-]*)/,
                );

            if (idMatch) {
                addCandidate(idMatch[1]);
            }

            const attributeMatches =
                targetSelector.matchAll(
                    /\[(?:data-testid|data-test-id|id|name)=["']([^"']+)["']\]/g,
                );

            for (const match of attributeMatches) {
                addCandidate(match[1]);
            }
        }

        return candidates;
    }


    private extractContextualPrefixes(
        locator: string,
        context?: string,
    ): string[] {

        const prefixes: string[] = [];

        const addPrefix = (
            value: string,
        ): void => {

            const normalized =
                StringUtils.toCamelCase(value);

            if (
                normalized &&
                !prefixes.includes(normalized)
            ) {
                prefixes.push(normalized);
            }
        };

        const selector =
            locator.replace(/^css=/, '');

        // Preserve ancestor href naming.
        const hrefMatches =
            selector.matchAll(
                /(?:^|[\s>+~])a(?:[.#][\w-]+)*\[href=["']([^"']+)["']\]/g,
            );

        for (const match of hrefMatches) {
            const path =
                match[1].split(/[?#]/, 1)[0];

            const segments =
                path.split('/').filter(Boolean);

            const finalSegment =
                segments[segments.length - 1];

            if (finalSegment) {
                addPrefix(finalSegment);
            }
        }

        // Preserve ancestor class naming.
        const ancestorPart =
            selector.replace(
                /\s*[>+~]?\s*[^\s>+~]+$/,
                '',
            );

        const classMatches =
            ancestorPart.matchAll(
                /\.([a-zA-Z][\w-]*)/g,
            );

        const genericTokens =
            new Set([
                'btn',
                'button',
                'link',
                'container',
                'wrapper',
                'row',
                'col',
                'flex',
                'block',
            ]);

        for (const match of classMatches) {
            const tokens =
                match[1]
                    .split('-')
                    .filter(Boolean);

            const meaningfulTokens =
                tokens.filter(
                    token =>
                        !genericTokens.has(
                            token.toLowerCase(),
                        ),
                );

            if (meaningfulTokens.length > 0) {
                addPrefix(
                    meaningfulTokens[
                    meaningfulTokens.length - 1
                    ],
                );

                if (meaningfulTokens.length > 1) {
                    addPrefix(
                        meaningfulTokens.join(' '),
                    );
                }
            }
        }

        // Preserve existing context keywords.
        if (context) {
            const contextTokens =
                context.match(
                    /\b(?:top|bottom|header|footer|dashboard|sidebar|modal|dialog|navigation|nav|primary|secondary)\b/gi,
                ) ?? [];

            for (const token of contextTokens) {
                addPrefix(token);
            }
        }

        return prefixes;
    }


    private prependName(
        prefix: string,
        name: string,
    ): string {

        const capitalizedName =
            name.charAt(0).toUpperCase() +
            name.slice(1);

        return StringUtils.toCamelCase(
            `${prefix} ${capitalizedName}`,
        );
    }
}
