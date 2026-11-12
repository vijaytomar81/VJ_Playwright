import { test, type Page } from '@playwright/test';
import { platform, release } from 'node:os';

const NOT_KNOWN = '';

/**
 * Captures runtime browser metadata from the existing
 * Playwright Page and stores it in test annotations.
 *
 * - Does not launch an additional browser.
 * - Does not execute browser binaries.
 * - Supports Chromium, Firefox and WebKit.
 * - Supports desktop and mobile-emulated contexts.
 * - Captures the Host OS and optional Remote Device information.
 * - Avoids duplicate metadata annotations.
 */
export function captureExecutionEnvironmentMetadata(page: Page): void {
    const testInfo = test.info();

    const browser = page.context().browser();
    const viewport = page.viewportSize();

    /*
     * Capture the operating system running the Playwright
     * test process, including its runtime OS version.
     */
    const operatingSystems: Record<string, string> = {
        win32: 'Windows',
        linux: 'Linux',
        darwin: 'macOS',
    };

    const hostPlatform = platform();
    const hostOSVersion = release();
    const hostOS = operatingSystems[hostPlatform] ?? hostPlatform;
    const hostDevice = `${hostOS} (${hostOSVersion})`;

    /*
     * Read remote device information from BrowserStack
     * capabilities when available.
     *
     * Playwright does not expose remote device capabilities
     * through Page or BrowserContext directly.
     */
    const projectUse = testInfo.project.use as Record<string, unknown>;

    const capabilities = projectUse.capabilities &&
        typeof projectUse.capabilities === 'object'
        ? projectUse.capabilities as Record<string, unknown>
        : {};

    const browserStackOptions = capabilities['bstack:options'] &&
        typeof capabilities['bstack:options'] === 'object'
        ? capabilities['bstack:options'] as Record<string, unknown>
        : {};

    const getValue = (value: unknown): string =>
        typeof value === 'string' || typeof value === 'number'
            ? String(value).trim()
            : NOT_KNOWN;

    const remoteDevice =
        getValue(browserStackOptions.deviceName) ||
        getValue(capabilities.deviceName) ||
        getValue(process.env.BROWSERSTACK_DEVICE_NAME);

    const remoteOS =
        getValue(browserStackOptions.os) ||
        getValue(capabilities.os) ||
        getValue(process.env.BROWSERSTACK_OS);

    const remoteOSVersion =
        getValue(browserStackOptions.osVersion) ||
        getValue(capabilities.osVersion) ||
        getValue(process.env.BROWSERSTACK_OS_VERSION);

    /*
     * Combine Host OS and Remote Device information.
     *
     * Host only:
     * Windows (10.0.26200)
     *
     * Host + Remote:
     * Windows (10.0.26200) - (iPhone 15 - iOS 17)
     */
    const remoteDetails = [
        remoteDevice,
        [remoteOS, remoteOSVersion]
            .filter(Boolean)
            .join(' '),
    ].filter(Boolean).join(' - ');

    const device = remoteDetails
        ? `${hostDevice} - (${remoteDetails})`
        : hostDevice;

    const metadata: Record<string, string> = {
        browser:
            browser?.browserType().name() ?? NOT_KNOWN,

        browserVersion:
            browser?.version() ?? NOT_KNOWN,

        browserChannel:
            testInfo.project.use.channel ?? NOT_KNOWN,

        viewport:
            viewport
                ? `${viewport.width}x${viewport.height}`
                : NOT_KNOWN,

        // platform:
        //     hostPlatform,

        // osVersion:
        //     hostOSVersion,

        device,

        headless:
            typeof testInfo.project.use.headless === 'boolean'
                ? String(testInfo.project.use.headless)
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
                existing.description === NOT_KNOWN ||
                existing.description === 'Not Known' ||
                existing.description === 'Not Specified') &&
            description !== NOT_KNOWN
        ) {
            existing.description = description;
        }
    }
}
