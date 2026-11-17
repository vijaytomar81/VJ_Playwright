
import {
    test,
    expect,
} from '@playwright/test';

import {
    resolveLocator,
    resolveElement,
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


        test(
            'should use preferred locator when available',
            async ({ page }) => {

                await page.setContent(
                    '<input data-testid="preferred" />' +
                    '<input data-testid="fallback" />',
                );

                const locator =
                    await resolveElement(
                        page,
                        {
                            preferred:
                                'testid=preferred',

                            fallbacks: [
                                'testid=fallback',
                            ],
                        },
                    );

                await expect(locator)
                    .toHaveAttribute(
                        'data-testid',
                        'preferred',
                    );
            },
        );


        test(
            'should use fallback when preferred is missing',
            async ({ page }) => {

                await page.setContent(
                    '<input data-testid="fallback" />',
                );

                const locator =
                    await resolveElement(
                        page,
                        {
                            preferred:
                                'testid=missing',

                            fallbacks: [
                                'testid=fallback',
                            ],
                        },
                        {
                            timeoutMs: 50,
                            fallbackTimeoutMs: 50,
                        },
                    );

                await expect(locator)
                    .toHaveAttribute(
                        'data-testid',
                        'fallback',
                    );
            },
        );


        test(
            'should try fallbacks in order',
            async ({ page }) => {

                await page.setContent(
                    '<input data-testid="second" />' +
                    '<input data-testid="third" />',
                );

                const locator =
                    await resolveElement(
                        page,
                        {
                            preferred:
                                'testid=missing',

                            fallbacks: [
                                'testid=first',
                                'testid=second',
                                'testid=third',
                            ],
                        },
                        {
                            timeoutMs: 50,
                            fallbackTimeoutMs: 50,
                        },
                    );

                await expect(locator)
                    .toHaveAttribute(
                        'data-testid',
                        'second',
                    );
            },
        );


        test(
            'should reject when all locators are missing',
            async ({ page }) => {

                await page.setContent(
                    '<div>No matching input</div>',
                );

                await expect(
                    resolveElement(
                        page,
                        {
                            preferred:
                                'testid=missing',

                            fallbacks: [
                                'label=Also missing',
                            ],
                        },
                        {
                            timeoutMs: 50,
                            fallbackTimeoutMs: 50,
                        },
                    ),
                ).rejects.toThrow(
                    /testid=missing/,
                );
            },
        );


        test(
            'should reject ambiguous preferred locator',
            async ({ page }) => {

                await page.setContent(
                    '<button>Continue</button>' +
                    '<button>Continue</button>' +
                    '<button data-testid="fallback">Other</button>',
                );

                await expect(
                    resolveElement(
                        page,
                        {
                            preferred:
                                'role=button[name="Continue"]',

                            fallbacks: [
                                'testid=fallback',
                            ],
                        },
                        {
                            timeoutMs: 50,
                            fallbackTimeoutMs: 50,
                        },
                    ),
                ).rejects.toThrow(
                    /ambiguous|multiple|matched/i,
                );
            },
        );


        test(
            'should reject ambiguous fallback locator',
            async ({ page }) => {

                await page.setContent(
                    '<input data-testid="duplicate" />' +
                    '<input data-testid="duplicate" />',
                );

                await expect(
                    resolveElement(
                        page,
                        {
                            preferred:
                                'testid=missing',

                            fallbacks: [
                                'testid=duplicate',
                            ],
                        },
                        {
                            timeoutMs: 50,
                            fallbackTimeoutMs: 50,
                        },
                    ),
                ).rejects.toThrow(
                    /ambiguous|multiple|matched/i,
                );
            },
        );


        test(
            'should reject invalid timeout values',
            async ({ page }) => {

                await expect(
                    resolveElement(
                        page,
                        {
                            preferred:
                                'testid=username',

                            fallbacks: [],
                        },
                        {
                            timeoutMs: -1,
                        },
                    ),
                ).rejects.toThrow();

                await expect(
                    resolveElement(
                        page,
                        {
                            preferred:
                                'testid=username',

                            fallbacks: [],
                        },
                        {
                            fallbackTimeoutMs:
                                Number.NaN,
                        },
                    ),
                ).rejects.toThrow();
            },
        );


        test(
            'should resolve updated locator definitions',
            async ({ page }) => {

                await page.setContent(
                    '<input data-testid="new-first-name" />',
                );

                const locator =
                    await resolveElement(
                        page,
                        {
                            preferred:
                                'testid=new-first-name',

                            fallbacks: [
                                'label=First name',
                            ],
                        },
                    );

                await locator.fill('Vijay');

                await expect(locator)
                    .toHaveValue('Vijay');
            },
        );

    },
);
