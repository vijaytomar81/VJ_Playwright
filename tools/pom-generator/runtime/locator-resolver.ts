import type {
    Locator,
    Page,
} from '@playwright/test';

type PlaywrightRole =
    Parameters<Page['getByRole']>[0];

export function resolveLocator(
    page: Page,
    descriptor: string,
): Locator {

    if (descriptor.startsWith('role=')) {
        const match = descriptor.match(
            /^role=([^\[]+)\[name="(.*)"\]$/,
        );

        if (!match) {
            throw new Error(
                `Invalid role locator descriptor: ${descriptor}`,
            );
        }

        const [, role, name] = match;

        return page.getByRole(
            role as PlaywrightRole,
            {
                name,
                exact: true,
            },
        );
    }

    if (descriptor.startsWith('label=')) {
        return page.getByLabel(
            descriptor.substring('label='.length),
            { exact: true },
        );
    }

    if (descriptor.startsWith('testid=')) {
        return page.getByTestId(
            descriptor.substring('testid='.length),
        );
    }

    if (descriptor.startsWith('placeholder=')) {
        return page.getByPlaceholder(
            descriptor.substring('placeholder='.length),
            { exact: true },
        );
    }

    if (descriptor.startsWith('css=')) {
        return page.locator(
            descriptor.substring('css='.length),
        );
    }

    throw new Error(
        `Unsupported locator descriptor: ${descriptor}`,
    );
}