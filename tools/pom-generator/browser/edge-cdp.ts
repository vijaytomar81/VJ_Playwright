
import {
    chromium,
    type Browser,
    type BrowserContext,
    type Page,
} from '@playwright/test';

export interface EdgeCdpOptions {
    endpoint: string;
    urlContains?: string;
    titleContains?: string;
    tabIndex?: number;
    timeoutMs?: number;
}

export interface EdgeCdpSession {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    disconnect(): Promise<void>;
}

export interface EdgeTabInfo {
    index: number;
    title: string;
    url: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function normalize(value: string | undefined): string {
    return (value ?? '').trim();
}

function validateOptions(options: EdgeCdpOptions): void {
    if (!normalize(options.endpoint)) {
        throw new Error('Edge CDP endpoint must not be empty.');
    }

    if (
        options.tabIndex !== undefined &&
        (!Number.isInteger(options.tabIndex) || options.tabIndex < 0)
    ) {
        throw new Error('tabIndex must be a non-negative integer.');
    }

    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(options.timeoutMs) ||
            options.timeoutMs <= 0)
    ) {
        throw new Error('timeoutMs must be a positive number.');
    }
}

async function getOpenPages(
    browser: Browser,
): Promise<Array<{
    context: BrowserContext;
    page: Page;
}>> {
    const results: Array<{
        context: BrowserContext;
        page: Page;
    }> = [];

    for (const context of browser.contexts()) {
        for (const page of context.pages()) {
            if (!page.isClosed()) {
                results.push({ context, page });
            }
        }
    }

    return results;
}

async function matchesPage(
    page: Page,
    options: EdgeCdpOptions,
): Promise<boolean> {
    if (
        options.urlContains &&
        !page.url().includes(options.urlContains)
    ) {
        return false;
    }

    if (options.titleContains) {
        try {
            const title = await page.title();

            if (!title.includes(options.titleContains)) {
                return false;
            }
        } catch {
            return false;
        }
    }

    return true;
}

async function describePages(
    pages: readonly Page[],
): Promise<EdgeTabInfo[]> {
    const results: EdgeTabInfo[] = [];

    for (let index = 0; index < pages.length; index++) {
        const page = pages[index];

        let title = '';

        try {
            title = await page.title();
        } catch {
            title = '<unavailable>';
        }

        results.push({
            index,
            title,
            url: page.url(),
        });
    }

    return results;
}

function formatTabs(tabs: readonly EdgeTabInfo[]): string {
    if (tabs.length === 0) {
        return 'No tabs available.';
    }

    return tabs
        .map(
            (tab) =>
                `[${tab.index}] ${tab.title || '<untitled>'} ` +
                `(${tab.url})`,
        )
        .join('\n');
}

async function selectPage(
    browser: Browser,
    options: EdgeCdpOptions,
): Promise<{
    context: BrowserContext;
    page: Page;
}> {
    const available = await getOpenPages(browser);

    if (available.length === 0) {
        throw new Error(
            'No open Edge pages were found through CDP.',
        );
    }

    if (options.tabIndex !== undefined) {
        const selected = available[options.tabIndex];

        if (!selected) {
            const tabs = await describePages(
                available.map((item) => item.page),
            );

            throw new Error(
                `Edge tab index ${options.tabIndex} does not exist.\n` +
                formatTabs(tabs),
            );
        }

        if (!(await matchesPage(selected.page, options))) {
            throw new Error(
                `Edge tab index ${options.tabIndex} does not match ` +
                'the supplied URL/title filters.',
            );
        }

        return selected;
    }

    const matches: typeof available = [];

    for (const item of available) {
        if (await matchesPage(item.page, options)) {
            matches.push(item);
        }
    }

    if (matches.length === 1) {
        return matches[0];
    }

    const tabs = await describePages(
        available.map((item) => item.page),
    );

    if (matches.length === 0) {
        throw new Error(
            'No Edge tab matched the supplied filters.\n' +
            formatTabs(tabs),
        );
    }

    throw new Error(
        `${matches.length} Edge tabs matched. ` +
        'Supply urlContains, titleContains, or tabIndex ' +
        'to select exactly one.\n' +
        formatTabs(tabs),
    );
}

export async function listEdgeTabs(
    browser: Browser,
): Promise<EdgeTabInfo[]> {
    const available = await getOpenPages(browser);

    return describePages(
        available.map((item) => item.page),
    );
}

export async function connectToEdge(
    options: EdgeCdpOptions,
): Promise<EdgeCdpSession> {
    validateOptions(options);

    let browser: Browser;

    try {
        browser = await chromium.connectOverCDP(
            options.endpoint,
            {
                timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : String(error);

        throw new Error(
            `Could not connect to Edge CDP at ` +
            `"${options.endpoint}".\n` +
            'Start Edge with remote debugging enabled and ' +
            `verify the endpoint.\n${message}`,
        );
    }

    try {
        const selected = await selectPage(browser, options);

        return {
            browser,
            context: selected.context,
            page: selected.page,
            async disconnect(): Promise<void> {
                // This disconnects Playwright's CDP transport.
                // It must not close individual tabs or contexts.
                await browser.close();
            },
        };
    } catch (error) {
        await browser.close();
        throw error;
    }
}
