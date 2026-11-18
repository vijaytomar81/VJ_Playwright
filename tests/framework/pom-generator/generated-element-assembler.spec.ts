
import {
    test,
    expect,
} from '@playwright/test';

import type {
    ElementHandle,
} from '@playwright/test';

import {
    GeneratedElementAssembler,
} from '../../../tools/pom-generator/generators/generated-element-assembler';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';


function capturedElement(
    overrides: Partial<CapturedElement> = {},
): CapturedElement {
    return {
        tagName: 'input',
        type: 'input',
        visible: true,
        locatorCandidates: [],
        ...overrides,
    };
}


test.describe('GeneratedElementAssembler', () => {

    test(
        'should assemble a captured element into a generated element',
        async ({ page }) => {

            await page.setContent(`
                <label for="firstName">
                    First name
                </label>
                <input
                    id="firstName"
                    name="firstName"
                    data-testid="first-name"
                />
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const result =
                await assembler.assemble(
                    capturedElement({
                        label: 'First name',
                        id: 'firstName',
                        name: 'firstName',
                        testId: 'first-name',
                    }),
                );

            expect(result.name).toBe('firstName');
            expect(result.type).toBe('input');

            expect(result.locator.preferred)
                .toBe('label=First name');

            expect(result.locator.fallbacks)
                .toEqual([
                    'testid=first-name',
                    'css=#firstName',
                    'css=[name="firstName"]',
                ]);

            expect(result.stableKey).toBeTruthy();

            expect(result.fingerprint.label)
                .toBe('first name');
        },
    );


    test(
        'should select role locator for a button',
        async ({ page }) => {

            await page.setContent(`
                <button
                    id="continue"
                    data-testid="continue"
                >
                    Continue
                </button>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const result =
                await assembler.assemble(
                    capturedElement({
                        tagName: 'button',
                        type: 'button',
                        role: 'button',
                        text: 'Continue',
                        id: 'continue',
                        testId: 'continue',
                    }),
                );

            expect(result.name)
                .toBe('continueButton');

            expect(result.locator.preferred)
                .toBe(
                    'role=button[name="Continue"]',
                );

            expect(result.locator.fallbacks)
                .toEqual([
                    'testid=continue',
                    'css=#continue',
                ]);
        },
    );


    test(
        'should reject element when no unique locator can be generated',
        async ({ page }) => {

            await page.setContent(`
                <input placeholder="Search" />
                <input placeholder="Search" />
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            await expect(
                assembler.assemble(
                    capturedElement({
                        placeholder: 'Search',
                    }),
                ),
            ).rejects.toThrow(
                /Unable to generate a unique locator\./,
            );
        },
    );


    test(
        'should assemble multiple elements',
        async ({ page }) => {

            await page.setContent(`
                <label for="firstName">
                    First name
                </label>
                <input id="firstName" />

                <button id="continue">
                    Continue
                </button>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const elements: CapturedElement[] = [
                capturedElement({
                    label: 'First name',
                    id: 'firstName',
                }),
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Continue',
                    id: 'continue',
                }),
            ];

            const result =
                await assembler.assembleAll(elements);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('firstName');
            expect(result[1].name)
                .toBe('continueButton');
        },
    );


    test(
        'should generate different stable keys for different new elements',
        async ({ page }) => {

            await page.setContent(`
                <input id="firstName" />
                <input id="lastName" />
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const result =
                await assembler.assembleAll([
                    capturedElement({
                        id: 'firstName',
                    }),
                    capturedElement({
                        id: 'lastName',
                    }),
                ]);

            expect(result[0].stableKey)
                .not.toBe(result[1].stableKey);
        },
    );


    test(
        'should generate distinct contextual names for two Back buttons',
        async ({ page }) => {

            await page.setContent(`
                <div class="back-link-top">
                    <button class="btn">
                        Back
                    </button>
                </div>

                <a href="/dashboard">
                    <button class="btn">
                        Back
                    </button>
                </a>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const elements: CapturedElement[] = [
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                }),
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                }),
            ];

            const handles = await page
                .locator('button.btn')
                .elementHandles() as ElementHandle<HTMLElement>[];

            try {
                const result =
                    await assembler.assembleAllWithHandles(
                        elements.map(
                            (element, index) => ({
                                element,
                                handle: handles[index],
                            }),
                        ),
                    );

                expect(result).toHaveLength(2);

                expect(
                    result.map(element => element.name),
                ).toEqual([
                    'topBackButton',
                    'dashboardBackButton',
                ]);

                expect(
                    result.map(
                        element => element.locator.preferred,
                    ),
                ).toEqual([
                    'css=div.back-link-top button.btn',
                    'css=a[href="/dashboard"] button.btn',
                ]);

                expect(
                    new Set(
                        result.map(element => element.name),
                    ).size,
                ).toBe(2);

            } finally {
                await Promise.all(
                    handles.map(handle => handle.dispose()),
                );
            }
        },
    );


    test(
        'should preserve unique names when duplicate Back buttons exist',
        async ({ page }) => {

            await page.setContent(`
                <button id="continue">
                    Continue
                </button>

                <div class="back-link-top">
                    <button class="btn">
                        Back
                    </button>
                </div>

                <a href="/dashboard">
                    <button class="btn">
                        Back
                    </button>
                </a>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const elements: CapturedElement[] = [
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Continue',
                    id: 'continue',
                }),
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                }),
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                }),
            ];

            const handles = await page
                .locator('button')
                .elementHandles() as ElementHandle<HTMLElement>[];

            try {
                const result =
                    await assembler.assembleAllWithHandles(
                        elements.map(
                            (element, index) => ({
                                element,
                                handle: handles[index],
                            }),
                        ),
                    );

                expect(
                    result.map(element => element.name),
                ).toEqual([
                    'continueButton',
                    'topBackButton',
                    'dashboardBackButton',
                ]);

                expect(result[0].locator.preferred)
                    .toBeTruthy();

            } finally {
                await Promise.all(
                    handles.map(handle => handle.dispose()),
                );
            }
        },
    );


    test(
        'should preserve locators, fingerprints and unique stable keys after contextual renaming',
        async ({ page }) => {

            await page.setContent(`
                <div class="back-link-top">
                    <button class="btn">
                        Back
                    </button>
                </div>

                <a href="/dashboard">
                    <button class="btn">
                        Back
                    </button>
                </a>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const elements: CapturedElement[] = [
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                }),
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                }),
            ];

            const handles = await page
                .locator('button.btn')
                .elementHandles() as ElementHandle<HTMLElement>[];

            try {
                const individuallyAssembled =
                    await Promise.all(
                        elements.map(
                            (element, index) =>
                                assembler.assemble(
                                    element,
                                    handles[index],
                                ),
                        ),
                    );

                const batch =
                    await assembler.assembleAllWithHandles(
                        elements.map(
                            (element, index) => ({
                                element,
                                handle: handles[index],
                            }),
                        ),
                    );

                expect(
                    individuallyAssembled.map(
                        element => element.name,
                    ),
                ).toEqual([
                    'backButton',
                    'backButton',
                ]);

                expect(
                    batch.map(element => element.name),
                ).toEqual([
                    'topBackButton',
                    'dashboardBackButton',
                ]);

                for (
                    let index = 0;
                    index < batch.length;
                    index++
                ) {
                    expect(batch[index].locator)
                        .toEqual(
                            individuallyAssembled[index].locator,
                        );

                    expect(batch[index].fingerprint)
                        .toEqual(
                            individuallyAssembled[index].fingerprint,
                        );

                    expect(batch[index].stableKey)
                        .toBeTruthy();
                }

                expect(batch[0].stableKey)
                    .not.toBe(batch[1].stableKey);

            } finally {
                await Promise.all(
                    handles.map(handle => handle.dispose()),
                );
            }
        },
    );


    /*
     * UPDATED TEST:
     *
     * Distinct target IDs now provide valid
     * naming fallbacks even without meaningful
     * ancestor context.
     */
    test(
        'should resolve duplicate names using distinct element IDs',
        async ({ page }) => {

            await page.setContent(`
                <button id="first">
                    Back
                </button>

                <button id="second">
                    Back
                </button>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const elements: CapturedElement[] = [
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                    id: 'first',
                }),
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                    id: 'second',
                }),
            ];

            const result =
                await assembler.assembleAll(elements);

            expect(result).toHaveLength(2);

            expect(
                result.map(element => element.name),
            ).toEqual([
                'firstBackButton',
                'secondBackButton',
            ]);

            expect(
                result.map(
                    element => element.locator.preferred,
                ),
            ).toEqual([
                'css=#first',
                'css=#second',
            ]);

            expect(
                new Set(
                    result.map(element => element.name),
                ).size,
            ).toBe(result.length);

            expect(result[0].stableKey)
                .not.toBe(result[1].stableKey);
        },
    );


    /*
     * NEW NEGATIVE TEST:
     *
     * Two identical captured entries pointing
     * to the same DOM element must not receive
     * invented positional or numeric names.
     */
    test(
        'should reject duplicate names when target attributes and context are identical',
        async ({ page }) => {

            await page.setContent(`
                <button id="same-button">
                    Back
                </button>
            `);

            const assembler =
                new GeneratedElementAssembler(page);

            const identicalElement =
                capturedElement({
                    tagName: 'button',
                    type: 'button',
                    text: 'Back',
                    id: 'same-button',
                });

            await expect(
                assembler.assembleAll([
                    identicalElement,
                    { ...identicalElement },
                ]),
            ).rejects.toThrow(
                /Unable to resolve generated element name collision/,
            );
        },
    );

});
