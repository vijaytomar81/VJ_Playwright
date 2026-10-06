import {
    mkdtemp,
    readFile,
    rm,
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
    GeneratedElement,
    GeneratedPage,
} from '../../../tools/pom-generator/models/page.model';

import {
    ValidateMode,
} from '../../../tools/pom-generator/modes/validate-mode';

import {
    MetadataStore,
} from '../../../tools/pom-generator/metadata/metadata-store';

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


function firstNameElement(
    overrides:
        Partial<GeneratedElement> = {},
): GeneratedElement {

    return {
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
            'stable-existing-001',

        fingerprint: {
            type:
                'input',

            label:
                'first name',

            name:
                'firstName',
        },

        ...overrides,
    };
}


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
            firstNameElement(),
        ],

        ...overrides,
    };
}


test.describe(
    'ValidateMode',
    () => {

        let temporaryDirectory:
            string;

        let metadataStore:
            MetadataStore;

        let mode:
            ValidateMode;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-validate-mode-',
                        ),
                    );


                metadataStore =
                    new MetadataStore(
                        new MetadataPathBuilder(
                            temporaryDirectory,
                        ),
                    );


                mode =
                    new ValidateMode(
                        metadataStore,
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
            'should reject VALIDATE when metadata does not exist',
            async () => {

                const currentPage =
                    generatedPage();


                await expect(
                    mode.execute(
                        currentPage,
                    ),
                ).rejects.toThrow(
                    'Cannot VALIDATE POM because metadata does not exist: ' +
                    'AZO → CTM → Motor → policyholder-details',
                );
            },
        );


        test(
            'should report unchanged element without requiring review',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const result =
                    await mode.execute(
                        generatedPage({
                            scannedAt:
                                '2026-10-02T10:00:00.000Z',
                        }),
                    );


                expect(result.changes)
                    .toHaveLength(1);

                expect(result.changes[0].type)
                    .toBe(
                        'UNCHANGED',
                    );

                expect(
                    result.reviewPlan
                        .requiresReview,
                ).toBe(false);
            },
        );


        test(
            'should detect changed locator and preserve existing stable identity',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const currentElement =
                    firstNameElement({
                        stableKey:
                            'temporary-current-key',

                        locator: {
                            preferred:
                                'testid=first-name',

                            fallbacks: [
                                'css=#firstName',
                            ],
                        },
                    });


                const currentPage =
                    generatedPage({
                        scannedAt:
                            '2026-10-02T10:00:00.000Z',

                        elements: [
                            currentElement,
                        ],
                    });


                const result =
                    await mode.execute(
                        currentPage,
                    );


                expect(result.changes)
                    .toHaveLength(1);

                expect(result.changes[0].type)
                    .toBe(
                        'CHANGED',
                    );

                expect(
                    result.changes[0]
                        .current
                        ?.stableKey,
                ).toBe(
                    'stable-existing-001',
                );

                expect(
                    result.reviewPlan
                        .requiresReview,
                ).toBe(true);

                expect(
                    result.reviewPlan
                        .items[0]
                        .existingLocator,
                ).toBe(
                    'label=First name',
                );

                expect(
                    result.reviewPlan
                        .items[0]
                        .proposedLocator,
                ).toBe(
                    'testid=first-name',
                );
            },
        );


        test(
            'should detect a new element',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const lastName:
                    GeneratedElement = {
                    name:
                        'lastName',

                    type:
                        'input',

                    locator: {
                        preferred:
                            'label=Last name',

                        fallbacks: [],
                    },

                    stableKey:
                        'temporary-new-key',

                    fingerprint: {
                        type:
                            'input',

                        label:
                            'last name',

                        name:
                            'lastName',
                    },
                };


                const result =
                    await mode.execute(
                        generatedPage({
                            elements: [
                                firstNameElement(),
                                lastName,
                            ],
                        }),
                    );


                expect(
                    result.changes.some(
                        change =>
                            change.type ===
                            'NEW',
                    ),
                ).toBe(true);

                expect(
                    result.reviewPlan
                        .requiresReview,
                ).toBe(true);
            },
        );


        test(
            'should detect an element that is no longer found',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const result =
                    await mode.execute(
                        generatedPage({
                            elements: [],
                        }),
                    );


                expect(result.changes)
                    .toHaveLength(1);

                expect(result.changes[0].type)
                    .toBe(
                        'NOT_FOUND',
                    );

                expect(
                    result.reviewPlan
                        .items[0]
                        .allowedActions,
                ).toEqual([
                    'KEEP',
                    'REMOVE',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should not modify persisted metadata during validation',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const metadataFile =
                    new MetadataPathBuilder(
                        temporaryDirectory,
                    ).build(
                        existingPage,
                    );


                const before =
                    await readFile(
                        metadataFile,
                        'utf8',
                    );


                const currentPage =
                    generatedPage({
                        scannedAt:
                            '2026-10-02T10:00:00.000Z',

                        elements: [
                            firstNameElement({
                                stableKey:
                                    'temporary-current-key',

                                locator: {
                                    preferred:
                                        'testid=first-name',

                                    fallbacks: [],
                                },
                            }),
                        ],
                    });


                await mode.execute(
                    currentPage,
                );


                const after =
                    await readFile(
                        metadataFile,
                        'utf8',
                    );


                expect(after)
                    .toBe(before);
            },
        );

    },
);