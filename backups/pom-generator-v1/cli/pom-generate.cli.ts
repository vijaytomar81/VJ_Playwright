
import {
    CliArgumentParser,
} from './cli-argument-parser';

import {
    CdpBrowserConnector,
} from '../browser/cdp-browser-connector';

import {
    GeneratedPageAssembler,
} from '../generators/generated-page-assembler';

import {
    CreateMode,
} from '../modes/create-mode';

import {
    UpdateRunner,
} from '../runners/update-runner';

import {
    MetadataStore,
} from '../metadata/metadata-store';

import {
    PageComparator,
} from '../comparison/page-comparator';

import type {
    GeneratedPage,
} from '../models/page.model';

import type {
    ElementChange,
} from '../models/change.model';

import type {
    PomWriteResult,
} from '../writers/pom-output-writer';

import {
    isValidBrand,
    isValidChannel,
    isValidProduct,
} from '../../../configLayer/config';

import type {
    BusinessConfiguration,
} from '../../../configLayer/config.types';


async function main(): Promise<void> {

    const rawArguments =
        process.argv.slice(2);

    /*
     * Extract dry-run before normal argument parsing.
     *
     * The current CliArgumentParser accepts unknown
     * argument names, but keeping dry-run separate
     * avoids changing its public interface.
     */
    const dryRun =
        resolveDryRun(
            rawArguments,
        );

    const parser =
        new CliArgumentParser();

    const args =
        await parser.parse(
            rawArguments,
        );

    const configuration =
        resolveConfiguration(
            args.brand,
            args.channel,
            args.product,
        );

    const connector =
        new CdpBrowserConnector();

    const connection =
        await connector.connect(
            args.connectCdp,
        );

    try {

        const input = {
            ...configuration,

            pageName:
                args.pageName,
        };

        const assembler =
            new GeneratedPageAssembler(
                connection.page,
            );

        const generatedPage =
            await assembler.assemble(
                input,
            );

        const metadataStore =
            new MetadataStore();

        const existingPage =
            await metadataStore.load(
                generatedPage,
            );

        /*
         * DRY RUN
         *
         * No CreateMode, UpdateRunner, UpdateMode,
         * or POM/metadata writer is invoked here.
         */
        if (dryRun) {

            logScanDiagnostics(
                generatedPage,
            );

            validateGeneratedPage(
                generatedPage,
            );

            if (existingPage) {

                const comparator =
                    new PageComparator();

                const changes =
                    comparator.compare(
                        existingPage.elements,
                        generatedPage.elements,
                    );

                logChangeDiagnostics(
                    changes,
                );

                logDetailedChanges(
                    changes,
                );

                console.log(
                    '\nPOM UPDATE dry run completed.',
                );

                console.log(
                    `Existing elements: ` +
                    `${existingPage.elements.length}`,
                );

                console.log(
                    `Scanned elements: ` +
                    `${generatedPage.elements.length}`,
                );

                console.log(
                    'No POM or metadata files were written.',
                );

                return;
            }

            console.log(
                '\nPOM CREATE dry run completed.',
            );

            console.log(
                `Elements that would be created: ` +
                `${generatedPage.elements.length}`,
            );

            console.log(
                'No POM or metadata files were written.',
            );

            return;
        }

        /*
         * NORMAL UPDATE
         *
         * Preserve the existing execution flow.
         */
        if (existingPage) {

            const updateRunner =
                new UpdateRunner();

            const result =
                await updateRunner.run(
                    connection.page,
                    input,
                );

            /*
             * UPDATE currently performs its own
             * DOM scan inside UpdateRunner.
             *
             * Report the page actually used by
             * UPDATE rather than the preliminary
             * page assembled by this CLI.
             */
            logScanDiagnostics(
                result.currentPage,
            );

            logChangeDiagnostics(
                result.changes,
            );

            /*
             * UpdateMode has already persisted the
             * merged page by this point.
             *
             * This check is diagnostic only.
             * Pre-write validation belongs in
             * UpdateMode, before persistence.
             */
            validateGeneratedPage(
                result.updatedPage,
            );

            console.log(
                '\nPOM UPDATE completed successfully.',
            );

            console.log(
                `Changes: ${result.changes.length}`,
            );

            console.log(
                `Final merged elements: ` +
                `${result.updatedPage.elements.length}`,
            );

            logOutputPaths(
                result.pom,
                result.metadataFile,
            );

            return;
        }

        /*
         * NORMAL CREATE
         */
        logScanDiagnostics(
            generatedPage,
        );

        validateGeneratedPage(
            generatedPage,
        );

        const createMode =
            new CreateMode();

        const result =
            await createMode.execute(
                generatedPage,
            );

        console.log(
            '\nPOM CREATE completed successfully.',
        );

        console.log(
            `Generated elements: ` +
            `${generatedPage.elements.length}`,
        );

        logOutputPaths(
            result.pom,
            result.metadataFile,
        );

    } finally {

        await connection.disconnect();
    }
}


function resolveDryRun(
    args: readonly string[],
): boolean {

    const dryRunArguments =
        args.filter(
            argument =>
                argument.startsWith(
                    '--dry-run=',
                ),
        );

    if (
        dryRunArguments.length > 1
    ) {
        throw new Error(
            'Duplicate CLI argument: --dry-run',
        );
    }

    if (
        dryRunArguments.length === 0
    ) {
        return false;
    }

    const value =
        dryRunArguments[0]
            .slice(
                '--dry-run='.length,
            )
            .trim()
            .toLowerCase();

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    throw new Error(
        'Invalid --dry-run value. ' +
        'Use --dry-run=true or --dry-run=false.',
    );
}


