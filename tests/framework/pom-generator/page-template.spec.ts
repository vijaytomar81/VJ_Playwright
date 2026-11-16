
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
            'should import generated elements definitions',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );

                expect(source)
                    .toContain(
                        "import { elements } from './elements';",
                    );
            },
        );


        test(
            'should reference the firstName element identifier',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );

                expect(source)
                    .toContain(
                        'elements.firstName.preferred',
                    );

                expect(source)
                    .toContain(
                        'this.firstName =',
                    );

                expect(source)
                    .toContain(
                        'resolveLocator(',
                    );

                expect(source)
                    .not.toContain(
                        'page.getByLabel(',
                    );
            },
        );


        test(
            'should reference the continueButton element identifier',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );

                expect(source)
                    .toContain(
                        'elements.continueButton.preferred',
                    );

                expect(source)
                    .toContain(
                        'this.continueButton =',
                    );

                expect(source)
                    .not.toContain(
                        'page.getByRole(',
                    );
            },
        );


        test(
            'should use the supplied shared resolver import path',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                        '../../../../tools/pom-generator/runtime/locator-resolver',
                    );

                expect(source)
                    .toContain(
                        'from "../../../../tools/pom-generator/runtime/locator-resolver";',
                    );

                expect(source)
                    .toContain(
                        'resolveLocator(',
                    );
            },
        );


        test(
            'should not embed locator descriptors in the page class',
            () => {

                const source =
                    template.render(
                        generatedPage(),
                    );

                expect(source)
                    .not.toContain(
                        'label=First name',
                    );

                expect(source)
                    .not.toContain(
                        'role=button[name="Continue"]',
                    );

                expect(source)
                    .not.toContain(
                        'LocatorCodeGenerator',
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

                expect(source)
                    .not.toContain(
                        'elements.firstName.preferred',
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

                expect(source)
                    .toContain(
                        'elements["first-name"].preferred',
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
