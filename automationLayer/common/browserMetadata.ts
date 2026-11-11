
import { test, type Page } from '@playwright/test';

const NOT_KNOWN = 'Not Known';

/**
 * Captures runtime browser metadata from the existing
 * Playwright Page and stores it in test annotations.
 *
 * - Does not launch an additional browser.
 * - Does not execute browser binaries.
 * - Supports Chromium, Firefox and WebKit.
 * - Supports desktop and mobile-emulated contexts.
 * - Avoids duplicate metadata annotations.
 */
export function captureBrowserMetadata(page: Page): void {
    const testInfo = test.info();

    const browser = page.context().browser();
    const viewport = page.viewportSize();

    const metadata: Record<string, string> = {
        browser:
            browser?.browserType().name() ?? NOT_KNOWN,

        browserVersion:
            browser?.version() ?? NOT_KNOWN,

        browserChannel:
            testInfo.project.use.channel ?? 'Not Specified',

        viewport:
            viewport
                ? `${viewport.width}x${viewport.height}`
                : NOT_KNOWN,
    };

    for (const [type, description] of Object.entries(metadata)) {
        const existing = testInfo.annotations.find(
            annotation => annotation.type === type,
        );

        if (!existing) {
            testInfo.annotations.push({
                type,
                description,
            });

            continue;
        }

        // Replace an unknown value if actual metadata becomes available.
        if (
            (!existing.description ||
                existing.description === NOT_KNOWN) &&
            description !== NOT_KNOWN
        ) {
            existing.description = description;
        }
    }
}
