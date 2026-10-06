import {
    test,
    expect,
} from '@playwright/test';

import {
    ActionsTemplate,
} from '../../../tools/pom-generator/templates/actions.template';

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

        elements: [],

        ...overrides,
    };
}


test.describe(
    'ActionsTemplate',
    () => {

        const template =
            new ActionsTemplate();


        test(
            'should generate actions class',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        'export class PolicyholderDetailsActions {',
                    );
            },
        );


        test(
            'should import generated page',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        "from '../pages/policyholder-details/policyholder-details.page';",
                    );

                expect(source)
                    .toContain(
                        'PolicyholderDetailsPage,',
                    );
            },
        );


        test(
            'should inject page object through constructor',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .toContain(
                        'private readonly page: PolicyholderDetailsPage,',
                    );
            },
        );


        test(
            'should not generate actions from page elements',
            () => {

                const source =
                    template.render(
                        generatedPage({
                            elements: [
                                {
                                    name:
                                        'firstName',

                                    type:
                                        'input',

                                    locator: {
                                        preferred:
                                            'label=First name',

                                        fallbacks: [],
                                    },

                                    stableKey:
                                        'stable-001',

                                    fingerprint: {
                                        type:
                                            'input',
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

                                        fallbacks: [],
                                    },

                                    stableKey:
                                        'stable-002',

                                    fingerprint: {
                                        type:
                                            'button',
                                    },
                                },
                            ],
                        }),
                    );


                expect(source)
                    .not.toContain(
                        'firstName',
                    );

                expect(source)
                    .not.toContain(
                        'continueButton',
                    );

                expect(source)
                    .not.toContain(
                        'async ',
                    );
            },
        );


        test(
            'should not contain auto-generated overwrite warning',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );


                expect(source)
                    .not.toContain(
                        'AUTO-GENERATED FILE',
                    );

                expect(source)
                    .not.toContain(
                        'may be overwritten',
                    );
            },
        );

    },
);