import {
    test,
    expect,
} from '@playwright/test';

import {
    LocatorCodeGenerator,
} from '../../../tools/pom-generator/locator/locator-code-generator';


test.describe(
    'LocatorCodeGenerator',
    () => {

        const generator =
            new LocatorCodeGenerator();


        test(
            'should generate role locator code',
            () => {

                const code =
                    generator.generate(
                        'role=button[name="Continue"]',
                    );


                expect(code)
                    .toBe(
                        [
                            'page.getByRole(',
                            '    "button",',
                            '    {',
                            '        name: "Continue",',
                            '        exact: true,',
                            '    },',
                            ')',
                        ].join('\n'),
                    );
            },
        );


        test(
            'should generate label locator code',
            () => {

                const code =
                    generator.generate(
                        'label=First name',
                    );


                expect(code)
                    .toBe(
                        [
                            'page.getByLabel(',
                            '    "First name",',
                            '    {',
                            '        exact: true,',
                            '    },',
                            ')',
                        ].join('\n'),
                    );
            },
        );


        test(
            'should generate testid locator code',
            () => {

                const code =
                    generator.generate(
                        'testid=continue',
                    );


                expect(code)
                    .toBe(
                        [
                            'page.getByTestId(',
                            '    "continue",',
                            ')',
                        ].join('\n'),
                    );
            },
        );


        test(
            'should generate placeholder locator code',
            () => {

                const code =
                    generator.generate(
                        'placeholder=Enter postcode',
                    );


                expect(code)
                    .toBe(
                        [
                            'page.getByPlaceholder(',
                            '    "Enter postcode",',
                            '    {',
                            '        exact: true,',
                            '    },',
                            ')',
                        ].join('\n'),
                    );
            },
        );


        test(
            'should generate css locator code',
            () => {

                const code =
                    generator.generate(
                        'css=#surname',
                    );


                expect(code)
                    .toBe(
                        [
                            'page.locator(',
                            '    "#surname",',
                            ')',
                        ].join('\n'),
                    );
            },
        );


        test(
            'should generate name css locator code',
            () => {

                const code =
                    generator.generate(
                        'css=[name="firstName"]',
                    );


                expect(code)
                    .toBe(
                        [
                            'page.locator(',
                            '    "[name=\\"firstName\\"]",',
                            ')',
                        ].join('\n'),
                    );
            },
        );


        test(
            'should safely escape locator values',
            () => {

                const code =
                    generator.generate(
                        'label=Customer "preferred" name',
                    );


                expect(code)
                    .toContain(
                        '"Customer \\"preferred\\" name"',
                    );
            },
        );


        test(
            'should support custom page variable',
            () => {

                const code =
                    generator.generate(
                        'testid=continue',
                        'browserPage',
                    );


                expect(code)
                    .toContain(
                        'browserPage.getByTestId(',
                    );
            },
        );


        test(
            'should reject unsupported descriptor',
            () => {

                expect(
                    () =>
                        generator.generate(
                            'xpath=//input',
                        ),
                ).toThrow(
                    'Unsupported locator descriptor: xpath=//input',
                );
            },
        );


        test(
            'should reject malformed role descriptor',
            () => {

                expect(
                    () =>
                        generator.generate(
                            'role=button',
                        ),
                ).toThrow(
                    'Invalid role locator descriptor: role=button',
                );
            },
        );

    },
);