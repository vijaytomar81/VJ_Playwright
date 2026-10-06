export const BrowserConfig = {
    defaultBrowser: 'chromium',

    headless: true,

    viewport: {
        width: 1920,
        height: 1080,
    },

    timeout: {
        action: 30_000,
        navigation: 60_000,
    },
} as const;