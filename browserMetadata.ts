
import { Page, test } from '@playwright/test';

const NOT_KNOWN = 'Not Known';

/**
 * Collects browser runtime metadata from the existing
 * Playwright Page and records it as test annotations.
 *
 * Does not launch any additional browser.
 */
export function captureBrowserMetadata(page: Page): void {
    const testInfo = test.info();
    const browser = page.context().browser();
    const viewport = page.viewportSize();

    const metadata: Record<string, string> = {
        browser: browser?.browserType().name() ?? NOT_KNOWN,
        browserVersion: browser?.version() ?? NOT_KNOWN,
        browserChannel:
            testInfo.project.use.channel ?? NOT_KNOWN,
        viewport: viewport
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
        }
    }
}
