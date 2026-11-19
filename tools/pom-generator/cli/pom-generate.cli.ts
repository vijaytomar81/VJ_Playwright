import { resolve } from 'node:path';
import { createDomScanAdapter } from '../browser/dom-scan-adapter';
import { runGeneratorService } from '../core/generator-service';
import type { GeneratorServiceOptions } from '../core/generator-service';
import { formatGeneratorResult } from '../reporting/change-reporter';
import type { GeneratorMode } from '../models/generator.types';
import {
    getBrands,
    getChannels,
    getProducts,
    isValidBrand,
    isValidChannel,
    isValidProduct,
} from '@framework-config';
import type { Brand, Channel } from '@framework-config';
import { StringUtils } from '@utils';
interface CliArguments {
    help: boolean;
    brand?: string;
    channel?: string;
    product?: string;
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
interface ValidatedArguments {
    brand: Brand;
    channel: Channel;
    product: string;
    pageName: string;
    mode: GeneratorMode;
}
const DEFAULT_CDP_ENDPOINT = 'http://127.0.0.1:9222';
const DEFAULT_OUTPUT_DIRECTORY = 'automationLayer/pomObjects';
const REQUIRED_OPTIONS = [
    '--brand',
    '--channel',
    '--product',
    '--page',
    '--mode',
] as const;
const VALUE_OPTIONS = new Set([
    ...REQUIRED_OPTIONS,
    '--output',
    '--cdp',
    '--tab',
    '--url-contains',
    '--title-contains',
]);
const FLAG_OPTIONS = new Set([
    '--dry-run',
    '--verbose',
    '--help',
    '-h',
]);
const HELP = `
Playwright POM Generator V2
Usage:
  npm run pom-generate -- \\
    --brand AZO --channel DJ --product Motor \\
    --page car-details --mode create
Required options:
  --brand <brand>         Configured brand
  --channel <channel>     Channel supported by the brand
  --product <product>     Product supported by brand/channel
  --page <name>           Safe page name
  --mode <mode>           create | update | dry-run
Optional:
  --dry-run               Preview explicit CREATE or UPDATE
  --output <directory>    Generated POM root directory
  --cdp <endpoint>        Edge CDP endpoint
  --tab <index>           Zero-based Edge tab index
  --url-contains <text>   Select Edge tab by URL substring
  --title-contains <text> Select Edge tab by title substring
  --verbose               Show detailed changes
  --help, -h              Show help
Defaults:
  Output: ${DEFAULT_OUTPUT_DIRECTORY}
  CDP:    ${DEFAULT_CDP_ENDPOINT}
Rules:
  - Every required option must be supplied.
  - Brand, Channel, Product and Mode are case-insensitive.
  - Canonical configured values are used for output paths.
  - CREATE must not overwrite existing generated files.
  - UPDATE requires existing generated files and metadata.
  - Dry-run does not write generated files.
`.trim();
function readValue(
    args: readonly string[],
    index: number,
    flag: string,
): string {
    const value = args[index + 1];
    if (!value || value.startsWith('-') || !value.trim()) {
        throw new Error(
            `Invalid or missing value for ${flag}.`,
        );
    }
    return value.trim();
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
    const normalized = value.toLowerCase();
    if (
        normalized !== 'create' &&
        normalized !== 'update' &&
        normalized !== 'dry-run'
    ) {
        throw new Error(
            `Invalid --mode "${value}". ` +
            'Allowed: create, update, dry-run.',
        );
    }
    return normalized;
}
export function parseCliArguments(
    args: readonly string[],
): CliArguments {
    const parsed: CliArguments = {
        help: false,
        dryRun: false,
        verbose: false,
    };
    const seen = new Set<string>();
    for (let index = 0; index < args.length; index++) {
        const flag = args[index];
        if (
            !VALUE_OPTIONS.has(flag) &&
            !FLAG_OPTIONS.has(flag)
        ) {
            throw new Error(
                `Unknown argument "${flag}". Use --help for usage.`,
            );
        }
        const normalizedFlag = flag === '-h' ? '--help' : flag;
        if (seen.has(normalizedFlag)) {
            throw new Error(
                `Duplicate option "${normalizedFlag}" is not allowed.`,
            );
        }
        seen.add(normalizedFlag);
        if (FLAG_OPTIONS.has(flag)) {
            switch (normalizedFlag) {
                case '--help':
                    parsed.help = true;
                    break;
                case '--dry-run':
                    parsed.dryRun = true;
                    break;
                case '--verbose':
                    parsed.verbose = true;
                    break;
            }
            continue;
        }
        const value = readValue(args, index++, flag);
        switch (flag) {
            case '--brand':
                parsed.brand = value;
                break;
            case '--channel':
                parsed.channel = value;
                break;
            case '--product':
                parsed.product = value;
                break;
            case '--page':
                parsed.pageName = value;
                break;
            case '--mode':
                parsed.mode = parseMode(value);
                break;
            case '--output':
                parsed.outputDirectory = value;
                break;
            case '--cdp':
                parsed.cdpEndpoint = value;
                break;
            case '--tab':
                parsed.tabIndex = parseTabIndex(value);
                break;
            case '--url-contains':
                parsed.urlContains = value;
                break;
            case '--title-contains':
                parsed.titleContains = value;
                break;
        }
    }
    return parsed;
}
function validateArguments(
    parsed: CliArguments,
): ValidatedArguments {
    const supplied: Record<string, string | undefined> = {
        '--brand': parsed.brand,
        '--channel': parsed.channel,
        '--product': parsed.product,
        '--page': parsed.pageName,
        '--mode': parsed.mode,
    };
    const missing = REQUIRED_OPTIONS.filter(
        flag => !supplied[flag],
    );
    if (missing.length > 0) {
        throw new Error(
            'Missing required parameter(s):\n' +
            missing.map(flag => `  ${flag}`).join('\n') +
            '\n\nRequired: --brand --channel --product ' +
            '--page --mode\nUse --help for examples.',
        );
    }
    const brandInput = parsed.brand!;
    const channelInput = parsed.channel!;
    const productInput = parsed.product!;
    const pageName = parsed.pageName!;
    const mode = parsed.mode!;
    const brand = StringUtils.matchIgnoreCase(
        brandInput,
        getBrands(),
    );
    if (!brand || !isValidBrand(brand)) {
        throw new Error(
            `Unsupported brand "${brandInput}".\n` +
            `Valid brands: ${getBrands().join(', ')}`,
        );
    }
    const channel = StringUtils.matchIgnoreCase(
        channelInput,
        getChannels(brand),
    );
    if (!channel || !isValidChannel(brand, channel)) {
        throw new Error(
            `Channel "${channelInput}" is not configured ` +
            `for brand "${brand}".\n` +
            `Valid channels for ${brand}: ` +
            getChannels(brand).join(', '),
        );
    }
    const product = StringUtils.matchIgnoreCase(
        productInput,
        getProducts(brand, channel),
    );
    if (!product || !isValidProduct(brand, channel, product)) {
        throw new Error(
            `Product "${productInput}" is not configured ` +
            `for ${brand}/${channel}.\n` +
            `Valid products: ` +
            getProducts(brand, channel).join(', '),
        );
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(pageName)) {
        throw new Error(
            `Invalid page name "${pageName}".\n` +
            'Use letters, digits, hyphens or underscores. ' +
            'The name must start with a letter.',
        );
    }
    return {
        brand,
        channel,
        product,
        pageName,
        mode,
    };
}
function buildOptions(
    parsed: CliArguments,
    validated: ValidatedArguments,
): GeneratorServiceOptions {
    return {
        pageName: validated.pageName,
        mode: validated.mode,
        dryRun: parsed.dryRun || validated.mode === 'dry-run',
        outputDirectory: resolve(
            parsed.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY,
            validated.brand,
            validated.channel,
            validated.product,
        ),
        cdpEndpoint: parsed.cdpEndpoint ?? DEFAULT_CDP_ENDPOINT,
        tabIndex: parsed.tabIndex,
        urlContains: parsed.urlContains,
        titleContains: parsed.titleContains,
    };
}
export async function runCli(
    args: readonly string[] = process.argv.slice(2),
): Promise<number> {
    try {
        const parsed = parseCliArguments(args);
        if (parsed.help) {
            console.log(HELP);
            return 0;
        }
        const validated = validateArguments(parsed);
        const options = buildOptions(parsed, validated);
        console.log('POM Generator V2');
        console.log(`Brand:   ${validated.brand}`);
        console.log(`Channel: ${validated.channel}`);
        console.log(`Product: ${validated.product}`);
        console.log(`Page:    ${validated.pageName}`);
        console.log(`Mode:    ${validated.mode}`);
        console.log(`Output:  ${options.outputDirectory}`);
        if (options.dryRun) {
            console.log('Preview only: no generated file writes.');
        }
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
        return 0;
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : String(error);
        console.error(
            'POM Generator V2 — FAILED\n\n' +
            message,
        );
        return 1;
    }
}
if (require.main === module) {
    runCli().then(
        code => {
            process.exitCode = code;
        },
        error => {
            console.error(error);
            process.exitCode = 1;
        },
    );
}
