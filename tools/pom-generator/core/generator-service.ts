
import { readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { Page } from '@playwright/test';
import type {
    ActionOperation,
    ChangePlan,
    GeneratorMode,
    GeneratorResult,
    PageMetadata,
    PageScan,
    StoredAction,
    StoredElement,
} from '../models/generator.types';
import { connectToEdge } from '../browser/edge-cdp';
import { comparePageElements } from '../comparison/element-matcher';
import { planChanges } from '../comparison/change-planner';
import { generatePageFile } from '../generation/page-writer';
import { generateElementsFile } from '../generation/elements-writer';
import { generateActionsFile } from '../generation/actions-writer';
import { mergeActionFiles } from '../generation/action-merger';
import { nameElements } from './element-namer';
import { orchestrateGeneration } from './generator-orchestrator';
import type {
    GeneratedArtifacts,
    GeneratorDependencies,
    OrchestratorOptions,
} from './generator-orchestrator';

export interface GeneratorServiceOptions extends OrchestratorOptions {
    tabIndex?: number;
    urlContains?: string;
    titleContains?: string;
}

export type BrowserScanAdapter = (
    page: Page,
    pageName: string,
) => Promise<PageScan>;

export interface GeneratorServiceDependencies {
    scanBrowser: BrowserScanAdapter;
}

function pascal(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');
}

function nextKey(
    prefix: string,
    existing: readonly string[],
): () => string {
    const used = new Set(existing);
    let counter = 1;

    for (const key of existing) {
        const match = new RegExp(`^${prefix}_(\\d+)$`).exec(key);
        if (match) counter = Math.max(counter, Number(match[1]) + 1);
    }

    return () => {
        let key: string;
        do {
            key = `${prefix}_${String(counter++).padStart(3, '0')}`;
        } while (used.has(key));
        used.add(key);
        return key;
    };
}

function operationFor(element: StoredElement): ActionOperation {
    switch (element.kind) {
        case 'checkbox':
        case 'radio':
            return 'check';
        case 'button':
        case 'link':
            return 'click';
        case 'select':
            return 'selectOption';
        default:
            return 'fill';
    }
}

function methodFor(element: StoredElement): string {
    const name = pascal(element.name);
    switch (operationFor(element)) {
        case 'click': return `click${name}`;
        case 'check': return `check${name}`;
        case 'selectOption': return `select${name}`;
        default: return `enter${name}`;
    }
}

function buildMetadata(
    scan: PageScan,
    previous: PageMetadata | undefined,
): PageMetadata {
    const comparison = comparePageElements(
        scan,
        previous?.elements ?? [],
    );

    if (comparison.ambiguous > 0 || comparison.notFound > 0) {
        throw new Error(
            'Metadata generation blocked: unresolved existing elements.',
        );
    }

    const naming = nameElements(
        scan.elements,
        previous?.elements ?? [],
    );
    const namesByScannedId = new Map(
        naming.elements.map((item) => [item.temporaryId, item.name]),
    );
    const byScannedId = new Map(
        scan.elements.map((item) => [item.temporaryId, item]),
    );
    const existing = new Map(
        (previous?.elements ?? []).map((item) => [
            item.stableKey,
            item,
        ]),
    );

    const newElementKey = nextKey(
        'el',
        previous?.elements.map((item) => item.stableKey) ?? [],
    );
    const newActionKey = nextKey(
        'act',
        previous?.actions.map((item) => item.stableKey) ?? [],
    );

    const elements: StoredElement[] = [];
    const seen = new Set<string>();

    for (const match of comparison.matches) {
        if (match.status !== 'matched' && match.status !== 'new') {
            continue;
        }

        const scanned = match.scannedId
            ? byScannedId.get(match.scannedId)
            : undefined;
        if (!scanned) {
            throw new Error(
                'Element comparison references missing scan ID.',
            );
        }

        const stableKey = match.status === 'matched'
            ? match.existingKey
            : newElementKey();

        if (!stableKey) {
            throw new Error('Matched element has no stable key.');
        }
        if (seen.has(stableKey)) continue;
        seen.add(stableKey);

        const original = existing.get(stableKey);
        const name = original?.name ??
            namesByScannedId.get(scanned.temporaryId);

        if (!name || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
            throw new Error(
                `Invalid generated element name for "${stableKey}".`,
            );
        }

        elements.push({
            stableKey,
            name,
            kind: scanned.kind,
            fingerprint: scanned.fingerprint,
            locators: scanned.locators,
            status: 'active',
            groupKey: scanned.groupKey,
            repeatableGroupKey: scanned.repeatableGroupKey,
            indexed: Boolean(scanned.repeatableGroupKey),
        });
    }

    const actions: StoredAction[] = [...(previous?.actions ?? [])];
    const existingActionElements = new Set(
        actions.map((item) => item.elementKey),
    );
    const methodNames = new Set(
        actions.map((item) => item.methodName),
    );

    for (const element of elements) {
        if (existingActionElements.has(element.stableKey)) continue;

        const methodName = methodFor(element);
        if (methodNames.has(methodName)) {
            throw new Error(
                `Generated action name collision: "${methodName}".`,
            );
        }

        actions.push({
            stableKey: newActionKey(),
            elementKey: element.stableKey,
            methodName,
            operation: operationFor(element),
            indexed: element.indexed,
        });
        methodNames.add(methodName);
        existingActionElements.add(element.stableKey);
    }

    return {
        schemaVersion: 2,
        pageName: scan.pageName,
        elements,
        actions,
        groups: scan.groups,
        repeatableGroups: scan.repeatableGroups,
    };
}

function importPath(fromDirectory: string, target: string): string {
    const path = relative(fromDirectory, target)
        .split(sep)
        .join('/');
    return path.startsWith('.') ? path : `./${path}`;
}

function isMissing(error: unknown): boolean {
    return typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT';
}

async function existingActions(
    directory: string,
    pageName: string,
): Promise<string | undefined> {
    const path = join(directory, `${pageName}.actions.ts`);
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
    }
}

