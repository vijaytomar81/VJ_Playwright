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

import {
    CreateRunner,
} from '../../../tools/pom-generator/runners/create-runner';

import {
    CreateMode,
} from '../../../tools/pom-generator/modes/create-mode';

import {
    PomOutputWriter,
} from '../../../tools/pom-generator/writers/pom-output-writer';

import {
    OutputPathBuilder,
} from '../../../tools/pom-generator/writers/output-path-builder';

import {
    MetadataStore,
} from '../../../tools/pom-generator/metadata/metadata-store';

import {
    MetadataPathBuilder,
} from '../../../tools/pom-generator/metadata/metadata-path-builder';

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


test.describe(
    'CreateRunner',
    () => {

        let temporaryDirectory:
            string;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-create-runner-',
                        ),
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
            'should scan page and CREATE generated POM',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <html>
                        <body>
                            <label for="firstName">
                                First name
                            </label>

                            <input
                                id="firstName"
                                name="firstName"
                            />

                            <button
                                id="continueButton"
                                name="continueButton"
                                data-testid="continue-button"
                            >
                                Continue
                            </button>
                        </body>
                    </html>
                `);


                const automationRoot =
                    path.join(
                        temporaryDirectory,
                        'automationLayer',
                    );

                const metadataRoot =
                    path.join(
                        temporaryDirectory,
                        '.pom-generator',
                        'metadata',
                    );


                const outputPathBuilder =
                    new OutputPathBuilder(
                        automationRoot,
                    );

                const metadataPathBuilder =
                    new MetadataPathBuilder(
                        metadataRoot,
                    );


                const metadataStore =
                    new MetadataStore(
                        metadataPathBuilder,
                    );


                const createMode =
                    new CreateMode(
                        new PomOutputWriter(
                            outputPathBuilder,
                        ),

                        metadataStore,

                        new RegenerationSnapshotManager(
                            outputPathBuilder,
                            metadataPathBuilder,
                            new FileSnapshotManager(),
                        ),
                    );


                const runner =
                    new CreateRunner(
                        createMode,
                    );


                const result =
                    await runner.run(
                        page,
                        {
                            brand:
                                Brands.AZO,

                            channel:
                                Channels.CTM,

                            product:
                                Products.MOTOR,

                            pageName:
                                'Policyholder Details',
                        },
                    );


                expect(
                    result.pom.elementsFile,
                ).toBe(
                    path.join(
                        automationRoot,
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'policyholder-details',
                        'elements.ts',
                    ),
                );


                expect(
                    result.pom.pageFile,
                ).toBe(
                    path.join(
                        automationRoot,
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'policyholder-details',
                        'policyholder-details.page.ts',
                    ),
                );


                expect(
                    result.pom.actionsFile,
                ).toBe(
                    path.join(
                        automationRoot,
                        'AZO',
                        'CTM',
                        'Motor',
                        'actions',
                        'policyholder-details.actions.ts',
                    ),
                );


                const elementsSource =
                    await readFile(
                        result.pom.elementsFile,
                        'utf8',
                    );

                const pageSource =
                    await readFile(
                        result.pom.pageFile,
                        'utf8',
                    );

                const actionsSource =
                    await readFile(
                        result.pom.actionsFile,
                        'utf8',
                    );


                expect(elementsSource)
                    .toContain(
                        'firstName',
                    );

                expect(pageSource)
                    .toContain(
                        'export class PolicyholderDetailsPage',
                    );

                expect(actionsSource)
                    .toContain(
                        'export class PolicyholderDetailsActions',
                    );


                const metadata =
                    await metadataStore.load({
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
                            '',

                        elements:
                            [],
                    });


                expect(metadata)
                    .toBeDefined();

                expect(metadata?.brand)
                    .toBe(
                        Brands.AZO,
                    );

                expect(metadata?.channel)
                    .toBe(
                        Channels.CTM,
                    );

                expect(metadata?.product)
                    .toBe(
                        Products.MOTOR,
                    );

                expect(metadata?.pageName)
                    .toBe(
                        'Policyholder Details',
                    );

                expect(
                    metadata
                        ?.elements
                        .length,
                ).toBeGreaterThan(
                    0,
                );
            },
        );


        test(
            'should reject invalid Brand Channel Product hierarchy',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <input
                        aria-label="First name"
                    />
                `);


                const automationRoot =
                    path.join(
                        temporaryDirectory,
                        'automationLayer',
                    );

                const metadataRoot =
                    path.join(
                        temporaryDirectory,
                        '.pom-generator',
                        'metadata',
                    );


                const outputPathBuilder =
                    new OutputPathBuilder(
                        automationRoot,
                    );

                const metadataPathBuilder =
                    new MetadataPathBuilder(
                        metadataRoot,
                    );


                const runner =
                    new CreateRunner(
                        new CreateMode(
                            new PomOutputWriter(
                                outputPathBuilder,
                            ),

                            new MetadataStore(
                                metadataPathBuilder,
                            ),

                            new RegenerationSnapshotManager(
                                outputPathBuilder,
                                metadataPathBuilder,
                                new FileSnapshotManager(),
                            ),
                        ),
                    );


                await expect(
                    runner.run(
                        page,
                        {
                            brand:
                                Brands.FERRY,

                            channel:
                                Channels.CTM,

                            product:
                                Products.MOTOR,

                            pageName:
                                'Policyholder Details',
                        },
                    ),
                ).rejects.toThrow(
                    'Invalid Brand → Channel → Product combination: ' +
                    'FERRY → CTM → Motor',
                );
            },
        );


        test(
            'should reject duplicate CREATE through existing metadata',
            async ({
                page,
            }) => {

                await page.setContent(`
                    <label for="firstName">
                        First name
                    </label>

                    <input
                        id="firstName"
                    />
                `);


                const automationRoot =
                    path.join(
                        temporaryDirectory,
                        'automationLayer',
                    );

                const metadataRoot =
                    path.join(
                        temporaryDirectory,
                        '.pom-generator',
                        'metadata',
                    );


                const outputPathBuilder =
                    new OutputPathBuilder(
                        automationRoot,
                    );

                const metadataPathBuilder =
                    new MetadataPathBuilder(
                        metadataRoot,
                    );


                const runner =
                    new CreateRunner(
                        new CreateMode(
                            new PomOutputWriter(
                                outputPathBuilder,
                            ),

                            new MetadataStore(
                                metadataPathBuilder,
                            ),

                            new RegenerationSnapshotManager(
                                outputPathBuilder,
                                metadataPathBuilder,
                                new FileSnapshotManager(),
                            ),
                        ),
                    );


                const input = {
                    brand:
                        Brands.AZO,

                    channel:
                        Channels.CTM,

                    product:
                        Products.MOTOR,

                    pageName:
                        'Policyholder Details',
                } as const;


                await runner.run(
                    page,
                    input,
                );


                await expect(
                    runner.run(
                        page,
                        input,
                    ),
                ).rejects.toThrow(
                    'Cannot CREATE POM because metadata already exists: ' +
                    'AZO → CTM → Motor → policyholder-details',
                );
            },
        );

    },
);