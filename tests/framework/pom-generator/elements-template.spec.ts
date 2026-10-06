import {
    test,
    expect,
} from '@playwright/test';

import {
    ElementsTemplate,
} from '../../../tools/pom-generator/templates/elements.template';

import type {
    GeneratedPage,
} from '../../../tools/pom-generator/models/page.model';

import {
    Brands,
} from '../../../configLayer/brand.config';

import {
    Channels,
} from '../../../configLayer/channel.config';

import {
    Products,
} from '../../../configLayer/product.config';


function generatedPage(
    overrides:
        Partial<GeneratedPage> = {},
): GeneratedPage {

    return {
        brand:
            Brands.AZO,

        channel:
            Channels.CTM,

        product:
            Products.MOTOR,

        pageName:
            'Policyholder Details',

        pageKey:
            'policyholder-details',

        scannedAt:
            '2026-10-01T10:00:00.000Z',

        elements: [
            {
                name:
                    'firstName',

                type:
                    'input',

                locator: {
                    preferred:
                        'label=First name',

                    fallbacks: [
                        'testid=first-name',
                        'css=#firstName',
                        'css=[name="firstName"]',
                    ],
                },

                stableKey:
                    'stable-001',

                fingerprint: {
                    type:
                        'input',

                    label:
                        'first name',

                    name:
                        'firstname',

                    context:
                        'policyholder details',
                },
            },
        ],

        ...overrides,
    };
}


test.describe(
    'ElementsTemplate',
    () => {

        const template =
            new ElementsTemplate();


        test(
            'should render elements TypeScript source',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        '// AUTO-GENERATED FILE.',
                    );

                expect(source)
                    .toContain(
                        '// pageKey: policyholder-details',
                    );

                expect(source)
                    .toContain(
                        '// scannedAt: 2026-10-01T10:00:00.000Z',
                    );

                expect(source)
                    .toContain(
                        'export const elements = {',
                    );

                expect(source)
                    .toContain(
                        'firstName: {',
                    );

                expect(source)
                    .toContain(
                        'type: "input"',
                    );

                expect(source)
                    .toContain(
                        'preferred: "label=First name"',
                    );

                expect(source)
                    .toContain(
                        '"testid=first-name"',
                    );

                expect(source)
                    .toContain(
                        'stableKey: "stable-001"',
                    );
            },
        );


        test(
            'should not expose fingerprint in runtime elements source',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .not.toContain(
                        'fingerprint',
                    );

                expect(source)
                    .not.toContain(
                        'policyholder details',
                    );
            },
        );


        test(
            'should render multiple elements',
            () => {

                const page =
                    generatedPage({
                        elements: [
                            ...generatedPage()
                                .elements,

                            {
                                name:
                                    'continueButton',

                                type:
                                    'button',

                                locator: {
                                    preferred:
                                        'role=button[name="Continue"]',

                                    fallbacks: [
                                        'testid=continue',
                                    ],
                                },

                                stableKey:
                                    'stable-002',

                                fingerprint: {
                                    type:
                                        'button',

                                    role:
                                        'button',

                                    text:
                                        'continue',
                                },
                            },
                        ],
                    });


                const source =
                    template.render(page);


                expect(source)
                    .toContain(
                        'firstName: {',
                    );

                expect(source)
                    .toContain(
                        'continueButton: {',
                    );

                expect(source)
                    .toContain(
                        'stableKey: "stable-002"',
                    );
            },
        );


        test(
            'should render empty elements collection',
            () => {

                const source =
                    template.render(
                        generatedPage({
                            elements: [],
                        }),
                    );


                expect(source)
                    .toContain(
                        'export const elements = {\n} as const;',
                    );
            },
        );


        test(
            'should safely escape generated string values',
            () => {

                const source =
                    template.render(
                        generatedPage({
                            elements: [
                                {
                                    name:
                                        'customerName',

                                    type:
                                        'input',

                                    locator: {
                                        preferred:
                                            'label=Customer "preferred" name',

                                        fallbacks: [
                                            'css=[name="customerName"]',
                                        ],
                                    },

                                    stableKey:
                                        'stable-"001"',

                                    fingerprint: {
                                        type:
                                            'input',
                                    },
                                },
                            ],
                        }),
                    );


                expect(source)
                    .toContain(
                        'preferred: "label=Customer \\"preferred\\" name"',
                    );

                expect(source)
                    .toContain(
                        'stableKey: "stable-\\"001\\""',
                    );
            },
        );


        test(
            'should quote invalid TypeScript property names',
            () => {

                const source =
                    template.render(
                        generatedPage({
                            elements: [
                                {
                                    name:
                                        'first-name',

                                    type:
                                        'input',

                                    locator: {
                                        preferred:
                                            'testid=first-name',

                                        fallbacks: [],
                                    },

                                    stableKey:
                                        'stable-001',

                                    fingerprint: {
                                        type:
                                            'input',
                                    },
                                },
                            ],
                        }),
                    );


                expect(source)
                    .toContain(
                        '"first-name": {',
                    );
            },
        );

    },
);