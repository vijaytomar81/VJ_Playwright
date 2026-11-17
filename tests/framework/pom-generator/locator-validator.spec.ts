
import {
    test,
    expect,
} from '@playwright/test';

import type {
    ElementHandle,
} from '@playwright/test';

import {
    LocatorValidator,
} from '../../../tools/pom-generator/locator/locator-validator';

import type {
    LocatorCandidate,
} from '../../../tools/pom-generator/models/locator.model';


function candidate(
    strategy: LocatorCandidate['strategy'],
    value: string,
    descriptor: string,
): LocatorCandidate {
    return {
        strategy,
        value,
        descriptor,
        unique: false,
    };
}


async function originalHandle(
    page: Parameters<
        typeof LocatorValidator.prototype.validate
    > extends never
        ? never
        : import('@playwright/test').Page,
    selector: string,
): Promise<ElementHandle<HTMLElement | SVGElement>> {

    const handle =
        await page.$(selector);

    if (!handle) {
        throw new Error(
            `Original DOM element not found: ${selector}`,
        );
    }

    return handle;
}


test.describe('LocatorValidator', () => {

    test(
        'should mark a single matching locator as unique',
        async ({ page }) => {

            await page.setContent(`
                <label for="firstName">
                    First name
                </label>

                <input
                    id="firstName"
                    name="firstName"
                />
            `);

            const validator =
                new LocatorValidator(page);

            const result =
                await validator.validate([
                    candidate(
                        'label',
                        'First name',
                        'label=First name',
                    ),
                ]);

            expect(result[0].unique)
                .toBe(true);

            expect(result[0].matchCount)
                .toBe(1);
        },
    );


    test(
        'should mark duplicate locators as non-unique',
        async ({ page }) => {

            await page.setContent(`
                <input placeholder="Search" />
                <input placeholder="Search" />
            `);

            const validator =
                new LocatorValidator(page);

            const result =
                await validator.validate([
                    candidate(
                        'placeholder',
                        'Search',
                        'placeholder=Search',
                    ),
                ]);

            expect(result[0].unique)
                .toBe(false);

            expect(result[0].matchCount)
                .toBe(2);
        },
    );


    test(
        'should mark missing locators as non-unique',
        async ({ page }) => {

            await page.setContent(`
                <button>
                    Continue
                </button>
            `);

            const validator =
                new LocatorValidator(page);

            const result =
                await validator.validate([
                    candidate(
                        'testid',
                        'missing-button',
                        'testid=missing-button',
                    ),
                ]);

            expect(result[0].unique)
                .toBe(false);

            expect(result[0].matchCount)
                .toBe(0);
        },
    );


    test(
        'should validate role locators',
        async ({ page }) => {

            await page.setContent(`
                <button>
                    Continue
                </button>
            `);

            const validator =
                new LocatorValidator(page);

            const result =
                await validator.validate([
                    candidate(
                        'role',
                        'Continue',
                        'role=button[name="Continue"]',
                    ),
                ]);

            expect(result[0].unique)
                .toBe(true);

            expect(result[0].matchCount)
                .toBe(1);
        },
    );


    test(
        'should validate id locators',
        async ({ page }) => {

            await page.setContent(`
                <input id="postcode" />
            `);

            const validator =
                new LocatorValidator(page);

            const result =
                await validator.validate([
                    candidate(
                        'id',
                        'postcode',
                        'css=#postcode',
                    ),
                ]);

            expect(result[0].unique)
                .toBe(true);

            expect(result[0].matchCount)
                .toBe(1);
        },
    );


    test(
        'should accept a unique locator matching the original element',
        async ({ page }) => {

            await page.setContent(`
                <button
                    id="backButton"
                    class="btn btn-back-link"
                >
                    Back
                </button>

                <button id="continueButton">
                    Continue
                </button>
            `);

            const original =
                await originalHandle(
                    page,
                    '#backButton',
                );

            try {
                const validator =
                    new LocatorValidator(page);

                const result =
                    await validator.validate(
                        [
                            candidate(
                                'css',
                                'button.btn-back-link',
                                'css=button.btn-back-link',
                            ),
                        ],
                        original,
                    );

                expect(result[0].unique)
                    .toBe(true);

                expect(result[0].matchCount)
                    .toBe(1);

            } finally {
                await original.dispose();
            }
        },
    );


    test(
        'should reject a unique locator matching a different DOM element',
        async ({ page }) => {

            await page.setContent(`
                <button
                    id="backButton"
                    class="btn btn-back-link"
                >
                    Back
                </button>

                <button
                    id="continueButton"
                    class="btn btn-continue"
                >
                    Continue
                </button>
            `);

            const original =
                await originalHandle(
                    page,
                    '#backButton',
                );

            try {
                const validator =
                    new LocatorValidator(page);

                const result =
                    await validator.validate(
                        [
                            candidate(
                                'css',
                                'button.btn-continue',
                                'css=button.btn-continue',
                            ),
                        ],
                        original,
                    );

                /*
                 * The locator matches exactly
                 * one element, but it is not
                 * the original Back button.
                 */
                expect(result[0].matchCount)
                    .toBe(1);

                expect(result[0].unique)
                    .toBe(false);

            } finally {
                await original.dispose();
            }
        },
    );


    test(
        'should reject duplicate CSS locators even when the original matches',
        async ({ page }) => {

            await page.setContent(`
                <button
                    id="backButton"
                    class="btn"
                >
                    Back
                </button>

                <button
                    id="continueButton"
                    class="btn"
                >
                    Continue
                </button>
            `);

            const original =
                await originalHandle(
                    page,
                    '#backButton',
                );

            try {
                const validator =
                    new LocatorValidator(page);

                const result =
                    await validator.validate(
                        [
                            candidate(
                                'css',
                                'button.btn',
                                'css=button.btn',
                            ),
                        ],
                        original,
                    );

                expect(result[0].matchCount)
                    .toBe(2);

                expect(result[0].unique)
                    .toBe(false);

            } finally {
                await original.dispose();
            }
        },
    );


    test(
        'should reject a missing locator with an original element',
        async ({ page }) => {

            await page.setContent(`
                <button id="backButton">
                    Back
                </button>
            `);

            const original =
                await originalHandle(
                    page,
                    '#backButton',
                );

            try {
                const validator =
                    new LocatorValidator(page);

                const result =
                    await validator.validate(
                        [
                            candidate(
                                'css',
                                'button.does-not-exist',
                                'css=button.does-not-exist',
                            ),
                        ],
                        original,
                    );

                expect(result[0].matchCount)
                    .toBe(0);

                expect(result[0].unique)
                    .toBe(false);

            } finally {
                await original.dispose();
            }
        },
    );


    test(
        'should validate a role locator against the original element',
        async ({ page }) => {

            await page.setContent(`
                <button id="backButton">
                    Back
                </button>

                <button id="continueButton">
                    Continue
                </button>
            `);

            const original =
                await originalHandle(
                    page,
                    '#backButton',
                );

            try {
                const validator =
                    new LocatorValidator(page);

                const result =
                    await validator.validate(
                        [
                            candidate(
                                'role',
                                'Back',
                                'role=button[name="Back"]',
                            ),
                        ],
                        original,
                    );

                expect(result[0].unique)
                    .toBe(true);

                expect(result[0].matchCount)
                    .toBe(1);

            } finally {
                await original.dispose();
            }
        },
    );

});
