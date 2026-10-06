import {
    mkdtemp,
    readFile,
    rm,
    writeFile,
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
    UpdateMode,
} from '../../../tools/pom-generator/modes/update-mode';

import {
    MetadataStore,
} from '../../../tools/pom-generator/metadata/metadata-store';

import {
    MetadataPathBuilder,
} from '../../../tools/pom-generator/metadata/metadata-path-builder';

import {
    PomOutputWriter,
} from '../../../tools/pom-generator/writers/pom-output-writer';

import {
    OutputPathBuilder,
} from '../../../tools/pom-generator/writers/output-path-builder';

import {
    RegenerationSnapshotManager,
} from '../../../tools/pom-generator/persistence/regeneration-snapshot-manager';

import {
    FileSnapshotManager,
} from '../../../tools/pom-generator/persistence/file-snapshot-manager';

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
            'stable-first-name',

        fingerprint: {
            type:
                'input',

            label:
                'first name',

            name:
                'firstname',
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
    'UpdateMode',
    () => {

        let temporaryDirectory:
            string;

        let automationRoot:
            string;

        let metadataRoot:
            string;

        let outputPathBuilder:
            OutputPathBuilder;

        let metadataPathBuilder:
            MetadataPathBuilder;

        let metadataStore:
            MetadataStore;

        let mode:
            UpdateMode;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-update-mode-',
                        ),
                    );


                automationRoot =
                    path.join(
                        temporaryDirectory,
                        'automationLayer',
                    );


                metadataRoot =
                    path.join(
                        temporaryDirectory,
                        '.pom-generator',
                        'metadata',
                    );


                outputPathBuilder =
                    new OutputPathBuilder(
                        automationRoot,
                    );


                metadataPathBuilder =
                    new MetadataPathBuilder(
                        metadataRoot,
                    );


                metadataStore =
                    new MetadataStore(
                        metadataPathBuilder,
                    );


                const pomOutputWriter =
                    new PomOutputWriter(
                        outputPathBuilder,
                    );


                const snapshotManager =
                    new RegenerationSnapshotManager(
                        outputPathBuilder,
                        metadataPathBuilder,
                        new FileSnapshotManager(),
                    );


                mode =
                    new UpdateMode(
                        metadataStore,
                        undefined,
                        undefined,
                        undefined,
                        pomOutputWriter,
                        snapshotManager,
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
            'should reject UPDATE when metadata does not exist',
            async () => {

                await expect(
                    mode.execute(
                        generatedPage(),
                        [],
                    ),
                ).rejects.toThrow(
                    'Cannot UPDATE POM because metadata does not exist: ' +
                    'AZO → CTM → Motor → policyholder-details',
                );
            },
        );


        test(
            'should reject UPDATE when a review decision is unresolved',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
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


                await expect(
                    mode.execute(
                        currentPage,
                        [],
                    ),
                ).rejects.toThrow(
                    'Cannot UPDATE POM because review decisions are unresolved: ' +
                    'stable-first-name',
                );


                const loaded =
                    await metadataStore.load(
                        currentPage,
                    );


                expect(loaded)
                    .toEqual(
                        existingPage,
                    );
            },
        );


        test(
            'should reject invalid review decision before writing',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const currentPage =
                    generatedPage({
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


                await expect(
                    mode.execute(
                        currentPage,
                        [
                            {
                                stableKey:
                                    'stable-first-name',

                                action:
                                    'REMOVE',
                            },
                        ],
                    ),
                ).rejects.toThrow(
                    'Review action REMOVE is not valid ' +
                    'for change type CHANGED ' +
                    '(firstName).',
                );


                const loaded =
                    await metadataStore.load(
                        currentPage,
                    );


                expect(loaded)
                    .toEqual(
                        existingPage,
                    );
            },
        );


        test(
            'should UPDATE an approved changed element',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
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


                const result =
                    await mode.execute(
                        currentPage,
                        [
                            {
                                stableKey:
                                    'stable-first-name',

                                action:
                                    'UPDATE',
                            },
                        ],
                    );


                expect(
                    result.updatedPage
                        .elements[0]
                        .stableKey,
                ).toBe(
                    'stable-first-name',
                );

                expect(
                    result.updatedPage
                        .elements[0]
                        .locator
                        .preferred,
                ).toBe(
                    'testid=first-name',
                );

                expect(
                    result.updatedPage
                        .scannedAt,
                ).toBe(
                    '2026-10-02T10:00:00.000Z',
                );


                const persisted =
                    await metadataStore.load(
                        currentPage,
                    );


                expect(
                    persisted
                        ?.elements[0]
                        .locator
                        .preferred,
                ).toBe(
                    'testid=first-name',
                );
            },
        );


        test(
            'should KEEP existing element when proposed change is rejected',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
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


                const result =
                    await mode.execute(
                        currentPage,
                        [
                            {
                                stableKey:
                                    'stable-first-name',

                                action:
                                    'KEEP',
                            },
                        ],
                    );


                expect(
                    result.updatedPage
                        .elements[0]
                        .locator
                        .preferred,
                ).toBe(
                    'label=First name',
                );

                expect(
                    result.updatedPage
                        .elements[0]
                        .stableKey,
                ).toBe(
                    'stable-first-name',
                );
            },
        );


        test(
            'should ADD an approved new element',
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
                        'stable-new-last-name',

                    fingerprint: {
                        type:
                            'input',

                        label:
                            'last name',

                        name:
                            'lastname',
                    },
                };


                const result =
                    await mode.execute(
                        generatedPage({
                            scannedAt:
                                '2026-10-02T10:00:00.000Z',

                            elements: [
                                firstNameElement(),
                                lastName,
                            ],
                        }),
                        [
                            {
                                stableKey:
                                    'stable-new-last-name',

                                action:
                                    'ADD',
                            },
                        ],
                    );


                expect(
                    result.updatedPage
                        .elements
                        .map(element =>
                            element.name,
                        ),
                ).toEqual([
                    'firstName',
                    'lastName',
                ]);
            },
        );


        test(
            'should REMOVE only when explicitly approved',
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

                            elements: [],
                        }),
                        [
                            {
                                stableKey:
                                    'stable-first-name',

                                action:
                                    'REMOVE',
                            },
                        ],
                    );


                expect(
                    result.updatedPage
                        .elements,
                ).toEqual([]);


                const persisted =
                    await metadataStore.load(
                        generatedPage(),
                    );


                expect(
                    persisted?.elements,
                ).toEqual([]);
            },
        );


        test(
            'should never overwrite developer-owned actions',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const firstResult =
                    await mode.execute(
                        generatedPage(),
                        [],
                    );


                const developerActions =
                    [
                        '// Developer-owned actions',
                        '',
                        'export class CustomActions {',
                        '}',
                        '',
                    ].join('\n');


                await writeFile(
                    firstResult.pom.actionsFile,
                    developerActions,
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
                    [
                        {
                            stableKey:
                                'stable-first-name',

                            action:
                                'UPDATE',
                        },
                    ],
                );


                const actionsAfter =
                    await readFile(
                        firstResult.pom.actionsFile,
                        'utf8',
                    );


                expect(actionsAfter)
                    .toBe(
                        developerActions,
                    );
            },
        );


        test(
            'should rollback UPDATE when metadata persistence fails',
            async () => {

                const existingPage =
                    generatedPage();


                await metadataStore.save(
                    existingPage,
                );


                const initialWriter =
                    new PomOutputWriter(
                        outputPathBuilder,
                    );


                const initialPom =
                    await initialWriter.write(
                        existingPage,
                    );


                const developerActions =
                    '// developer-owned actions\n';


                await writeFile(
                    initialPom.actionsFile,
                    developerActions,
                    'utf8',
                );


                const oldElements =
                    await readFile(
                        initialPom.elementsFile,
                        'utf8',
                    );

                const oldPage =
                    await readFile(
                        initialPom.pageFile,
                        'utf8',
                    );

                const metadataFile =
                    metadataPathBuilder.build(
                        existingPage,
                    );

                const oldMetadata =
                    await readFile(
                        metadataFile,
                        'utf8',
                    );


                class FailingMetadataStore
                    extends MetadataStore {

                    override async save(
                        _page: GeneratedPage,
                    ): Promise<never> {

                        throw new Error(
                            'Simulated metadata failure',
                        );
                    }
                }


                const failingMetadataStore =
                    new FailingMetadataStore(
                        metadataPathBuilder,
                    );


                const failingMode =
                    new UpdateMode(
                        failingMetadataStore,
                        undefined,
                        undefined,
                        undefined,

                        new PomOutputWriter(
                            outputPathBuilder,
                        ),

                        new RegenerationSnapshotManager(
                            outputPathBuilder,
                            metadataPathBuilder,
                            new FileSnapshotManager(),
                        ),
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


                await expect(
                    failingMode.execute(
                        currentPage,
                        [
                            {
                                stableKey:
                                    'stable-first-name',

                                action:
                                    'UPDATE',
                            },
                        ],
                    ),
                ).rejects.toThrow(
                    'Simulated metadata failure',
                );


                expect(
                    await readFile(
                        initialPom.elementsFile,
                        'utf8',
                    ),
                ).toBe(
                    oldElements,
                );


                expect(
                    await readFile(
                        initialPom.pageFile,
                        'utf8',
                    ),
                ).toBe(
                    oldPage,
                );


                expect(
                    await readFile(
                        metadataFile,
                        'utf8',
                    ),
                ).toBe(
                    oldMetadata,
                );


                expect(
                    await readFile(
                        initialPom.actionsFile,
                        'utf8',
                    ),
                ).toBe(
                    developerActions,
                );
            },
        );

    },
);