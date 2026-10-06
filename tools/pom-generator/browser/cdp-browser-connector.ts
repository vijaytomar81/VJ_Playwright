import {
    chromium,
} from '@playwright/test';

import type {
    Browser,
    Page,
} from '@playwright/test';


export interface CdpBrowserConnection {
    browser:
    Browser;

    page:
    Page;

    disconnect():
        Promise<void>;
}


export class CdpBrowserConnector {

    async connect(
        cdpEndpoint: string,
    ): Promise<CdpBrowserConnection> {

        const endpoint =
            cdpEndpoint.trim();


        if (!endpoint) {
            throw new Error(
                'CDP endpoint must not be empty.',
            );
        }


        const browser =
            await chromium.connectOverCDP(
                endpoint,
            );


        try {

            const page =
                await this.selectPage(
                    browser,
                );


            return {
                browser,
                page,

                disconnect:
                    async (): Promise<void> => {

                        await browser.close();
                    },
            };

        } catch (error) {

            await browser.close();

            throw error;
        }
    }


    selectPage(
        browser: Browser,
    ): Page {

        const contexts =
            browser.contexts();


        if (contexts.length === 0) {
            throw new Error(
                'No browser context was found in the CDP session.',
            );
        }


        const pages =
            contexts.flatMap(
                context =>
                    context.pages(),
            );


        if (pages.length === 0) {
            throw new Error(
                'No open page was found in the CDP session.',
            );
        }


        if (pages.length === 1) {
            return pages[0];
        }


        const usablePages =
            pages.filter(
                page =>
                    !this.isBlankPage(
                        page,
                    ),
            );


        if (usablePages.length === 1) {
            return usablePages[0];
        }


        if (usablePages.length === 0) {
            throw new Error(
                'Multiple pages were found in the CDP session, ' +
                'but none contains a usable page. ' +
                'Close unnecessary tabs and try again.',
            );
        }


        throw new Error(
            'Multiple usable pages were found in the CDP session. ' +
            'Close unnecessary tabs and leave only the page ' +
            'that should be scanned.',
        );
    }


    private isBlankPage(
        page: Page,
    ): boolean {

        const url =
            page.url();


        return (
            url === '' ||
            url === 'about:blank'
        );
    }
}