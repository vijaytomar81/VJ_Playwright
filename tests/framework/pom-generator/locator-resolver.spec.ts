
import {
    test,
    expect,
} from '@playwright/test';

import {
    resolveLocator,
} from '../../../tools/pom-generator/runtime/locator-resolver';


test.describe(
    'LocatorResolver',
    () => {

        test(
            'should resolve role descriptor',
            async ({ page }) => {

                await page.setContent(
                    '<button>Continue</button>',
                );

                const locator =
                    resolveLocator(
                        page,
                        'role=button[name="Continue"]',
                    );

                await expect(locator)
                    .toHaveCount(1);
            },
        );


        test(
            'should resolve label descriptor',
            async ({ page }) => {

                await page.setContent(
                    '<label for="username">Username</label>' +
                    '<input id="username" />',
                );

                const locator =
                    resolveLocator(
                        page,
                        'label=Username',
                    );

                await expect(locator)
                    .toHaveCount(1);
            },
        );


        test(
            'should resolve testid descriptor',
            async ({ page }) => {

                await page.setContent(
                    '<input data-testid="username" />',
                );

                const locator =
                    resolveLocator(
                        page,
                        'testid=username',
                    );

                await expect(locator)
                    .toHaveCount(1);
            },
        );


        test(
            'should resolve placeholder descriptor',
            async ({ page }) => {

                await page.setContent(
                    '<input placeholder="Enter username" />',
                );

                const locator =
                    resolveLocator(
                        page,
                        'placeholder=Enter username',
                    );

                await expect(locator)
                    .toHaveCount(1);
            },
        );


        test(
            'should resolve CSS descriptor',
            async ({ page }) => {

                await page.setContent(
                    '<input id="username" />',
                );

                const locator =
                    resolveLocator(
                        page,
                        'css=#username',
                    );

                await expect(locator)
                    .toHaveCount(1);
            },
        );


        test(
            'should reject unsupported descriptors',
            async ({ page }) => {

                expect(
                    () => resolveLocator(
                        page,
                        'xpath=//input',
                    ),
                ).toThrow(
                    'Unsupported locator descriptor',
                );
            },
        );


        test(
            'should reject invalid role descriptors',
            async ({ page }) => {

                expect(
                    () => resolveLocator(
                        page,
                        'role=button',
                    ),
                ).toThrow(
                    'Invalid role locator descriptor',
                );
            },
        );


        test(
            'should preserve Playwright strictness',
            async ({ page }) => {

                await page.setContent(
                    '<button>Continue</button>' +
                    '<button>Continue</button>',
                );

                const locator =
                    resolveLocator(
                        page,
                        'role=button[name="Continue"]',
                    );

                await expect(locator)
                    .toHaveCount(2);

                await expect(
                    locator.click(),
                ).rejects.toThrow(
                    /strict mode violation/,
                );
            },
        );


        test(
            'should match label names exactly',
            async ({ page }) => {

                await page.setContent(
                    '<label for="a">Username</label>' +
                    '<input id="a" />' +
                    '<label for="b">Username confirmation</label>' +
                    '<input id="b" />',
                );

                const locator =
                    resolveLocator(
                        page,
                        'label=Username',
                    );

                await expect(locator)
                    .toHaveCount(1);
            },
        );

    },
);
