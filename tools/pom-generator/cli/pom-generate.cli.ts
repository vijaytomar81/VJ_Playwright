
import { resolve } from 'node:path';
import { createDomScanAdapter } from '../browser/dom-scan-adapter';
import {
    runGeneratorService,
} from '../core/generator-service';
import type {
    GeneratorServiceOptions,
} from '../core/generator-service';
import {
    formatGeneratorResult,
} from '../reporting/change-reporter';
import type {
    GeneratorMode,
} from '../models/generator.types';

interface CliArguments {
    help: boolean;
    pageName?: string;
    mode?: GeneratorMode;
    outputDirectory?: string;
    cdpEndpoint?: string;
    tabIndex?: number;
    urlContains?: string;
    titleContains?: string;
    dryRun: boolean;
    verbose: boolean;
}

const DEFAULT_CDP_ENDPOINT = 'http://127.0.0.1:9222';
const DEFAULT_OUTPUT_DIRECTORY = 'automationLayer/pomObjects';

const HELP = `
Playwright POM Generator V2

Usage:
  npm run pom-generate -- --page Login --mode create
  npm run pom-generate -- --page Login --mode update
  npm run pom-generate -- --page Login --mode update --dry-run

Options:
  --page <name>          Page name, e.g. Login
  --mode <mode>          create | update | dry-run
  --output <directory>   Generated POM root directory
  --cdp <endpoint>       Edge remote debugging endpoint
  --tab <index>          Zero-based Edge tab index
  --url-contains <text>  Select Edge tab by URL substring
  --title-contains <text> Select Edge tab by title substring
  --dry-run              Preview without writing files
  --verbose              Include detailed change descriptions
  --help, -h             Show this help

Defaults:
  Output: ${DEFAULT_OUTPUT_DIRECTORY}
  CDP:    ${DEFAULT_CDP_ENDPOINT}

Notes:
  - Edge must already be running with remote debugging enabled.
  - CREATE refuses to overwrite an existing generated page.
  - UPDATE requires existing generator metadata.
  - Engineer-owned group-actions files are never modified.
  - Dry-run never writes generated files.
`.trim();

function readValue(
    argumentsList: readonly string[],
    index: number,
    flag: string,
): string {
    const value = argumentsList[index + 1];

    if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${flag}.`);
    }

    return value;
}

function parseTabIndex(value: string): number {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(
            `Invalid --tab value "${value}". ` +
            'Expected a non-negative integer.',
        );
    }

    return parsed;
}

function parseMode(value: string): GeneratorMode {
    if (
        value !== 'create' &&
        value !== 'update' &&
        value !== 'dry-run'
    ) {
        throw new Error(
            `Invalid mode "${value}". ` +
            'Expected create, update, or dry-run.',
        );
    }

    return value;
}

export function parseCliArguments(
    argumentsList: readonly string[],
): CliArguments {
    const parsed: CliArguments = {
        help: false,
        dryRun: false,
        verbose: false,
    };

    for (let index = 0; index < argumentsList.length; index++) {
        const argument = argumentsList[index];

        switch (argument) {
            case '--help':
            case '-h':
                parsed.help = true;
                break;

            case '--dry-run':
                parsed.dryRun = true;
                break;

            case '--verbose':
                parsed.verbose = true;
                break;

            case '--page':
                parsed.pageName = readValue(
                    argumentsList, index++, argument,
                );
                break;

            case '--mode':
                parsed.mode = parseMode(
                    readValue(argumentsList, index++, argument),
                );
                break;

            case '--output':
                parsed.outputDirectory = readValue(
                    argumentsList, index++, argument,
                );
                break;

            case '--cdp':
                parsed.cdpEndpoint = readValue(
                    argumentsList, index++, argument,
                );
                break;

            case '--tab':
                parsed.tabIndex = parseTabIndex(
                    readValue(argumentsList, index++, argument),
                );
                break;

            case '--url-contains':
                parsed.urlContains = readValue(
                    argumentsList, index++, argument,
                );
                break;

            case '--title-contains':
                parsed.titleContains = readValue(
                    argumentsList, index++, argument,
                );
                break;

            default:
                throw new Error(
                    `Unknown argument "${argument}". Use --help for usage.`,
                );
        }
    }

    return parsed;
}

function buildOptions(
    parsed: CliArguments,
): GeneratorServiceOptions {
    if (!parsed.pageName) {
        throw new Error(
            'Missing required --page option.',
        );
    }

    const mode = parsed.mode ?? 'create';

    return {
        pageName: parsed.pageName,
        mode,
        dryRun: parsed.dryRun || mode === 'dry-run',
        outputDirectory: resolve(
            parsed.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY,
        ),
        cdpEndpoint: parsed.cdpEndpoint ?? DEFAULT_CDP_ENDPOINT,
        tabIndex: parsed.tabIndex,
        urlContains: parsed.urlContains,
        titleContains: parsed.titleContains,
    };
}

export async function runCli(
    argumentsList: readonly string[] = process.argv.slice(2),
): Promise<number> {
    try {
        const parsed = parseCliArguments(argumentsList);

        if (parsed.help) {
            console.log(HELP);
            return 0;
        }

        const options = buildOptions(parsed);

        console.log(
            `POM Generator V2: ${options.pageName} ` +
            `(${options.dryRun ? 'dry-run' : options.mode})`,
        );

        const result = await runGeneratorService(
            options,
            {
                scanBrowser: createDomScanAdapter(),
            },
        );

        console.log(
            formatGeneratorResult(result, {
                verbose: parsed.verbose,
            }),
        );

        if (result.warnings.length > 0) {
            console.warn('\nWarnings:');

            for (const warning of result.warnings) {
                console.warn(`- ${warning}`);
            }
        }

        return 0;
    } catch (error) {
        const message =
            error instanceof Error ? error.message : String(error);

        console.error(`POM Generator V2 failed:\n${message}`);
        return 1;
    }
}

if (process.argv[1]?.endsWith('pom-generate.cli.js')) {
    void runCli().then((exitCode) => {
        process.exitCode = exitCode;
    });
}
