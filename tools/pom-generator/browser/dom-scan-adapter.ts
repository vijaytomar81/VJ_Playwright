
import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Page } from '@playwright/test';
import type { PageScan } from '../models/generator.types';
import type {
    DomScanDiagnostics,
} from '../scanner/scan-diagnostics';
import type {
    BrowserScanAdapter,
} from '../core/generator-service';

interface BrowserScanPayload {
    scan?: PageScan;
    warnings?: string[];
    diagnostics?: DomScanDiagnostics;
    error?: string;
}

interface BrowserScannerApi {
    scan(pageName: string, url: string): BrowserScanPayload;
}

export interface DomScanAdapterOptions {
    /**
     * Absolute path to the browser scanner entry module.
     * Defaults to the V2 scanner bridge entry.
     */
    entryFile?: string;

    /**
     * Fail if the scanner reports warnings.
     * Normally warnings are diagnostic, not fatal.
     */
    failOnWarnings?: boolean;

    /**
     * Optional Node-side callback for scanner diagnostics.
     * The adapter itself never writes to the terminal.
     */
    onDiagnostics?: (diagnostics: DomScanDiagnostics) => void;
}

const GLOBAL_NAME = '__pomGeneratorDomScannerV2';

function defaultEntryFile(): string {
    return resolve(
        'tools/pom-generator/browser/dom-scan-entry.ts',
    );
}

async function bundleScanner(entryFile: string): Promise<string> {
    const result = await build({
        entryPoints: [entryFile],
        bundle: true,
        write: false,
        platform: 'browser',
        format: 'iife',
        globalName: GLOBAL_NAME,
        target: ['es2022'],
        logLevel: 'silent',
        legalComments: 'none',
    });

    const output = result.outputFiles?.[0];

    if (!output) {
        throw new Error(
            'Browser scanner bundling produced no JavaScript output.',
        );
    }

    return output.text;
}

function validateScan(
    payload: BrowserScanPayload,
    pageName: string,
): PageScan {
    if (payload.error) {
        throw new Error(
            `Browser DOM scan failed: ${payload.error}`,
        );
    }

    const scan = payload.scan;

    if (!scan || typeof scan !== 'object') {
        throw new Error('Browser scanner returned no PageScan.');
    }

    if (scan.pageName !== pageName) {
        throw new Error(
            `Scanner returned "${scan.pageName}" ` +
            `instead of "${pageName}".`,
        );
    }

    if (
        !Array.isArray(scan.elements) ||
        !Array.isArray(scan.groups) ||
        !Array.isArray(scan.repeatableGroups)
    ) {
        throw new Error(
            'Browser scanner returned an invalid PageScan structure.',
        );
    }

    if (!scan.scannedAt || typeof scan.url !== 'string') {
        throw new Error(
            'Browser scanner omitted required scan metadata.',
        );
    }

    return scan;
}

async function validateLiveRadioGroups(
    page: Page,
    scan: PageScan,
): Promise<void> {
    for (const group of scan.groups) {
        const candidate = group.locator?.primary;

        if (
            !candidate ||
            candidate.strategy !== 'role' ||
            (candidate.role !== 'group' &&
                candidate.role !== 'radiogroup')
        ) {
            continue;
        }

        const name = candidate.name;

        // Reject the proposed locator if its accessibility
        // name is missing.
        if (!name) {
            delete group.locator;
            console.warn(
                `[POM] Radio group "${group.name}": ` +
                'missing accessible name.',
            );
            continue;
        }

        const locator = page.getByRole(candidate.role, {
            name,
            exact: candidate.exact ?? true,
        });

        const count = await locator.count();

        if (count !== 1) {
            delete group.locator;
            console.warn(
                `[POM] Radio group "${group.name}": ` +
                `expected one Playwright match, found ${count}.`,
            );
            continue;
        }

        const radios = locator.getByRole('radio');
        const radioCount = await radios.count();

        if (radioCount === 0) {
            delete group.locator;
            console.warn(
                `[POM] Radio group "${group.name}": ` +
                'no accessible radio options found.',
            );
            continue;
        }

        const optionNames = await radios.evaluateAll((elements) =>
            elements.map((element) => {
                const input = element as HTMLInputElement;

                const ariaLabel = input.getAttribute('aria-label');
                if (ariaLabel) return ariaLabel.trim();

                const labels = Array.from(input.labels ?? []);
                return labels
                    .map((label) => label.textContent?.trim() ?? '')
                    .filter(Boolean)
                    .join(' ');
            }),
        );

        const normalized = optionNames.map((name) =>
            name.replace(/\s+/g, ' ').trim().toLowerCase(),
        );

        if (
            normalized.some((name) => !name) ||
            new Set(normalized).size !== normalized.length
        ) {
            delete group.locator;
            console.warn(
                `[POM] Radio group "${group.name}": ` +
                'radio option names are empty or duplicated.',
            );
            continue;
        }

        console.log(
            `[POM] Validated radio group "${group.name}" ` +
            `with options: ${optionNames.join(', ')}`,
        );
    }
}

/**
 * Create a Playwright-to-browser-DOM scanner adapter.
 *
 * The browser receives bundled JavaScript, not Node objects.
 * The scanner executes against the live document.
 */
export function createDomScanAdapter(
    options: DomScanAdapterOptions = {},
): BrowserScanAdapter {
    const entryFile = options.entryFile ?? defaultEntryFile();

    let bundlePromise: Promise<string> | undefined;

    return async (page: Page, pageName: string): Promise<PageScan> => {
        bundlePromise ??= bundleScanner(entryFile);

        const script = await bundlePromise;

        // Add the bundle to the currently selected tab.
        // No page navigation is performed.
        await page.addScriptTag({ content: script });

        const payload = await page.evaluate(
            ({ globalName, requestedPageName }) => {
                const registry = window as unknown as Record<
                    string,
                    BrowserScannerApi | undefined
                >;

                const api = registry[globalName];

                if (!api || typeof api.scan !== 'function') {
                    return {
                        error: 'Injected scanner API was not found.',
                    };
                }

                try {
                    return api.scan(
                        requestedPageName,
                        window.location.href,
                    );
                } catch (error) {
                    return {
                        error: error instanceof Error
                            ? error.message
                            : String(error),
                    };
                }
            },
            {
                globalName: GLOBAL_NAME,
                requestedPageName: pageName,
            },
        );

        const scan = validateScan(payload, pageName);

        await validateLiveRadioGroups(page, scan);

        if (
            options.failOnWarnings &&
            (payload.warnings?.length ?? 0) > 0
        ) {
            throw new Error(
                `DOM scanner reported warnings:\n` +
                payload.warnings!.join('\n'),
            );
        }

        if (options.onDiagnostics) {
            if (!payload.diagnostics) {
                throw new Error(
                    'Browser scanner returned no diagnostics.',
                );
            }

            options.onDiagnostics(payload.diagnostics);
        }

        return scan;
    };
}
