
import { devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * EvidenceFactory browser projects.
 *
 * Chromium is enabled by default.
 *
 * Additional browser configurations can be enabled
 * when cross-browser testing is required.
 */
export const browserProjects: NonNullable<
    PlaywrightTestConfig['projects']
> = [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },

        // Firefox
        // {
        //     name: 'firefox',
        //     use: {
        //         ...devices['Desktop Firefox'],
        //     },
        // },

        // WebKit
        // {
        //     name: 'webkit',
        //     use: {
        //         ...devices['Desktop Safari'],
        //     },
        // },

        // Mobile Chrome
        // {
        //     name: 'Mobile Chrome',
        //     use: {
        //         ...devices['Pixel 5'],
        //     },
        // },

        // Mobile Safari
        // {
        //     name: 'Mobile Safari',
        //     use: {
        //         ...devices['iPhone 12'],
        //     },
        // },

        // Microsoft Edge
        // {
        //     name: 'Microsoft Edge',
        //     use: {
        //         ...devices['Desktop Edge'],
        //         channel: 'msedge',
        //     },
        // },

        // Google Chrome
        // {
        //     name: 'Google Chrome',
        //     use: {
        //         ...devices['Desktop Chrome'],
        //         channel: 'chrome',
        //     },
        // },
    ];
