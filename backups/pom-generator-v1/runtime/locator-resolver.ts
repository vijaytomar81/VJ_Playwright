
import type {
    Locator,
    Page,
} from '@playwright/test';

type PlaywrightRole =
    Parameters<Page['getByRole']>[0];

export interface ElementLocatorDescriptor {
    readonly preferred: string;
    readonly fallbacks: readonly string[];
}

export interface ResolveElementOptions {
    readonly timeoutMs?: number;
    readonly fallbackTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_FALLBACK_TIMEOUT_MS = 1000;

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

export async function resolveElement(
    page: Page,
    element: ElementLocatorDescriptor,
    options: ResolveElementOptions = {},
): Promise<Locator> {

    const timeoutMs =
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const fallbackTimeoutMs =
        options.fallbackTimeoutMs ??
        DEFAULT_FALLBACK_TIMEOUT_MS;

    if (
        !Number.isFinite(timeoutMs) ||
        timeoutMs < 0 ||
        !Number.isFinite(fallbackTimeoutMs) ||
        fallbackTimeoutMs < 0
    ) {
        throw new Error(
            'Locator timeouts must be finite, non-negative numbers.',
        );
    }

    const descriptors = [
        element.preferred,
        ...element.fallbacks,
    ];

    const attempted: string[] = [];

    for (
        let index = 0;
        index < descriptors.length;
        index++
    ) {
        const descriptor = descriptors[index];

        if (attempted.includes(descriptor)) {
            continue;
        }

        attempted.push(descriptor);

        const locator =
            resolveLocator(
                page,
                descriptor,
            );

        const timeout =
            index === 0
                ? timeoutMs
                : fallbackTimeoutMs;

        try {
            await locator.first().waitFor({
                state: 'attached',
                timeout,
            });
        } catch (error) {
            const count =
                await locator.count();

            if (count === 0) {
                continue;
            }

            throw error;
        }

        const count =
            await locator.count();

        if (count > 1) {
            throw new Error(
                `Ambiguous locator "${descriptor}": ` +
                `${count} elements matched. ` +
                'Fallback resolution stopped.',
            );
        }

        if (count === 1) {
            return locator;
        }
    }

    throw new Error(
        'Unable to resolve element. ' +
        `Attempted locators: ${attempted.join(', ')}`,
    );
}
