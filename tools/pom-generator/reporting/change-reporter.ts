
import type {
    ChangeKind,
    ChangePlan,
    GeneratorChange,
    GeneratorMode,
    GeneratorResult,
} from '../models/generator.types';

export type ReportFormat = 'text' | 'json';

export interface ChangeReportOptions {
    verbose?: boolean;
    includeSafeChanges?: boolean;
    maxDescriptionLength?: number;
}

export interface ChangeSummary {
    pageName: string;
    mode: GeneratorMode;
    totalChanges: number;
    safeChanges: number;
    unsafeChanges: number;
    hasConflicts: boolean;
    byKind: Record<ChangeKind, number>;
}

export interface ChangeReport {
    summary: ChangeSummary;
    changes: GeneratorChange[];
    warnings: string[];
    writtenFiles: string[];
}

const CHANGE_KINDS: readonly ChangeKind[] = [
    'element-added',
    'element-not-found',
    'element-ambiguous',
    'primary-locator-changed',
    'fallback-locators-changed',
    'group-changed',
    'action-added',
    'action-conflict',
];

const CHANGE_LABELS: Record<ChangeKind, string> = {
    'element-added': 'Element added',
    'element-not-found': 'Element not found',
    'element-ambiguous': 'Ambiguous element',
    'primary-locator-changed': 'Primary locator changed',
    'fallback-locators-changed': 'Fallback locators changed',
    'group-changed': 'Group changed',
    'action-added': 'Action added',
    'action-conflict': 'Action conflict',
};

const KIND_ORDER = new Map(
    CHANGE_KINDS.map((kind, index) => [kind, index]),
);

function countByKind(
    changes: readonly GeneratorChange[],
): Record<ChangeKind, number> {
    const counts = Object.fromEntries(
        CHANGE_KINDS.map((kind) => [kind, 0]),
    ) as Record<ChangeKind, number>;

    for (const change of changes) {
        counts[change.kind]++;
    }

    return counts;
}

function sortChanges(
    changes: readonly GeneratorChange[],
): GeneratorChange[] {
    return [...changes].sort((left, right) => {
        const safety = Number(left.safeToApply) -
            Number(right.safeToApply);

        if (safety !== 0) return safety;

        const kind = (KIND_ORDER.get(left.kind) ?? 999) -
            (KIND_ORDER.get(right.kind) ?? 999);

        if (kind !== 0) return kind;

        const leftName = left.elementName ??
            left.elementKey ??
            left.actionKey ??
            '';

        const rightName = right.elementName ??
            right.elementKey ??
            right.actionKey ??
            '';

        return leftName.localeCompare(rightName) ||
            left.description.localeCompare(right.description);
    });
}

function cleanDescription(
    description: string,
    maxLength: number,
): string {
    const normalized = description.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return normalized.slice(0, maxLength - 3) + '...';
}

function displayName(change: GeneratorChange): string {
    if (change.elementName) {
        return change.elementName;
    }

    if (change.actionKey) {
        return 'Unnamed action';
    }

    return 'Unknown element';
}

