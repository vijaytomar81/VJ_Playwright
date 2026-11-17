
import type {
    ElementHandle,
    Locator,
    Page,
} from '@playwright/test';

import type {
    LocatorCandidate,
} from '../models/locator.model';

export class LocatorValidator {

    constructor(
        private readonly page: Page,
    ) { }

    async validate(
        candidates: readonly LocatorCandidate[],
        originalElement?: ElementHandle<
            HTMLElement | SVGElement
        >,
    ): Promise<LocatorCandidate[]> {
        const validated: LocatorCandidate[] = [];

        for (const candidate of candidates) {
            const locator =
                this.toPlaywrightLocator(candidate);

            const count =
                await locator.count();

            /*
             * Strict uniqueness:
             * exactly one element must match.
             */
            let unique =
                count === 1;

            /*
             * When the original scanned element
             * is available, verify DOM identity.
             *
             * A locator matching exactly one
             * different element is not valid.
             */
            if (
                unique &&
                originalElement
            ) {
                const matchedElement =
                    await locator.elementHandle();

                try {
                    unique =
                        matchedElement !== null &&
                        await matchedElement.evaluate(
                            (matched, original) =>
                                matched === original,
                            originalElement,
                        );
                } finally {
                    await matchedElement?.dispose();
                }
            }

            validated.push({
                ...candidate,

                /*
                 * A candidate is accepted only if
                 * it matches exactly one element
                 * and, when provided, matches the
                 * original scanned element.
                 */
                unique,

                /*
                 * Diagnostic match count.
                 *
                 * 0 = no matching elements
                 * 1 = exactly one matching element
                 * >1 = multiple matching elements
                 */
                matchCount: count,
            });
        }

        return validated;
    }

    private toPlaywrightLocator(
        candidate: LocatorCandidate,
    ): Locator {
        switch (candidate.strategy) {

            case 'role':
                return this.roleLocator(candidate);

            case 'label':
                return this.page.getByLabel(
                    candidate.value,
                    { exact: true },
                );

            case 'testid':
                return this.page.getByTestId(
                    candidate.value,
                );

            case 'placeholder':
                return this.page.getByPlaceholder(
                    candidate.value,
                    { exact: true },
                );

            case 'id':
                return this.page.locator(
                    candidate.descriptor.replace(
                        'css=',
                        '',
                    ),
                );

            case 'name':
                return this.page.locator(
                    candidate.descriptor.replace(
                        'css=',
                        '',
                    ),
                );

            case 'css':
                return this.page.locator(
                    candidate.descriptor.replace(
                        'css=',
                        '',
                    ),
                );

            default:
                throw new Error(
                    `Unsupported locator strategy: ${candidate.strategy}`,
                );
        }
    }

    private roleLocator(
        candidate: LocatorCandidate,
    ): Locator {
        const match =
            candidate.descriptor.match(
                /^role=(.+)\[name="(.*)"\]$/,
            );

        if (!match) {
            throw new Error(
                `Invalid role locator descriptor: ${candidate.descriptor}`,
            );
        }

        const [, role, name] = match;

        return this.page.getByRole(
            role as Parameters<Page['getByRole']>[0],
            {
                name,
                exact: true,
            },
        );
    }
}
