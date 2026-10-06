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
    FileWriter,
} from '../../../tools/pom-generator/writers/file-writer';


test.describe(
    'FileWriter',
    () => {

        let temporaryDirectory:
            string;

        let writer:
            FileWriter;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-pom-generator-',
                        ),
                    );

                writer =
                    new FileWriter();
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
            'should create file and parent directories',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'customer-details',
                        'elements.ts',
                    );


                await writer.write(
                    filePath,
                    'first version',
                );


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                expect(content)
                    .toBe(
                        'first version',
                    );
            },
        );


        test(
            'should replace existing file when using write',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'elements.ts',
                    );


                await writer.write(
                    filePath,
                    'first version',
                );

                await writer.write(
                    filePath,
                    'second version',
                );


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                expect(content)
                    .toBe(
                        'second version',
                    );
            },
        );


        test(
            'should create missing file using writeIfMissing',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'actions',
                        'customer-details.actions.ts',
                    );


                const created =
                    await writer.writeIfMissing(
                        filePath,
                        'developer-owned actions',
                    );


                expect(created)
                    .toBe(true);


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                expect(content)
                    .toBe(
                        'developer-owned actions',
                    );
            },
        );


        test(
            'should never overwrite existing file using writeIfMissing',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'actions',
                        'customer-details.actions.ts',
                    );


                await writer.writeIfMissing(
                    filePath,
                    'developer changes',
                );


                const created =
                    await writer.writeIfMissing(
                        filePath,
                        'generated replacement',
                    );


                expect(created)
                    .toBe(false);


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                expect(content)
                    .toBe(
                        'developer changes',
                    );
            },
        );


        test(
            'should protect existing empty file using writeIfMissing',
            async () => {

                const filePath =
                    path.join(
                        temporaryDirectory,
                        'actions',
                        'empty.actions.ts',
                    );


                await writer.write(
                    filePath,
                    '',
                );


                const created =
                    await writer.writeIfMissing(
                        filePath,
                        'replacement',
                    );


                expect(created)
                    .toBe(false);


                const content =
                    await readFile(
                        filePath,
                        'utf8',
                    );


                expect(content)
                    .toBe('');
            },
        );

    },
);