function formatChange(
    change: GeneratorChange,
    _maxDescriptionLength: number,
): string {
    const status = change.safeToApply ? 'SAFE' : 'REVIEW';
    const label = CHANGE_LABELS[change.kind];

    return `  [${status}] ${label}: ${displayName(change)}`;
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function modeLabel(mode: GeneratorMode): string {
    switch (mode) {
        case 'create':
            return 'CREATE';
        case 'update':
            return 'UPDATE';
        case 'dry-run':
            return 'DRY-RUN';
    }
}

function reportStatus(summary: ChangeSummary): string {
    if (summary.hasConflicts) {
        return 'REVIEW REQUIRED';
    }

    if (summary.totalChanges === 0) {
        return 'NO CHANGES';
    }

    return summary.mode === 'dry-run'
        ? 'CHANGES PROPOSED'
        : 'PLAN READY';
}

/**
 * Summarize a change plan without mutating it.
 */
export function summarizeChanges(
    plan: ChangePlan,
): ChangeSummary {
    const totalChanges = plan.changes.length;
    const unsafeChanges = plan.changes.filter(
        (change) => !change.safeToApply,
    ).length;

    return {
        pageName: plan.pageName,
        mode: plan.mode,
        totalChanges,
        safeChanges: totalChanges - unsafeChanges,
        unsafeChanges,
        hasConflicts: plan.hasConflicts || unsafeChanges > 0,
        byKind: countByKind(plan.changes),
    };
}

/**
 * Produce a structured report for CLI output and JSON.
 *
 * Stable keys remain in the structured data for internal
 * identity tracking. Human-readable names are included
 * through GeneratorChange.elementName.
 */
export function createChangeReport(
    result: GeneratorResult,
): ChangeReport {
    return {
        summary: summarizeChanges(result.plan),
        changes: sortChanges(result.plan.changes),
        warnings: [...result.warnings],
        writtenFiles: [...result.writtenFiles],
    };
}

/**
 * Render a plan before filesystem writes.
 *
 * Each change is displayed on a single line.
 */
export function formatChangePlan(
    plan: ChangePlan,
    options: ChangeReportOptions = {},
): string {
    const summary = summarizeChanges(plan);

    const lines: string[] = [
        `POM Generator V2 — ${modeLabel(plan.mode)}`,
        `Page: ${plan.pageName}`,
        `Status: ${reportStatus(summary)}`,
        '',
        'Change summary:',
        `  Total: ${summary.totalChanges}`,
        `  Safe: ${summary.safeChanges}`,
        `  Review required: ${summary.unsafeChanges}`,
    ];

    const nonzeroKinds = CHANGE_KINDS.filter(
        (kind) => summary.byKind[kind] > 0,
    );

    if (nonzeroKinds.length > 0) {
        lines.push('', 'Changes by type:');

        for (const kind of nonzeroKinds) {
            lines.push(
                `  ${CHANGE_LABELS[kind]}: ${summary.byKind[kind]}`,
            );
        }
    }

    const includeSafe = options.includeSafeChanges !== false;

    const changes = sortChanges(plan.changes).filter(
        (change) => includeSafe || !change.safeToApply,
    );

    if (changes.length > 0) {
        lines.push('', 'Change details:');

        for (const change of changes) {
            lines.push(
                formatChange(
                    change,
                    Math.max(
                        20,
                        options.maxDescriptionLength ?? 160,
                    ),
                ),
            );
        }
    }

    if (options.verbose && plan.changes.length === 0) {
        lines.push('', 'No element or action changes detected.');
    }

    if (summary.hasConflicts) {
        lines.push(
            '',
            'Warning: Resolve conflicts before applying this plan.',
        );
    }

    return lines.join('\n') + '\n';
}

/**
 * Render the result after generation has completed.
 */
export function formatGeneratorResult(
    result: GeneratorResult,
    options: ChangeReportOptions = {},
): string {
    const report = createChangeReport(result);

    const lines = [
        formatChangePlan(result.plan, options).trimEnd(),
        '',
        'Write result:',
        `  ${plural(report.writtenFiles.length, 'file')} written`,
    ];

    if (report.writtenFiles.length > 0) {
        for (const file of report.writtenFiles) {
            lines.push(`  - ${file}`);
        }
    }

    if (
        result.mode === 'dry-run' ||
        result.plan.mode === 'dry-run'
    ) {
        lines.push('  Dry-run: no files should have been written.');
    }

    if (report.warnings.length > 0) {
        lines.push('', 'Warnings:');

        for (const warning of report.warnings) {
            lines.push(`  - ${warning}`);
        }
    }

    return lines.join('\n') + '\n';
}

/**
 * Machine-readable output for CI and external tooling.
 *
 * JSON retains both elementKey and elementName.
 */
export function formatChangeReportJson(
    result: GeneratorResult,
): string {
    return JSON.stringify(
        createChangeReport(result),
        null,
        2,
    ) + '\n';
}

/**
 * Fail-fast guard for the orchestrator.
 *
 * Detailed descriptions are retained for diagnostics.
 */
export function assertSafeChangePlan(
    plan: ChangePlan,
): void {
    const summary = summarizeChanges(plan);

    if (!summary.hasConflicts) return;

    const unsafe = sortChanges(plan.changes)
        .filter((change) => !change.safeToApply)
        .map((change) => {
            const label = CHANGE_LABELS[change.kind];
            const name = displayName(change);
            const description = cleanDescription(
                change.description,
                500,
            );

            return `${label}: ${name} — ${description}`;
        });

    const details = unsafe.length > 0
        ? unsafe.join('\n')
        : 'The plan hasConflicts flag is set.';

    throw new Error(
        `Unsafe POM change plan for "${plan.pageName}":\n` +
        details,
    );
}
