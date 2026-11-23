
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
