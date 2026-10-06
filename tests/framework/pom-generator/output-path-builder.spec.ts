import path from 'node:path';

import {
    test,
    expect,
} from '@playwright/test';

import {
    OutputPathBuilder,
} from '../../../tools/pom-generator/writers/output-path-builder';

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
    'OutputPathBuilder',
    () => {

        const builder =
            new OutputPathBuilder();


        test(
            'should build page directory',
            () => {

                const paths =
                    builder.build(
                        generatedPage(),
                    );


                expect(
                    paths.pageDirectory,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'policyholder-details',
                    ),
                );
            },
        );


        test(
            'should build actions directory',
            () => {

                const paths =
                    builder.build(
                        generatedPage(),
                    );


                expect(
                    paths.actionsDirectory,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'AZO',
                        'CTM',
                        'Motor',
                        'actions',
                    ),
                );
            },
        );


        test(
            'should build elements file path',
            () => {

                const paths =
                    builder.build(
                        generatedPage(),
                    );


                expect(
                    paths.elementsFile,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'policyholder-details',
                        'elements.ts',
                    ),
                );
            },
        );


        test(
            'should build page file path',
            () => {

                const paths =
                    builder.build(
                        generatedPage(),
                    );


                expect(
                    paths.pageFile,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'policyholder-details',
                        'policyholder-details.page.ts',
                    ),
                );
            },
        );


        test(
            'should build actions file path',
            () => {

                const paths =
                    builder.build(
                        generatedPage(),
                    );


                expect(
                    paths.actionsFile,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'AZO',
                        'CTM',
                        'Motor',
                        'actions',
                        'policyholder-details.actions.ts',
                    ),
                );
            },
        );


        test(
            'should preserve configured GoCo channel value',
            () => {

                const paths =
                    builder.build(
                        generatedPage({
                            brand:
                                Brands.BRI,

                            channel:
                                Channels.GOCO,

                            product:
                                Products.HOME,
                        }),
                    );


                expect(
                    paths.pageDirectory,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'BRI',
                        'GoCo',
                        'Home',
                        'pages',
                        'policyholder-details',
                    ),
                );
            },
        );


        test(
            'should support Ferry home structure',
            () => {

                const paths =
                    builder.build(
                        generatedPage({
                            brand:
                                Brands.FERRY,

                            channel:
                                Channels.DJ,

                            product:
                                Products.HOME,

                            pageName:
                                'Customer Address',

                            pageKey:
                                'customer-address',
                        }),
                    );


                expect(
                    paths.pageFile,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'FERRY',
                        'DJ',
                        'Home',
                        'pages',
                        'customer-address',
                        'customer-address.page.ts',
                    ),
                );


                expect(
                    paths.actionsFile,
                ).toBe(
                    path.join(
                        'automationLayer',
                        'FERRY',
                        'DJ',
                        'Home',
                        'actions',
                        'customer-address.actions.ts',
                    ),
                );
            },
        );

    },
);