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
    RegenerationSnapshotManager,
} from '../../../tools/pom-generator/persistence/regeneration-snapshot-manager';

import {
    OutputPathBuilder,
} from '../../../tools/pom-generator/writers/output-path-builder';

import {
    MetadataPathBuilder,
} from '../../../tools/pom-generator/metadata/metadata-path-builder';

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

        elements: [],
    };
}


test.describe(
    'RegenerationSnapshotManager',
    () => {

        let temporaryDirectory:
            string;

        let outputPathBuilder:
            OutputPathBuilder;

        let metadataPathBuilder:
            MetadataPathBuilder;

        let manager:
            RegenerationSnapshotManager;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-regeneration-snapshot-',
                        ),
                    );


                outputPathBuilder =
                    new OutputPathBuilder(
                        path.join(
                            temporaryDirectory,
                            'automationLayer',
                        ),
                    );


                metadataPathBuilder =
                    new MetadataPathBuilder(
                        path.join(
                            temporaryDirectory,
                            '.pom-generator',
                            'metadata',
                        ),
                    );


                manager =
                    new RegenerationSnapshotManager(
                        outputPathBuilder,
                        metadataPathBuilder,
                        new FileSnapshotManager(),
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
            'should include actions in CREATE snapshot',
            async () => {

                const page =
                    generatedPage();

                const paths =
                    outputPathBuilder.build(
                        page,
                    );


                const snapshot =
                    await manager.capture(
                        page,
                        'CREATE',
                    );


                expect(
                    snapshot.files
                        .map(file =>
                            file.filePath,
                        ),
                ).toEqual([
                    paths.elementsFile,
                    paths.pageFile,
                    paths.actionsFile,
                    metadataPathBuilder.build(
                        page,
                    ),
                ]);
            },
        );


        test(
            'should exclude actions from UPDATE snapshot',
            async () => {

                const page =
                    generatedPage();

                const paths =
                    outputPathBuilder.build(
                        page,
                    );


                const snapshot =
                    await manager.capture(
                        page,
                        'UPDATE',
                    );


                expect(
                    snapshot.files
                        .map(file =>
                            file.filePath,
                        ),
                ).toEqual([
                    paths.elementsFile,
                    paths.pageFile,
                    metadataPathBuilder.build(
                        page,
                    ),
                ]);


                expect(
                    snapshot.files.some(
                        file =>
                            file.filePath ===
                            paths.actionsFile,
                    ),
                ).toBe(false);
            },
        );


        test(
            'should capture existing generated state',
            async () => {

                const page =
                    generatedPage();

                const paths =
                    outputPathBuilder.build(
                        page,
                    );


                await writeFileWithDirectories(
                    paths.elementsFile,
                    'old elements',
                );

                await writeFileWithDirectories(
                    paths.pageFile,
                    'old page',
                );


                const snapshot =
                    await manager.capture(
                        page,
                        'UPDATE',
                    );


                expect(
                    snapshot.files[0],
                ).toEqual({
                    filePath:
                        paths.elementsFile,

                    existed:
                        true,

                    content:
                        'old elements',
                });


                expect(
                    snapshot.files[1],
                ).toEqual({
                    filePath:
                        paths.pageFile,

                    existed:
                        true,

                    content:
                        'old page',
                });
            },
        );


        test(
            'should restore UPDATE state without touching actions',
            async () => {

                const page =
                    generatedPage();

                const paths =
                    outputPathBuilder.build(
                        page,
                    );

                const metadataFile =
                    metadataPathBuilder.build(
                        page,
                    );


                await writeFileWithDirectories(
                    paths.elementsFile,
                    'old elements',
                );

                await writeFileWithDirectories(
                    paths.pageFile,
                    'old page',
                );

                await writeFileWithDirectories(
                    paths.actionsFile,
                    'developer actions',
                );

                await writeFileWithDirectories(
                    metadataFile,
                    'old metadata',
                );


                const snapshot =
                    await manager.capture(
                        page,
                        'UPDATE',
                    );


                await writeFile(
                    paths.elementsFile,
                    'new elements',
                    'utf8',
                );

                await writeFile(
                    paths.pageFile,
                    'new page',
                    'utf8',
                );

                await writeFile(
                    paths.actionsFile,
                    'developer changed actions',
                    'utf8',
                );

                await writeFile(
                    metadataFile,
                    'new metadata',
                    'utf8',
                );


                await manager.restore(
                    snapshot,
                );


                expect(
                    await readFile(
                        paths.elementsFile,
                        'utf8',
                    ),
                ).toBe(
                    'old elements',
                );

                expect(
                    await readFile(
                        paths.pageFile,
                        'utf8',
                    ),
                ).toBe(
                    'old page',
                );

                expect(
                    await readFile(
                        metadataFile,
                        'utf8',
                    ),
                ).toBe(
                    'old metadata',
                );

                expect(
                    await readFile(
                        paths.actionsFile,
                        'utf8',
                    ),
                ).toBe(
                    'developer changed actions',
                );
            },
        );


        test(
            'should restore CREATE state including actions',
            async () => {

                const page =
                    generatedPage();

                const paths =
                    outputPathBuilder.build(
                        page,
                    );

                const metadataFile =
                    metadataPathBuilder.build(
                        page,
                    );


                const snapshot =
                    await manager.capture(
                        page,
                        'CREATE',
                    );


                await writeFileWithDirectories(
                    paths.elementsFile,
                    'new elements',
                );

                await writeFileWithDirectories(
                    paths.pageFile,
                    'new page',
                );

                await writeFileWithDirectories(
                    paths.actionsFile,
                    'new actions',
                );

                await writeFileWithDirectories(
                    metadataFile,
                    'new metadata',
                );


                await manager.restore(
                    snapshot,
                );


                for (
                    const filePath
                    of [
                        paths.elementsFile,
                        paths.pageFile,
                        paths.actionsFile,
                        metadataFile,
                    ]
                ) {

                    const restored =
                        await new FileSnapshotManager()
                            .capture(
                                filePath,
                            );


                    expect(
                        restored.existed,
                    ).toBe(false);
                }
            },
        );

    },
);


async function writeFileWithDirectories(
    filePath: string,
    content: string,
): Promise<void> {

    const {
        mkdir,
    } = await import(
        'node:fs/promises'
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
        content,
        'utf8',
    );
}