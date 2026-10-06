import type {
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
    ): Promise<LocatorCandidate[]> {
        const validated: LocatorCandidate[] = [];

        for (const candidate of candidates) {
            const locator =
                this.toPlaywrightLocator(candidate);

            const count =
                await locator.count();

            validated.push({
                ...candidate,
                unique: count === 1,
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