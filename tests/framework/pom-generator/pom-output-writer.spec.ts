
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
    overrides: Partial<GeneratedPage> = {},
): GeneratedPage {

    return {
        brand: Brands.AZO,
        channel: Channels.CTM,
        product: Products.MOTOR,
        pageName: 'Policyholder Details',
        pageKey: 'policyholder-details',
        scannedAt: '2026-10-01T10:00:00.000Z',

        elements: [
            {
                name: 'firstName',
                type: 'input',

                locator: {
                    preferred: 'label=First name',
                    fallbacks: [
                        'testid=first-name',
                    ],
                },

                stableKey: 'stable-001',

                fingerprint: {
                    type: 'input',
                    label: 'first name',
                },
            },
        ],

        ...overrides,
    };
}


test.describe(
    'PomOutputWriter',
    () => {

        let temporaryDirectory: string;

        let writer: PomOutputWriter;

        let pathBuilder: OutputPathBuilder;


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
                    await writer.write(page);

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

                expect(elements).toContain(
                    'firstName: {',
                );

                expect(pageSource).toContain(
                    'export class PolicyholderDetailsPage {',
                );

                expect(actions).toContain(
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

                expect(result.pageFile).toBe(
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

                expect(result.actionsFile).toBe(
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
                                name: 'surname',
                                type: 'input',

                                locator: {
                                    preferred:
                                        'label=Surname',
                                    fallbacks: [],
                                },

                                stableKey:
                                    'stable-002',

                                fingerprint: {
                                    type: 'input',
                                    label: 'surname',
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

                expect(elements).toContain(
                    'surname: {',
                );

                expect(elements).not.toContain(
                    'firstName: {',
                );

                expect(pageSource).toContain(
                    'async resolveSurname(): Promise<Locator>',
                );
            },
        );


        test(
            'should never overwrite developer-owned actions file',
            async () => {

                const page =
                    generatedPage();

                const firstResult =
                    await writer.write(page);

                const developerContent = [
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
                    await writer.write(page);

                const actions =
                    await readFile(
                        secondResult.actionsFile,
                        'utf8',
                    );

                expect(
                    secondResult.actionsCreated,
                ).toBe(false);

                expect(actions).toBe(
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
                    await writer.write(page);

                const secondResult =
                    await writer.write(page);

                expect(
                    firstResult.actionsCreated,
                ).toBe(true);

                expect(
                    secondResult.actionsCreated,
                ).toBe(false);
            },
        );


        test(
            'should connect generated page to elements.ts',
            async () => {

                const result =
                    await writer.write(
                        generatedPage(),
                    );

                const source =
                    await readFile(
                        result.pageFile,
                        'utf8',
                    );

                expect(source).toContain(
                    "import { elements } from './elements';",
                );

                expect(source).toContain(
                    'elements.firstName,',
                );

                expect(source).toContain(
                    'resolveElement(',
                );

                expect(source).not.toContain(
                    'page.getByLabel(',
                );
            },
        );


        test(
            'should generate a valid relative resolver import',
            async () => {

                const result =
                    await writer.write(
                        generatedPage(),
                    );

                const source =
                    await readFile(
                        result.pageFile,
                        'utf8',
                    );

                const resolverFile =
                    path.resolve(
                        process.cwd(),
                        'tools/pom-generator/runtime/locator-resolver.ts',
                    );

                const relativeImport =
                    path.relative(
                        path.dirname(
                            result.pageFile,
                        ),
                        resolverFile,
                    )
                        .replace(/\.ts$/, '')
                        .split(path.sep)
                        .join('/');

                const importPath =
                    relativeImport.startsWith('.')
                        ? relativeImport
                        : `./${relativeImport}`;

                expect(source).toContain(
                    `from ${JSON.stringify(importPath)};`,
                );

                const importedFile =
                    path.resolve(
                        path.dirname(
                            result.pageFile,
                        ),
                        `${importPath}.ts`,
                    );

                expect(importedFile).toBe(
                    resolverFile,
                );
            },
        );


        test(
            'should preserve engineer-renamed action methods',
            async () => {

                const page =
                    generatedPage();

                const result =
                    await writer.write(page);

                const original =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                expect(original).toContain(
                    'async fillFirstName(',
                );

                const renamed =
                    original.replace(
                        'async fillFirstName(',
                        'async enterCustomerFirstName(',
                    );

                await writeFile(
                    result.actionsFile,
                    renamed,
                    'utf8',
                );

                await writer.write(page);

                const regenerated =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                expect(regenerated).toContain(
                    'async enterCustomerFirstName(',
                );

                expect(regenerated).not.toContain(
                    'async fillFirstName(',
                );

                expect(regenerated).toContain(
                    'this.page.resolveFirstName()',
                );
            },
        );


        test(
            'should not duplicate renamed actions on repeated rescans',
            async () => {

                const page =
                    generatedPage();

                const result =
                    await writer.write(page);

                const original =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                await writeFile(
                    result.actionsFile,
                    original.replace(
                        'async fillFirstName(',
                        'async enterCustomerFirstName(',
                    ),
                    'utf8',
                );

                await writer.write(page);
                await writer.write(page);
                await writer.write(page);

                const actions =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                expect(
                    actions.match(
                        /async enterCustomerFirstName\(/g,
                    )?.length ?? 0,
                ).toBe(1);

                expect(actions).not.toContain(
                    'async fillFirstName(',
                );
            },
        );


        test(
            'should preserve renamed actions when locator changes',
            async () => {

                const page =
                    generatedPage();

                const result =
                    await writer.write(page);

                const original =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                await writeFile(
                    result.actionsFile,
                    original.replace(
                        'async fillFirstName(',
                        'async enterCustomerFirstName(',
                    ),
                    'utf8',
                );

                const changedPage =
                    generatedPage({
                        elements:
                            page.elements.map(
                                element => ({
                                    ...element,

                                    locator: {
                                        preferred:
                                            'testid=customer-first-name',

                                        fallbacks: [
                                            'label=First name',
                                        ],
                                    },
                                }),
                            ),
                    });

                await writer.write(
                    changedPage,
                );

                const actions =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                const elements =
                    await readFile(
                        result.elementsFile,
                        'utf8',
                    );

                expect(actions).toContain(
                    'async enterCustomerFirstName(',
                );

                expect(actions).not.toContain(
                    'async fillFirstName(',
                );

                expect(elements).toContain(
                    'testid=customer-first-name',
                );
            },
        );


        test(
            'should add new actions without duplicating renamed methods',
            async () => {

                const page =
                    generatedPage();

                const result =
                    await writer.write(page);

                const original =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                await writeFile(
                    result.actionsFile,
                    original.replace(
                        'async fillFirstName(',
                        'async enterCustomerFirstName(',
                    ),
                    'utf8',
                );

                const updatedPage =
                    generatedPage({
                        elements: [
                            ...page.elements,

                            {
                                name:
                                    'continueButton',

                                type:
                                    'button',

                                locator: {
                                    preferred:
                                        'role=button[name="Continue"]',

                                    fallbacks: [],
                                },

                                stableKey:
                                    'stable-continue',

                                fingerprint: {
                                    type: 'button',
                                    label: 'continue',
                                },
                            },
                        ],
                    });

                await writer.write(
                    updatedPage,
                );

                const actions =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                expect(actions).toContain(
                    'async enterCustomerFirstName(',
                );

                expect(actions).toContain(
                    'async clickContinueButton(',
                );

                expect(actions).not.toContain(
                    'async fillFirstName(',
                );
            },
        );


        test(
            'should reject ambiguous action identities',
            async () => {

                const page =
                    generatedPage();

                const result =
                    await writer.write(page);

                const original =
                    await readFile(
                        result.actionsFile,
                        'utf8',
                    );

                const duplicate = [
                    '',
                    '    async anotherFirstNameAction(value: string): Promise<void> {',
                    '        const locator = await this.page.resolveFirstName();',
                    '        await locator.fill(value);',
                    '    }',
                    '',
                ].join('\n');

                const modified =
                    original.replace(
                        /\n}\s*$/,
                        `${duplicate}\n}`,
                    );

                await writeFile(
                    result.actionsFile,
                    modified,
                    'utf8',
                );

                await expect(
                    writer.write(page),
                ).rejects.toThrow(
                    /Ambiguous existing action/,
                );
            },
        );
    },
);
