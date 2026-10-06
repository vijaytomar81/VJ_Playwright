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
    GeneratedPage,
} from '../../../tools/pom-generator/models/page.model';

import {
    CreateMode,
} from '../../../tools/pom-generator/modes/create-mode';

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
                },
            },
        ],
    };
}


test.describe(
    'CreateMode',
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
            CreateMode;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-create-mode-',
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
                    new CreateMode(
                        pomOutputWriter,
                        metadataStore,
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
            'should CREATE POM artifacts and metadata',
            async () => {

                const page =
                    generatedPage();


                const result =
                    await mode.execute(
                        page,
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
                        'firstName: {',
                    );

                expect(pageSource)
                    .toContain(
                        'export class PolicyholderDetailsPage {',
                    );

                expect(actionsSource)
                    .toContain(
                        'export class PolicyholderDetailsActions {',
                    );


                const metadata =
                    await metadataStore.load(
                        page,
                    );


                expect(metadata)
                    .toEqual(
                        page,
                    );

                expect(result.metadataFile)
                    .toBe(
                        path.join(
                            metadataRoot,
                            'AZO',
                            'CTM',
                            'Motor',
                            'policyholder-details.json',
                        ),
                    );
            },
        );


        test(
            'should reject CREATE when metadata already exists',
            async () => {

                const page =
                    generatedPage();


                await mode.execute(
                    page,
                );


                await expect(
                    mode.execute(
                        page,
                    ),
                ).rejects.toThrow(
                    'Cannot CREATE POM because metadata already exists: ' +
                    'AZO → CTM → Motor → policyholder-details',
                );
            },
        );


        test(
            'should not overwrite developer actions on rejected second CREATE',
            async () => {

                const page =
                    generatedPage();


                const first =
                    await mode.execute(
                        page,
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
                    first.pom.actionsFile,
                    developerActions,
                    'utf8',
                );


                await expect(
                    mode.execute(
                        page,
                    ),
                ).rejects.toThrow();


                const actionsAfter =
                    await readFile(
                        first.pom.actionsFile,
                        'utf8',
                    );


                expect(actionsAfter)
                    .toBe(
                        developerActions,
                    );
            },
        );


        test(
            'should preserve stable identity in persisted metadata',
            async () => {

                const page =
                    generatedPage();


                await mode.execute(
                    page,
                );


                const metadata =
                    await metadataStore.load(
                        page,
                    );


                expect(
                    metadata
                        ?.elements[0]
                        .stableKey,
                ).toBe(
                    'stable-001',
                );

                expect(
                    metadata
                        ?.elements[0]
                        .fingerprint,
                ).toEqual({
                    type:
                        'input',

                    label:
                        'first name',
                });
            },
        );


        test(
            'should rollback CREATE when POM writing fails',
            async () => {

                const page =
                    generatedPage();


                class FailingPomOutputWriter
                    extends PomOutputWriter {

                    override async write(
                        generatedPage:
                            GeneratedPage,
                    ): Promise<never> {

                        const result =
                            await super.write(
                                generatedPage,
                            );


                        expect(
                            result.actionsCreated,
                        ).toBe(true);


                        throw new Error(
                            'Simulated CREATE write failure',
                        );
                    }
                }


                const failingMode =
                    new CreateMode(
                        new FailingPomOutputWriter(
                            outputPathBuilder,
                        ),

                        metadataStore,

                        new RegenerationSnapshotManager(
                            outputPathBuilder,
                            metadataPathBuilder,
                            new FileSnapshotManager(),
                        ),
                    );


                await expect(
                    failingMode.execute(
                        page,
                    ),
                ).rejects.toThrow(
                    'Simulated CREATE write failure',
                );


                const outputPaths =
                    outputPathBuilder.build(
                        page,
                    );


                const filePaths = [
                    outputPaths.elementsFile,
                    outputPaths.pageFile,
                    outputPaths.actionsFile,
                    metadataPathBuilder.build(
                        page,
                    ),
                ];


                const snapshotManager =
                    new FileSnapshotManager();


                for (
                    const filePath
                    of filePaths
                ) {

                    const snapshot =
                        await snapshotManager.capture(
                            filePath,
                        );


                    expect(
                        snapshot.existed,
                    ).toBe(false);
                }
            },
        );

    },
);