function logScanDiagnostics(
    page: GeneratedPage,
): void {

    const resolvedCount =
        page.elements.length;

    const unresolved =
        page.unresolvedElements ?? [];

    console.log(
        '\nPOM SCAN diagnostics:',
    );

    console.log(
        `  Successfully assembled: ${resolvedCount}`,
    );

    console.log(
        `  Unresolved locators: ${unresolved.length}`,
    );

    console.log(
        `  Total assembled or unresolved: ` +
        `${resolvedCount + unresolved.length}`,
    );

    /*
     * This total does not include DOM elements
     * excluded by scanner selection, type
     * resolution, or visibility filtering.
     */
    if (unresolved.length > 0) {

        console.warn(
            '\nPOM unresolved element diagnostics:',
        );

        for (
            const [index, element]
            of unresolved.entries()
        ) {

            console.warn(
                `  ${index + 1}. ` +
                JSON.stringify(
                    element,
                    null,
                    2,
                ),
            );
        }
    }
}


function logChangeDiagnostics(
    changes: readonly ElementChange[],
): void {

    const changeTypes = [
        'NEW',
        'UNCHANGED',
        'CHANGED',
        'NOT_FOUND',
        'AMBIGUOUS',
    ] as const;

    console.log(
        '\nPOM UPDATE comparison:',
    );

    for (const type of changeTypes) {

        const count =
            changes.filter(
                change =>
                    change.type === type,
            ).length;

        console.log(
            `  ${type}: ${count}`,
        );
    }
}


function logDetailedChanges(
    changes: readonly ElementChange[],
): void {

    console.log(
        '\nPOM detailed comparison:',
    );

    for (
        const [index, change]
        of changes.entries()
    ) {

        console.log(
            `\n  ${index + 1}. ` +
            `[${change.type}] ` +
            change.elementName,
        );

        if (change.stableKey) {

            console.log(
                `     Stable key: ` +
                change.stableKey,
            );
        }

        if (change.existing) {

            console.log(
                `     Existing name: ` +
                change.existing.name,
            );

            console.log(
                `     Existing locator: ` +
                change.existing.locator.preferred,
            );
        }

        if (change.current) {

            console.log(
                `     Current name: ` +
                change.current.name,
            );

            console.log(
                `     Current locator: ` +
                change.current.locator.preferred,
            );
        }

        if (
            change.matchScore !== undefined
        ) {

            console.log(
                `     Match score: ` +
                change.matchScore.toFixed(3),
            );
        }

        if (
            change.matchedFields?.length
        ) {

            console.log(
                `     Matched fields: ` +
                change.matchedFields.join(', '),
            );
        }

        if (
            change.conflictingFields?.length
        ) {

            console.log(
                `     Conflicting fields: ` +
                change.conflictingFields.join(', '),
            );
        }

        if (
            change.candidateStableKeys?.length
        ) {

            console.log(
                `     Candidate stable keys: ` +
                change.candidateStableKeys.join(', '),
            );
        }
    }
}


function validateGeneratedPage(
    page: GeneratedPage,
): void {

    const names =
        new Set<string>();

    const stableKeys =
        new Set<string>();

    for (const element of page.elements) {

        if (!element.name.trim()) {
            throw new Error(
                'Generated element has an empty name.',
            );
        }

        if (!element.stableKey.trim()) {
            throw new Error(
                `Generated element "${element.name}" ` +
                'has an empty stableKey.',
            );
        }

        if (names.has(element.name)) {
            throw new Error(
                `Duplicate generated element name: ` +
                element.name,
            );
        }

        if (stableKeys.has(element.stableKey)) {
            throw new Error(
                `Duplicate generated stableKey: ` +
                element.stableKey,
            );
        }

        names.add(
            element.name,
        );

        stableKeys.add(
            element.stableKey,
        );
    }
}


function logOutputPaths(
    pom: PomWriteResult,
    metadataFile: string,
): void {

    console.log(
        `Elements: ${pom.elementsFile}`,
    );

    console.log(
        `Page: ${pom.pageFile}`,
    );

    console.log(
        `Actions: ${pom.actionsFile}`,
    );

    console.log(
        `Metadata: ${metadataFile}`,
    );
}


function resolveConfiguration(
    brandValue: string,
    channelValue: string,
    productValue: string,
): BusinessConfiguration {

    if (
        !isValidBrand(
            brandValue,
        )
    ) {
        throw new Error(
            `Unsupported brand: ${brandValue}`,
        );
    }

    if (
        !isValidChannel(
            brandValue,
            channelValue,
        )
    ) {
        throw new Error(
            `Channel '${channelValue}' is not configured ` +
            `for brand '${brandValue}'.`,
        );
    }

    if (
        !isValidProduct(
            brandValue,
            channelValue,
            productValue,
        )
    ) {
        throw new Error(
            `Product '${productValue}' is not configured ` +
            `for ${brandValue}/${channelValue}.`,
        );
    }

    return {
        brand:
            brandValue,

        channel:
            channelValue,

        product:
            productValue,
    };
}


main()
    .catch(
        error => {

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            console.error(
                `\nPOM GENERATE failed: ${message}`,
            );

            process.exitCode = 1;
        },
    );