async function generateArtifacts(
    scan: PageScan,
    previous: PageMetadata | undefined,
    options: GeneratorServiceOptions,
): Promise<GeneratedArtifacts> {
    const metadata = buildMetadata(scan, previous);
    const directory = resolve(
        options.outputDirectory,
        options.pageName,
    );

    const runtimeImportPath = importPath(
        directory,
        resolve('tools/pom-generator/runtime/locator-resolver'),
    );
    const typesImportPath = importPath(
        directory,
        resolve('tools/pom-generator/models/generator.types'),
    );

    const page = generatePageFile(metadata, {
        runtimeImportPath,
    });
    const elements = generateElementsFile(metadata, {
        typesImportPath,
    });
    const actions = generateActionsFile(metadata);

    const warnings = [
        ...page.warnings,
        ...elements.warnings,
        ...actions.warnings,
    ];

    let actionContent = actions.content;

    if (previous) {
        const source = await existingActions(
            directory,
            options.pageName,
        );
        if (source === undefined) {
            throw new Error(
                'UPDATE blocked: existing actions file is missing.',
            );
        }

        const merged = mergeActionFiles(
            source,
            actionContent,
            {
                previousMetadata: previous,
                currentMetadata: metadata,
            },
        );
        actionContent = merged.content;
        warnings.push(...merged.warnings);
    }

    return {
        metadata,
        files: [
            { relativePath: page.fileName, content: page.content },
            {
                relativePath: elements.fileName,
                content: elements.content,
            },
            {
                relativePath: actions.fileName,
                content: actionContent,
            },
        ],
        warnings,
    };
}

export async function runGeneratorService(
    options: GeneratorServiceOptions,
    dependencies: GeneratorServiceDependencies,
): Promise<GeneratorResult> {
    const session = await connectToEdge({
        endpoint: options.cdpEndpoint,
        tabIndex: options.tabIndex,
        urlContains: options.urlContains,
        titleContains: options.titleContains,
    });

    try {
        const adapters: GeneratorDependencies = {
            async scan() {
                const scan = await dependencies.scanBrowser(
                    session.page,
                    options.pageName,
                );
                if (scan.pageName !== options.pageName) {
                    throw new Error(
                        'Browser scanner returned the wrong page.',
                    );
                }
                return scan;
            },

            plan(scan, previous, mode) {
                const comparison = comparePageElements(
                    scan,
                    previous?.elements ?? [],
                );
                const planningMode: GeneratorMode =
                    mode === 'dry-run'
                        ? previous ? 'update' : 'create'
                        : mode;
                const plan = planChanges(
                    scan,
                    comparison,
                    previous,
                    { mode: planningMode },
                );
                return { ...plan, mode };
            },

            generate(scan, previous, _plan: ChangePlan) {
                return generateArtifacts(scan, previous, options);
            },
        };

        return await orchestrateGeneration(options, adapters);
    } finally {
        await session.disconnect();
    }
}
