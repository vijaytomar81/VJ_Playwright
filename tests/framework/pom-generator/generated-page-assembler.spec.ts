import {
    test,
    expect,
} from '@playwright/test';

import {
    GeneratedPageAssembler,
} from '../../../tools/pom-generator/generators/generated-page-assembler';

import {
    Brands,
} from '../../../configLayer/brand.config';

import {
    Channels,
} from '../../../configLayer/channel.config';

import {
    Products,
} from '../../../configLayer/product.config';


test.describe(
    'GeneratedPageAssembler',
    () => {

        test(
            'should assemble a complete generated page',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <section>
                        <h1>
                            Policyholder Details
                        </h1>

                        <label for="firstName">
                            First name
                        </label>

                        <input
                            id="firstName"
                            name="firstName"
                            data-testid="first-name"
                        />

                        <button
                            id="continue"
                            aria-label="Continue"
                        >
                            Continue
                        </button>
                    </section>
                `);


                const assembler =
                    new GeneratedPageAssembler(
                        page,
                    );


                const result =
                    await assembler.assemble({
                        brand:
                            Brands.AZO,

                        channel:
                            Channels.CTM,

                        product:
                            Products.MOTOR,

                        pageName:
                            'Policyholder Details',
                    });


                expect(result.brand)
                    .toBe(Brands.AZO);

                expect(result.channel)
                    .toBe(Channels.CTM);

                expect(result.product)
                    .toBe(Products.MOTOR);

                expect(result.pageName)
                    .toBe(
                        'Policyholder Details',
                    );

                expect(result.pageKey)
                    .toBe(
                        'policyholder-details',
                    );

                expect(result.scannedAt)
                    .toBeTruthy();

                expect(
                    Number.isNaN(
                        Date.parse(
                            result.scannedAt,
                        ),
                    ),
                ).toBe(false);

                expect(result.elements)
                    .toHaveLength(2);


                const firstName =
                    result.elements.find(
                        element =>
                            element.name ===
                            'firstName',
                    );


                expect(firstName)
                    .toBeDefined();

                expect(
                    firstName
                        ?.locator
                        .preferred,
                ).toBe(
                    'label=First name',
                );


                const continueButton =
                    result.elements.find(
                        element =>
                            element.name ===
                            'continueButton',
                    );


                expect(continueButton)
                    .toBeDefined();
            },
        );


        test(
            'should trim and normalize page name',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <input
                        id="postcode"
                    />
                `);


                const assembler =
                    new GeneratedPageAssembler(
                        page,
                    );


                const result =
                    await assembler.assemble({
                        brand:
                            Brands.AZO,

                        channel:
                            Channels.CTM,

                        product:
                            Products.HOME,

                        pageName:
                            '  Address Details  ',
                    });


                expect(result.pageName)
                    .toBe(
                        'Address Details',
                    );

                expect(result.pageKey)
                    .toBe(
                        'address-details',
                    );
            },
        );


        test(
            'should reject an invalid Brand Channel Product combination',
            async ({
                page,
            }) => {

                const assembler =
                    new GeneratedPageAssembler(
                        page,
                    );


                await expect(
                    assembler.assemble({
                        brand:
                            Brands.BRI,

                        channel:
                            Channels.CNF,

                        product:
                            Products.HOME,

                        pageName:
                            'Policyholder Details',
                    }),
                ).rejects.toThrow(
                    'Invalid Brand → Channel → Product combination: ' +
                    'BRI → CNF → Home',
                );
            },
        );


        test(
            'should reject an empty page name before scanning',
            async ({
                page,
            }) => {

                const assembler =
                    new GeneratedPageAssembler(
                        page,
                    );


                await expect(
                    assembler.assemble({
                        brand:
                            Brands.AZO,

                        channel:
                            Channels.CTM,

                        product:
                            Products.MOTOR,

                        pageName:
                            '   ',
                    }),
                ).rejects.toThrow(
                    'Page name cannot be empty.',
                );
            },
        );


        test(
            'should support a page with no capturable elements',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <main>
                        <h1>
                            Information
                        </h1>

                        <p>
                            Nothing to complete here.
                        </p>
                    </main>
                `);


                const assembler =
                    new GeneratedPageAssembler(
                        page,
                    );


                const result =
                    await assembler.assemble({
                        brand:
                            Brands.FERRY,

                        channel:
                            Channels.DJ,

                        product:
                            Products.HOME,

                        pageName:
                            'Information',
                    });


                expect(result.elements)
                    .toEqual([]);
            },
        );

    },
);