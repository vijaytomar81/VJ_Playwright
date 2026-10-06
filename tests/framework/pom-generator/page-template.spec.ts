import {
    test,
    expect,
} from '@playwright/test';

import {
    PageTemplate,
} from '../../../tools/pom-generator/templates/page.template';

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
                    ],
                },

                stableKey:
                    'stable-001',

                fingerprint: {
                    type:
                        'input',

                    label:
                        'first name',
                },
            },

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

        ...overrides,
    };
}


test.describe(
    'PageTemplate',
    () => {

        const template =
            new PageTemplate();


        test(
            'should generate page class',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        'export class PolicyholderDetailsPage {',
                    );

                expect(source)
                    .toContain(
                        'readonly firstName: Locator;',
                    );

                expect(source)
                    .toContain(
                        'readonly continueButton: Locator;',
                    );
            },
        );


        test(
            'should generate native Playwright label locator',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        'page.getByLabel(',
                    );

                expect(source)
                    .toContain(
                        '"First name"',
                    );
            },
        );


        test(
            'should generate native Playwright role locator',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        'page.getByRole(',
                    );

                expect(source)
                    .toContain(
                        'name: "Continue"',
                    );
            },
        );


        test(
            'should not create runtime dependency on pom generator',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .not.toContain(
                        'tools/pom-generator',
                    );

                expect(source)
                    .not.toContain(
                        'LocatorCodeGenerator',
                    );

                expect(source)
                    .not.toContain(
                        'LocatorResolver',
                    );
            },
        );


        test(
            'should not import generated elements descriptors at runtime',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .not.toContain(
                        "from './elements'",
                    );

                expect(source)
                    .not.toContain(
                        'elements.firstName',
                    );
            },
        );


        test(
            'should generate empty page class when no elements exist',
            () => {

                const source =
                    template.render(
                        generatedPage({
                            elements: [],
                        }),
                    );


                expect(source)
                    .toContain(
                        'export class PolicyholderDetailsPage {',
                    );

                expect(source)
                    .toContain(
                        'constructor(',
                    );

                expect(source)
                    .not.toContain(
                        'readonly firstName',
                    );
            },
        );


        test(
            'should safely support non-standard element property names',
            () => {

                const page =
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
                                    'stable-003',

                                fingerprint: {
                                    type:
                                        'input',
                                },
                            },
                        ],
                    });


                const source =
                    template.render(page);


                expect(source)
                    .toContain(
                        'readonly "first-name": Locator;',
                    );

                expect(source)
                    .toContain(
                        'this["first-name"] =',
                    );
            },
        );


        test(
            'should include page generation metadata',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        '// pageKey: policyholder-details',
                    );

                expect(source)
                    .toContain(
                        '// scannedAt: 2026-10-01T10:00:00.000Z',
                    );
            },
        );

    },
);