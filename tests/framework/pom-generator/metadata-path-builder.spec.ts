import path from 'node:path';

import {
    test,
    expect,
} from '@playwright/test';

import type {
    GeneratedPage,
} from '../../../tools/pom-generator/models/page.model';

import {
    MetadataPathBuilder,
} from '../../../tools/pom-generator/metadata/metadata-path-builder';

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
    'MetadataPathBuilder',
    () => {

        test(
            'should build metadata path using configured hierarchy',
            () => {

                const builder =
                    new MetadataPathBuilder();


                expect(
                    builder.build(
                        generatedPage(),
                    ),
                ).toBe(
                    path.join(
                        '.pom-generator',
                        'metadata',
                        'AZO',
                        'CTM',
                        'Motor',
                        'policyholder-details.json',
                    ),
                );
            },
        );


        test(
            'should support custom metadata root',
            () => {

                const builder =
                    new MetadataPathBuilder(
                        'temporary-metadata',
                    );


                expect(
                    builder.build(
                        generatedPage(),
                    ),
                ).toBe(
                    path.join(
                        'temporary-metadata',
                        'AZO',
                        'CTM',
                        'Motor',
                        'policyholder-details.json',
                    ),
                );
            },
        );


        test(
            'should preserve configured GoCo channel value',
            () => {

                const builder =
                    new MetadataPathBuilder();


                expect(
                    builder.build(
                        generatedPage({
                            brand:
                                Brands.BRI,

                            channel:
                                Channels.GOCO,

                            product:
                                Products.HOME,
                        }),
                    ),
                ).toBe(
                    path.join(
                        '.pom-generator',
                        'metadata',
                        'BRI',
                        'GoCo',
                        'Home',
                        'policyholder-details.json',
                    ),
                );
            },
        );

    },
);