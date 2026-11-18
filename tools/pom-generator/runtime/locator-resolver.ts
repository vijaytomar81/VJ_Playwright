
import type {
    Locator,
    Page,
} from '@playwright/test';

import type {
    GroupKey,
    LocatorCandidate,
    LocatorDefinition,
    RepeatableGroup,
} from '../models/generator.types';

export interface LocatorResolverOptions {
    timeoutMs?: number;
    groups?: ReadonlyMap<GroupKey, LocatorDefinition>;
    repeatableGroups?: ReadonlyMap<GroupKey, RepeatableGroup>;
}

export interface ResolveLocatorOptions {
    groupKey?: GroupKey;
    repeatableGroupKey?: GroupKey;
    instance?: number;
    timeoutMs?: number;
}

export interface LocatorResolution {
    locator: Locator;
    candidate: LocatorCandidate;
    fallbackIndex: number;
}

const DEFAULT_TIMEOUT_MS = 3_000;

function validateTimeout(timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error('Locator timeout must be positive.');
    }
}

function validateInstance(instance: number): void {
    if (!Number.isInteger(instance) || instance < 1) {
        throw new Error(
            'Repeatable instance must be a 1-based positive integer.',
        );
    }
}

function toLocator(
    scope: Page | Locator,
    candidate: LocatorCandidate,
): Locator {
    switch (candidate.strategy) {
        case 'role':
            return scope.getByRole(
                candidate.role as Parameters<Page['getByRole']>[0],
                {
                    ...(candidate.name
                        ? { name: candidate.name }
                        : {}),
                    exact: candidate.exact ?? true,
                },
            );

        case 'label':
            return scope.getByLabel(candidate.value, {
                exact: candidate.exact ?? true,
            });

        case 'placeholder':
            return scope.getByPlaceholder(candidate.value, {
                exact: candidate.exact ?? true,
            });

        case 'testId':
            return scope.getByTestId(candidate.value);

        case 'id':
            return scope.locator(`[id=${JSON.stringify(candidate.value)}]`);

        case 'name':
            return scope.locator(`[name=${JSON.stringify(candidate.value)}]`);

        case 'css':
            return scope.locator(candidate.value);

        case 'xpath':
            return scope.locator(`xpath=${candidate.value}`);

        default:
            throw new Error(
                `Unsupported locator strategy: ${candidate.strategy}`,
            );
    }
}

async function findUnique(
    scope: Page | Locator,
    definition: LocatorDefinition,
    timeoutMs: number,
): Promise<LocatorResolution | undefined> {
    const candidates = [
        definition.primary,
        ...definition.fallbacks,
    ];

    for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index];
        const locator = toLocator(scope, candidate);

        try {
            await locator.first().waitFor({
                state: 'attached',
                timeout: timeoutMs,
            });
        } catch {
            continue;
        }

        const count = await locator.count();

        if (count === 1) {
            return {
                locator,
                candidate,
                fallbackIndex: index,
            };
        }

        // Multiple matches are ambiguous.
        // Never silently use .first() as the final locator.
    }

    return undefined;
}

async function resolveGroupScope(
    page: Page,
    key: GroupKey,
    groups: ReadonlyMap<GroupKey, LocatorDefinition>,
    timeoutMs: number,
): Promise<Locator> {
    const definition = groups.get(key);

    if (!definition) {
        throw new Error(`Unknown locator group: ${key}`);
    }

    const resolved = await findUnique(
        page,
        definition,
        timeoutMs,
    );

    if (!resolved) {
        throw new Error(
            `Group "${key}" could not be uniquely resolved.`,
        );
    }

    return resolved.locator;
}

async function resolveRepeatableScope(
    page: Page,
    group: RepeatableGroup,
    instance: number,
    timeoutMs: number,
): Promise<Locator> {
    validateInstance(instance);

    if (
        group.maxInstances !== undefined &&
        instance > group.maxInstances
    ) {
        throw new Error(
            `Instance ${instance} exceeds configured maximum ` +
            `${group.maxInstances} for "${group.name}".`,
        );
    }

    const candidates = [
        group.locator.primary,
        ...group.locator.fallbacks,
    ];

    for (const candidate of candidates) {
        const locator = toLocator(page, candidate);

        try {
            await locator.first().waitFor({
                state: 'attached',
                timeout: timeoutMs,
            });
        } catch {
            continue;
        }

        const count = await locator.count();

        if (count < instance) {
            continue;
        }

        if (
            group.selection === 'validated-position' &&
            count !== group.instanceCount
        ) {
            // The scan-time ordering is no longer verified.
            continue;
        }

        // Public index 1 maps to Playwright index 0.
        return locator.nth(instance - 1);
    }

    throw new Error(
        `Cannot resolve instance ${instance} of ` +
        `repeatable group "${group.name}".`,
    );
}

export class LocatorResolver {
    private readonly timeoutMs: number;
    private readonly groups: ReadonlyMap<
        GroupKey,
        LocatorDefinition
    >;
    private readonly repeatableGroups: ReadonlyMap<
        GroupKey,
        RepeatableGroup
    >;

    constructor(
        private readonly page: Page,
        options: LocatorResolverOptions = {},
    ) {
        this.timeoutMs =
            options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

        validateTimeout(this.timeoutMs);

        this.groups = options.groups ?? new Map();
        this.repeatableGroups =
            options.repeatableGroups ?? new Map();
    }

    async resolve(
        definition: LocatorDefinition,
        options: ResolveLocatorOptions = {},
    ): Promise<LocatorResolution> {
        const timeoutMs =
            options.timeoutMs ?? this.timeoutMs;

        validateTimeout(timeoutMs);

        let scope: Page | Locator = this.page;

        if (options.repeatableGroupKey) {
            const group = this.repeatableGroups.get(
                options.repeatableGroupKey,
            );

            if (!group) {
                throw new Error(
                    `Unknown repeatable group: ` +
                    options.repeatableGroupKey,
                );
            }

            if (options.instance === undefined) {
                throw new Error(
                    `Instance is required for repeatable group ` +
                    `"${group.name}".`,
                );
            }

            scope = await resolveRepeatableScope(
                this.page,
                group,
                options.instance,
                timeoutMs,
            );
        } else if (options.instance !== undefined) {
            throw new Error(
                'Instance was supplied without a repeatable group.',
            );
        }

        if (options.groupKey) {
            const groupScope = await resolveGroupScope(
                this.page,
                options.groupKey,
                this.groups,
                timeoutMs,
            );

            if (scope === this.page) {
                scope = groupScope;
            } else {
                // Keep the intersection scoped to the repeatable instance.
                scope = scope.locator(':scope').filter({
                    has: groupScope,
                });
            }
        }

        const resolved = await findUnique(
            scope,
            definition,
            timeoutMs,
        );

        if (!resolved) {
            throw new Error(
                'No primary or fallback locator uniquely matched ' +
                'the requested element.',
            );
        }

        return resolved;
    }
}
