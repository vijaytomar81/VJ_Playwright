import {
    mkdtemp,
    readFile,
    rm,
    writeFile,
    mkdir,
} from 'node:fs/promises';

import {
    tmpdir,
} from 'node:os';

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
    MetadataStore,
} from '../../../tools/pom-generator/metadata/metadata-store';

import {
    Brands,
} from '../../../configLayer/brand.config';

import {
    Channels,
} from '../../../configLayer/channel.config';

import {
    Products,
} from '../../../configLayer/product.config';


function generatedPage(): GeneratedPage {

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

                    context:
                        'personal details',
                },
            },
        ],
    };
}


test.describe(
    'MetadataStore',
    () => {

        let temporaryDirectory:
            string;

        let pathBuilder:
            MetadataPathBuilder;

        let store:
            MetadataStore;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-pom-metadata-',
                        ),
                    );


                pathBuilder =
                    new MetadataPathBuilder(
                        temporaryDirectory,
                    );


                store =
                    new MetadataStore(
                        pathBuilder,
                    );
            },
        );


        test.afterEach(
            async () => {

                await rm(
                    temporaryDirectory,
                    {
                        recursive: true,
                        force: true,
                    },
                );
            },
        );


        test(
            'should save generated page metadata',
            async () => {

                const page =
                    generatedPage();


                const filePath =
                    await store.save(
                        page,
                    );


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                const saved =
                    JSON.parse(
                        content,
                    ) as GeneratedPage;


                expect(saved)
                    .toEqual(
                        page,
                    );
            },
        );


        test(
            'should persist stable key and fingerprint',
            async () => {

                const page =
                    generatedPage();


                const filePath =
                    await store.save(
                        page,
                    );


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                const saved =
                    JSON.parse(
                        content,
                    ) as GeneratedPage;


                expect(
                    saved.elements[0]
                        .stableKey,
                ).toBe(
                    'stable-001',
                );

                expect(
                    saved.elements[0]
                        .fingerprint,
                ).toEqual({
                    type:
                        'input',

                    label:
                        'first name',

                    context:
                        'personal details',
                });
            },
        );


        test(
            'should load previously saved metadata',
            async () => {

                const page =
                    generatedPage();


                await store.save(
                    page,
                );


                const loaded =
                    await store.load(
                        page,
                    );


                expect(loaded)
                    .toEqual(
                        page,
                    );
            },
        );


        test(
            'should return undefined when metadata does not exist',
            async () => {

                const loaded =
                    await store.load(
                        generatedPage(),
                    );


                expect(loaded)
                    .toBeUndefined();
            },
        );


        test(
            'should replace existing metadata on save',
            async () => {

                const first =
                    generatedPage();


                await store.save(
                    first,
                );


                const second:
                    GeneratedPage = {
                    ...first,

                    scannedAt:
                        '2026-10-02T11:00:00.000Z',

                    elements: [
                        {
                            ...first.elements[0],

                            locator: {
                                preferred:
                                    'testid=first-name',

                                fallbacks: [],
                            },
                        },
                    ],
                };


                await store.save(
                    second,
                );


                const loaded =
                    await store.load(
                        second,
                    );


                expect(loaded)
                    .toEqual(
                        second,
                    );
            },
        );


        test(
            'should throw when metadata contains invalid JSON',
            async () => {

                const page =
                    generatedPage();

                const filePath =
                    pathBuilder.build(
                        page,
                    );


                await mkdir(
                    path.dirname(
                        filePath,
                    ),
                    {
                        recursive: true,
                    },
                );


                await writeFile(
                    filePath,
                    '{ invalid json',
                    'utf8',
                );


                await expect(
                    store.load(
                        page,
                    ),
                ).rejects.toThrow();
            },
        );

        test(
            'should create metadata using saveIfMissing',
            async () => {

                const page =
                    generatedPage();


                const filePath =
                    await store.saveIfMissing(
                        page,
                    );


                expect(filePath)
                    .toBe(
                        pathBuilder.build(
                            page,
                        ),
                    );


                const loaded =
                    await store.load(
                        page,
                    );


                expect(loaded)
                    .toEqual(
                        page,
                    );
            },
        );


        test(
            'should not overwrite existing metadata using saveIfMissing',
            async () => {

                const first =
                    generatedPage();


                await store.saveIfMissing(
                    first,
                );


                const second:
                    GeneratedPage = {
                    ...first,

                    scannedAt:
                        '2026-10-02T11:00:00.000Z',
                };


                const filePath =
                    await store.saveIfMissing(
                        second,
                    );


                expect(filePath)
                    .toBeUndefined();


                const loaded =
                    await store.load(
                        first,
                    );


                expect(loaded)
                    .toEqual(
                        first,
                    );
            },
        );

    },
);