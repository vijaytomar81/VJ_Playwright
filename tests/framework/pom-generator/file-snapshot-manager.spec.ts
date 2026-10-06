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

import {
    FileSnapshotManager,
} from '../../../tools/pom-generator/persistence/file-snapshot-manager';


test.describe(
    'FileSnapshotManager',
    () => {

        let temporaryDirectory:
            string;

        let manager:
            FileSnapshotManager;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-file-snapshot-',
                        ),
                    );


                manager =
                    new FileSnapshotManager();
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
            'should capture existing file content',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'elements.ts',
                    );


                await writeFile(
                    filePath,
                    'existing content',
                    'utf8',
                );


                const snapshot =
                    await manager.capture(
                        filePath,
                    );


                expect(snapshot)
                    .toEqual({
                        filePath,
                        existed: true,
                        content:
                            'existing content',
                    });
            },
        );


        test(
            'should capture missing file',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'missing.ts',
                    );


                const snapshot =
                    await manager.capture(
                        filePath,
                    );


                expect(snapshot)
                    .toEqual({
                        filePath,
                        existed: false,
                    });
            },
        );


        test(
            'should restore previous file content',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'elements.ts',
                    );


                await writeFile(
                    filePath,
                    'before',
                    'utf8',
                );


                const snapshot =
                    await manager.capture(
                        filePath,
                    );


                await writeFile(
                    filePath,
                    'after',
                    'utf8',
                );


                await manager.restore(
                    snapshot,
                );


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                expect(content)
                    .toBe(
                        'before',
                    );
            },
        );


        test(
            'should remove file created after missing-file snapshot',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'generated.ts',
                    );


                const snapshot =
                    await manager.capture(
                        filePath,
                    );


                await writeFile(
                    filePath,
                    'generated content',
                    'utf8',
                );


                await manager.restore(
                    snapshot,
                );


                const after =
                    await manager.capture(
                        filePath,
                    );


                expect(after.existed)
                    .toBe(false);
            },
        );


        test(
            'should restore multiple files',
            async () => {

                const firstFile =
                    path.join(
                        temporaryDirectory,
                        'elements.ts',
                    );

                const secondFile =
                    path.join(
                        temporaryDirectory,
                        'page.ts',
                    );

                const thirdFile =
                    path.join(
                        temporaryDirectory,
                        'metadata.json',
                    );


                await writeFile(
                    firstFile,
                    'old elements',
                    'utf8',
                );

                await writeFile(
                    secondFile,
                    'old page',
                    'utf8',
                );


                const snapshots =
                    await manager.captureAll([
                        firstFile,
                        secondFile,
                        thirdFile,
                    ]);


                await writeFile(
                    firstFile,
                    'new elements',
                    'utf8',
                );

                await writeFile(
                    secondFile,
                    'new page',
                    'utf8',
                );

                await writeFile(
                    thirdFile,
                    'new metadata',
                    'utf8',
                );


                await manager.restoreAll(
                    snapshots,
                );


                expect(
                    await readFile(
                        firstFile,
                        'utf8',
                    ),
                ).toBe(
                    'old elements',
                );

                expect(
                    await readFile(
                        secondFile,
                        'utf8',
                    ),
                ).toBe(
                    'old page',
                );


                const metadataAfter =
                    await manager.capture(
                        thirdFile,
                    );


                expect(
                    metadataAfter.existed,
                ).toBe(false);
            },
        );


        test(
            'should preserve empty existing file during rollback',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'empty.ts',
                    );


                await writeFile(
                    filePath,
                    '',
                    'utf8',
                );


                const snapshot =
                    await manager.capture(
                        filePath,
                    );


                await writeFile(
                    filePath,
                    'replacement',
                    'utf8',
                );


                await manager.restore(
                    snapshot,
                );


                expect(
                    await readFile(
                        filePath,
                        'utf8',
                    ),
                ).toBe('');
            },
        );

    },
);