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
    GeneratedPage,
} from '../../../tools/pom-generator/models/page.model';

import {
    PomOutputWriter,
} from '../../../tools/pom-generator/writers/pom-output-writer';

import {
    OutputPathBuilder,
} from '../../../tools/pom-generator/writers/output-path-builder';

import {
    FileWriter,
} from '../../../tools/pom-generator/writers/file-writer';

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

        ...overrides,
    };
}


test.describe(
    'PomOutputWriter',
    () => {

        let temporaryDirectory:
            string;

        let writer:
            PomOutputWriter;

        let pathBuilder:
            OutputPathBuilder;


        test.beforeEach(
            async () => {

                temporaryDirectory =
                    await mkdtemp(
                        path.join(
                            tmpdir(),
                            'allianz-pom-output-',
                        ),
                    );


                pathBuilder =
                    new OutputPathBuilder(
                        temporaryDirectory,
                    );


                writer =
                    new PomOutputWriter(
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
            'should write all three POM artifacts',
            async () => {

                const page =
                    generatedPage();


                const result =
                    await writer.write(
                        page,
                    );


                const elements =
                    await readFile(
                        result.elementsFile,
                        'utf8',
                    );

                const pageSource =
                    await readFile(
                        result.pageFile,
                        'utf8',
                    );

                const actions =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );


                expect(elements)
                    .toContain(
                        'firstName: {',
                    );

                expect(pageSource)
                    .toContain(
                        'export class PolicyholderDetailsPage {',
                    );

                expect(actions)
                    .toContain(
                        'export class PolicyholderDetailsActions {',
                    );

                expect(
                    result.actionsCreated,
                ).toBe(true);
            },
        );


        test(
            'should create Brand Channel Product structure',
            async () => {

                const result =
                    await writer.write(
                        generatedPage(),
                    );


                expect(
                    result.pageFile,
                ).toBe(
                    path.join(
                        temporaryDirectory,
                        'AZO',
                        'CTM',
                        'Motor',
                        'pages',
                        'policyholder-details',
                        'policyholder-details.page.ts',
                    ),
                );


                expect(
                    result.actionsFile,
                ).toBe(
                    path.join(
                        temporaryDirectory,
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
            'should regenerate generator-owned files',
            async () => {

                const firstPage =
                    generatedPage();


                const result =
                    await writer.write(
                        firstPage,
                    );


                const changedPage =
                    generatedPage({
                        elements: [
                            {
                                name:
                                    'surname',

                                type:
                                    'input',

                                locator: {
                                    preferred:
                                        'label=Surname',

                                    fallbacks: [],
                                },

                                stableKey:
                                    'stable-002',

                                fingerprint: {
                                    type:
                                        'input',

                                    label:
                                        'surname',
                                },
                            },
                        ],
                    });


                await writer.write(
                    changedPage,
                );


                const elements =
                    await readFile(
                        result.elementsFile,
                        'utf8',
                    );

                const pageSource =
                    await readFile(
                        result.pageFile,
                        'utf8',
                    );


                expect(elements)
                    .toContain(
                        'surname: {',
                    );

                expect(elements)
                    .not.toContain(
                        'firstName: {',
                    );

                expect(pageSource)
                    .toContain(
                        'readonly surname: Locator;',
                    );
            },
        );


        test(
            'should never overwrite developer-owned actions file',
            async () => {

                const page =
                    generatedPage();


                const firstResult =
                    await writer.write(
                        page,
                    );


                const developerContent =
                    [
                        '// Developer-owned code',
                        '',
                        'export class CustomActions {',
                        '    async doSomething(): Promise<void> { }',
                        '}',
                        '',
                    ].join('\n');


                const fileWriter =
                    new FileWriter();


                await fileWriter.write(
                    firstResult.actionsFile,
                    developerContent,
                );


                const secondResult =
                    await writer.write(
                        page,
                    );


                const actions =
                    await readFile(
                        secondResult.actionsFile,
                        'utf8',
                    );


                expect(
                    secondResult.actionsCreated,
                ).toBe(false);

                expect(actions)
                    .toBe(
                        developerContent,
                    );
            },
        );


        test(
            'should report actions as existing on second generation',
            async () => {

                const page =
                    generatedPage();


                const firstResult =
                    await writer.write(
                        page,
                    );

                const secondResult =
                    await writer.write(
                        page,
                    );


                expect(
                    firstResult.actionsCreated,
                ).toBe(true);

                expect(
                    secondResult.actionsCreated,
                ).toBe(false);
            },
        );

    },
);