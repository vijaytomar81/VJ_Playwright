
import { join, resolve } from 'node:path';
import type {
    ChangePlan,
    GeneratorMode,
    GeneratorOptions,
    GeneratorResult,
    PageMetadata,
    PageScan,
} from '../models/generator.types';
import {
    readMetadata,
    serializeMetadata,
} from '../persistence/metadata-store';
import {
    writeGeneratedFiles,
} from '../persistence/safe-writer';
import type {
    FileWrite,
} from '../persistence/safe-writer';
import {
    assertSafeChangePlan,
} from '../reporting/change-reporter';

export interface GeneratorDependencies {
    /**
     * Scan the current page.
     * Implemented by the generator service.
     */
    scan(options: GeneratorOptions): Promise<PageScan>;

    /**
     * Compare scanned elements with existing metadata.
     * This must not mutate the previous metadata.
     */
    plan(
        scan: PageScan,
        previous: PageMetadata | undefined,
        mode: GeneratorMode,
    ): Promise<ChangePlan> | ChangePlan;

    /**
     * Build generated files and the next metadata snapshot.
     *
     * UPDATE must preserve existing stable IDs and
     * engineer-owned action methods before returning.
     */
    generate(
        scan: PageScan,
        previous: PageMetadata | undefined,
        plan: ChangePlan,
    ): Promise<GeneratedArtifacts> | GeneratedArtifacts;
}

export interface GeneratedArtifacts {
    metadata: PageMetadata;
    files: FileWrite[];
    warnings?: string[];
}

export interface OrchestratorOptions extends GeneratorOptions {
    /**
     * When true, do not write even if mode is CREATE or UPDATE.
     */
    dryRun: boolean;
}

const PAGE_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

function validateOptions(options: OrchestratorOptions): void {
    if (!PAGE_NAME.test(options.pageName)) {
        throw new Error(
            `Invalid page name "${options.pageName}". ` +
            'Use letters, digits, underscores, or hyphens.',
        );
    }

    if (!options.outputDirectory.trim()) {
        throw new Error('outputDirectory is required.');
    }

    if (!['create', 'update', 'dry-run'].includes(options.mode)) {
        throw new Error(`Unsupported generator mode: ${options.mode}`);
    }
}

function pageDirectory(options: OrchestratorOptions): string {
    return resolve(options.outputDirectory, options.pageName);
}

function metadataFileName(pageName: string): string {
    return `${pageName}.pom-generator.json`;
}

function metadataPath(options: OrchestratorOptions): string {
    return join(
        pageDirectory(options),
        metadataFileName(options.pageName),
    );
}

function effectiveMode(options: OrchestratorOptions): GeneratorMode {
    return options.dryRun ? 'dry-run' : options.mode;
}

function assertMatchingPage(
    pageName: string,
    scan: PageScan,
    previous?: PageMetadata,
): void {
    if (scan.pageName !== pageName) {
        throw new Error(
            `Scanner returned page "${scan.pageName}" ` +
            `instead of "${pageName}".`,
        );
    }

    if (previous && previous.pageName !== pageName) {
        throw new Error(
            `Existing metadata belongs to "${previous.pageName}", ` +
            `not "${pageName}".`,
        );
    }
}

function assertValidPlan(
    plan: ChangePlan,
    pageName: string,
    mode: GeneratorMode,
): void {
    if (plan.pageName !== pageName) {
        throw new Error(
            `Change plan belongs to "${plan.pageName}", ` +
            `not "${pageName}".`,
        );
    }

    if (plan.mode !== mode) {
        throw new Error(
            `Change plan mode "${plan.mode}" ` +
            `does not match "${mode}".`,
        );
    }

    if (!Array.isArray(plan.changes)) {
        throw new Error('Change plan has no changes array.');
    }

    assertSafeChangePlan(plan);
}

function assertArtifactPaths(
    artifacts: GeneratedArtifacts,
    pageName: string,
): void {
    const allowed = new Set([
        `${pageName}.page.ts`,
        `${pageName}.elements.ts`,
        `${pageName}.actions.ts`,
    ]);

    const seen = new Set<string>();

    for (const file of artifacts.files) {
        if (!allowed.has(file.relativePath)) {
            throw new Error(
                `Unexpected generated artifact "${file.relativePath}".`,
            );
        }

        if (seen.has(file.relativePath)) {
            throw new Error(
                `Duplicate generated artifact "${file.relativePath}".`,
            );
        }

        seen.add(file.relativePath);
    }

    if (seen.size !== allowed.size) {
        const missing = [...allowed].filter((name) => !seen.has(name));
        throw new Error(
            `Missing generated artifacts: ${missing.join(', ')}`,
        );
    }

    if (artifacts.metadata.pageName !== pageName) {
        throw new Error(
            'Generated metadata page name does not match the request.',
        );
    }
}

function buildWriteSet(
    artifacts: GeneratedArtifacts,
    pageName: string,
): FileWrite[] {
    assertArtifactPaths(artifacts, pageName);

    const metadataFile: FileWrite = {
        relativePath: metadataFileName(pageName),
        content: serializeMetadata(artifacts.metadata),
    };

    return [...artifacts.files, metadataFile];
}

/**
 * Coordinate CREATE, UPDATE, and dry-run generation.
 *
 * All generated files are prepared and validated before
 * the safe writer is allowed to touch the filesystem.
 */
export async function orchestrateGeneration(
    options: OrchestratorOptions,
    dependencies: GeneratorDependencies,
): Promise<GeneratorResult> {
    validateOptions(options);

    const mode = effectiveMode(options);
    const warnings: string[] = [];

    const stored = await readMetadata(metadataPath(options));
    warnings.push(...stored.warnings);

    if (options.mode === 'create' && stored.exists) {
        throw new Error(
            `CREATE refused: metadata already exists for ` +
            `"${options.pageName}". Use UPDATE instead.`,
        );
    }

    if (options.mode === 'update' && !stored.exists) {
        throw new Error(
            `UPDATE refused: no metadata exists for ` +
            `"${options.pageName}". Use CREATE first.`,
        );
    }

    const previous = stored.metadata;

    const scan = await dependencies.scan(options);
    assertMatchingPage(options.pageName, scan, previous);

    const plan = await dependencies.plan(scan, previous, mode);
    assertValidPlan(plan, options.pageName, mode);

    const artifacts = await dependencies.generate(
        scan,
        previous,
        plan,
    );

    warnings.push(...(artifacts.warnings ?? []));

    const files = buildWriteSet(artifacts, options.pageName);

    const writeResult = await writeGeneratedFiles(files, {
        outputDirectory: pageDirectory(options),
        mode,
        dryRun: options.dryRun || mode === 'dry-run',
    });

    warnings.push(...writeResult.warnings);

    return {
        pageName: options.pageName,
        mode,
        plan,
        writtenFiles: writeResult.writtenFiles,
        warnings,
    };
}
