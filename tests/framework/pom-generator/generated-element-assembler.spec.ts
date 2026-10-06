import {
    test,
    expect,
} from '@playwright/test';

import {
    GeneratedElementAssembler,
} from '../../../tools/pom-generator/generators/generated-element-assembler';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';


function capturedElement(
    overrides:
        Partial<CapturedElement> = {},
): CapturedElement {

    return {
        tagName: 'input',

        type: 'input',

        visible: true,

        locatorCandidates: [],

        ...overrides,
    };
}


test.describe(
    'GeneratedElementAssembler',
    () => {

        test(
            'should assemble a captured element into a generated element',
            async ({
                page,
            }) => {

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
                    new GeneratedElementAssembler(
                        page,
                    );


                const result =
                    await assembler.assemble(
                        capturedElement({
                            label:
                                'First name',

                            id:
                                'firstName',

                            name:
                                'firstName',

                            testId:
                                'first-name',
                        }),
                    );


                expect(result.name)
                    .toBe('firstName');

                expect(result.type)
                    .toBe('input');

                expect(
                    result.locator.preferred,
                ).toBe(
                    'label=First name',
                );

                expect(
                    result.locator.fallbacks,
                ).toEqual([
                    'testid=first-name',
                    'css=#firstName',
                    'css=[name="firstName"]',
                ]);

                expect(result.stableKey)
                    .toBeTruthy();

                expect(
                    result.fingerprint.label,
                ).toBe('first name');
            },
        );


        test(
            'should select role locator for a button',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <button
                        id="continue"
                        data-testid="continue"
                    >
                        Continue
                    </button>
                `);


                const assembler =
                    new GeneratedElementAssembler(
                        page,
                    );


                const result =
                    await assembler.assemble(
                        capturedElement({
                            tagName:
                                'button',

                            type:
                                'button',

                            role:
                                'button',

                            text:
                                'Continue',

                            id:
                                'continue',

                            testId:
                                'continue',
                        }),
                    );


                expect(result.name)
                    .toBe(
                        'continueButton',
                    );

                expect(
                    result.locator.preferred,
                ).toBe(
                    'role=button[name="Continue"]',
                );

                expect(
                    result.locator.fallbacks,
                ).toEqual([
                    'testid=continue',
                    'css=#continue',
                ]);
            },
        );


        test(
            'should reject element when no unique locator can be generated',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <input
                        placeholder="Search"
                    />

                    <input
                        placeholder="Search"
                    />
                `);


                const assembler =
                    new GeneratedElementAssembler(
                        page,
                    );


                await expect(
                    assembler.assemble(
                        capturedElement({
                            placeholder:
                                'Search',
                        }),
                    ),
                ).rejects.toThrow(
                    'Unable to generate a unique locator for the element.',
                );
            },
        );


        test(
            'should assemble multiple elements',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <label for="firstName">
                        First name
                    </label>

                    <input
                        id="firstName"
                    />

                    <button
                        id="continue"
                    >
                        Continue
                    </button>
                `);


                const assembler =
                    new GeneratedElementAssembler(
                        page,
                    );


                const elements:
                    CapturedElement[] = [

                        capturedElement({
                            label:
                                'First name',

                            id:
                                'firstName',
                        }),

                        capturedElement({
                            tagName:
                                'button',

                            type:
                                'button',

                            text:
                                'Continue',

                            id:
                                'continue',
                        }),
                    ];


                const result =
                    await assembler.assembleAll(
                        elements,
                    );


                expect(result)
                    .toHaveLength(2);

                expect(result[0].name)
                    .toBe('firstName');

                expect(result[1].name)
                    .toBe(
                        'continueButton',
                    );
            },
        );


        test(
            'should generate different stable keys for different new elements',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <input
                        id="firstName"
                    />

                    <input
                        id="lastName"
                    />
                `);


                const assembler =
                    new GeneratedElementAssembler(
                        page,
                    );


                const result =
                    await assembler.assembleAll([
                        capturedElement({
                            id:
                                'firstName',
                        }),

                        capturedElement({
                            id:
                                'lastName',
                        }),
                    ]);


                expect(
                    result[0].stableKey,
                ).not.toBe(
                    result[1].stableKey,
                );
            },
        );

    },
);