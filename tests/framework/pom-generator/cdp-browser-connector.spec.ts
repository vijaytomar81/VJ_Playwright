import {
    test,
    expect,
} from '@playwright/test';

import type {
    Browser,
    BrowserContext,
    Page,
} from '@playwright/test';

import {
    CdpBrowserConnector,
} from '../../../tools/pom-generator/browser/cdp-browser-connector';


function pageWithUrl(
    url: string,
): Page {

    return {
        url:
            () => url,
    } as Page;
}


function contextWithPages(
    pages: readonly Page[],
): BrowserContext {

    return {
        pages:
            () => [...pages],
    } as BrowserContext;
}


function browserWithContexts(
    contexts:
        readonly BrowserContext[],
): Browser {

    return {
        contexts:
            () => [...contexts],
    } as Browser;
}


test.describe(
    'CdpBrowserConnector',
    () => {

        const connector =
            new CdpBrowserConnector();


        test(
            'should reject an empty CDP endpoint before connecting',
            async () => {

                await expect(
                    connector.connect(
                        '   ',
                    ),
                ).rejects.toThrow(
                    'CDP endpoint must not be empty.',
                );
            },
        );


        test(
            'should reject when no browser context exists',
            () => {

                const browser =
                    browserWithContexts(
                        [],
                    );


                expect(
                    () =>
                        connector.selectPage(
                            browser,
                        ),
                ).toThrow(
                    'No browser context was found in the CDP session.',
                );
            },
        );


        test(
            'should reject when no open page exists',
            () => {

                const browser =
                    browserWithContexts([
                        contextWithPages(
                            [],
                        ),
                    ]);


                expect(
                    () =>
                        connector.selectPage(
                            browser,
                        ),
                ).toThrow(
                    'No open page was found in the CDP session.',
                );
            },
        );


        test(
            'should return the only open page',
            () => {

                const expectedPage =
                    pageWithUrl(
                        'https://example.test/policyholder',
                    );


                const browser =
                    browserWithContexts([
                        contextWithPages([
                            expectedPage,
                        ]),
                    ]);


                const result =
                    connector.selectPage(
                        browser,
                    );


                expect(result)
                    .toBe(
                        expectedPage,
                    );
            },
        );


        test(
            'should select the only non-blank page',
            () => {

                const blankPage =
                    pageWithUrl(
                        'about:blank',
                    );

                const expectedPage =
                    pageWithUrl(
                        'https://example.test/policyholder',
                    );


                const browser =
                    browserWithContexts([
                        contextWithPages([
                            blankPage,
                            expectedPage,
                        ]),
                    ]);


                const result =
                    connector.selectPage(
                        browser,
                    );


                expect(result)
                    .toBe(
                        expectedPage,
                    );
            },
        );


        test(
            'should find pages across multiple contexts',
            () => {

                const blankPage =
                    pageWithUrl(
                        'about:blank',
                    );

                const expectedPage =
                    pageWithUrl(
                        'https://example.test/policyholder',
                    );


                const browser =
                    browserWithContexts([
                        contextWithPages([
                            blankPage,
                        ]),

                        contextWithPages([
                            expectedPage,
                        ]),
                    ]);


                const result =
                    connector.selectPage(
                        browser,
                    );


                expect(result)
                    .toBe(
                        expectedPage,
                    );
            },
        );


        test(
            'should reject when multiple usable pages exist',
            () => {

                const browser =
                    browserWithContexts([
                        contextWithPages([
                            pageWithUrl(
                                'https://example.test/page-one',
                            ),

                            pageWithUrl(
                                'https://example.test/page-two',
                            ),
                        ]),
                    ]);


                expect(
                    () =>
                        connector.selectPage(
                            browser,
                        ),
                ).toThrow(
                    'Multiple usable pages were found in the CDP session. ' +
                    'Close unnecessary tabs and leave only the page ' +
                    'that should be scanned.',
                );
            },
        );


        test(
            'should reject when multiple pages exist but all are blank',
            () => {

                const browser =
                    browserWithContexts([
                        contextWithPages([
                            pageWithUrl(
                                'about:blank',
                            ),

                            pageWithUrl(
                                '',
                            ),
                        ]),
                    ]);


                expect(
                    () =>
                        connector.selectPage(
                            browser,
                        ),
                ).toThrow(
                    'Multiple pages were found in the CDP session, ' +
                    'but none contains a usable page. ' +
                    'Close unnecessary tabs and try again.',
                );
            },
        );

    },
);