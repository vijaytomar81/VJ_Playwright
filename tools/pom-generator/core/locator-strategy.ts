
import type {
    LocatorCandidate,
    LocatorDefinition,
    ScannedElement,
} from '../models/generator.types';

export interface LocatorEvaluation {
    candidate: LocatorCandidate;
    matchCount: number;
    matchesTarget: boolean;
    score: number;
    accepted: boolean;
    reason: string;
}

export interface LocatorRankingResult {
    locators?: LocatorDefinition;
    evaluations: LocatorEvaluation[];
    warnings: string[];
}

export interface LocatorRankingOptions {
    scope?: ParentNode;
    maxFallbacks?: number;
}

const STRATEGY_SCORES: Record<
    LocatorCandidate['strategy'],
    number
> = {
    testId: 100,
    role: 95,
    label: 90,
    id: 85,
    name: 75,
    placeholder: 65,
    css: 45,
    xpath: 20,
};

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeCss(value: string): string {
    return Array.from(value)
        .map((character) => {
            if (/^[a-zA-Z0-9_-]$/.test(character)) {
                return character;
            }

            return `\\${character.codePointAt(0)!.toString(16)} `;
        })
        .join('');
}

function getControls(root: ParentNode): Element[] {
    return Array.from(
        root.querySelectorAll(
            'input, textarea, select, button, a[href], ' +
            '[role="button"], [role="link"], ' +
            '[role="checkbox"], [role="radio"], ' +
            '[role="combobox"]',
        ),
    );
}

function normalizeText(value: string | null): string {
    return clean(value).toLowerCase();
}

function getAccessibleName(element: Element): string {
    const labelledBy = element.getAttribute('aria-labelledby');

    if (labelledBy) {
        const referenced = labelledBy
            .split(/\s+/)
            .map((id) => element.ownerDocument.getElementById(id))
            .filter(Boolean)
            .map((node) => clean(node!.textContent))
            .filter(Boolean);

        if (referenced.length > 0) {
            return referenced.join(' ');
        }
    }

    const ariaLabel = element.getAttribute('aria-label');

    if (ariaLabel) {
        return clean(ariaLabel);
    }

    if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
    ) {
        const labelText = Array.from(element.labels ?? [])
            .map((label) => clean(label.textContent))
            .filter(Boolean)
            .join(' ');

        if (labelText) {
            return labelText;
        }
    }

    return clean(element.textContent);
}

function matchesRole(
    element: Element,
    role: string,
): boolean {
    const explicit = element.getAttribute('role');

    if (explicit) {
        return explicit === role;
    }

    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();

    if (tag === 'button') return role === 'button';
    if (tag === 'a') return role === 'link';
    if (tag === 'select') return role === 'combobox';

    if (tag === 'input') {
        if (type === 'checkbox') return role === 'checkbox';
        if (type === 'radio') return role === 'radio';
        if (type === 'button' || type === 'submit') {
            return role === 'button';
        }
        return role === 'textbox';
    }

    if (tag === 'textarea') return role === 'textbox';

    return false;
}

function queryByRole(
    root: ParentNode,
    candidate: LocatorCandidate,
): Element[] {
    const role = candidate.role ?? candidate.value;

    return getControls(root).filter((element) => {
        if (!matchesRole(element, role)) {
            return false;
        }

        if (!candidate.name) {
            return true;
        }

        const actual = getAccessibleName(element);
        const expected = candidate.name;

        return candidate.exact === false
            ? normalizeText(actual).includes(normalizeText(expected))
            : normalizeText(actual) === normalizeText(expected);
    });
}

function queryByLabel(
    root: ParentNode,
    candidate: LocatorCandidate,
): Element[] {
    const expected = normalizeText(candidate.value);

    return getControls(root).filter((element) => {
        const actual = normalizeText(getAccessibleName(element));

        return candidate.exact === false
            ? actual.includes(expected)
            : actual === expected;
    });
}

function queryCss(
    root: ParentNode,
    selector: string,
): Element[] {
    try {
        return Array.from(root.querySelectorAll(selector));
    } catch {
        return [];
    }
}

function queryCandidate(
    root: ParentNode,
    candidate: LocatorCandidate,
): Element[] {
    switch (candidate.strategy) {
        case 'testId':
            return queryCss(
                root,
                `[data-testid="${escapeCss(candidate.value)}"]`,
            );

        case 'id':
            return queryCss(
                root,
                `[id="${escapeCss(candidate.value)}"]`,
            );

        case 'name':
            return queryCss(
                root,
                `[name="${escapeCss(candidate.value)}"]`,
            );

        case 'placeholder':
            return queryCss(
                root,
                `[placeholder="${escapeCss(candidate.value)}"]`,
            );

        case 'css':
            return queryCss(root, candidate.value);

        case 'role':
            return queryByRole(root, candidate);

        case 'label':
            return queryByLabel(root, candidate);

        case 'xpath':
            // XPath validation belongs to the runtime resolver.
            return [];

        default:
            return [];
    }
}

function isUnstable(candidate: LocatorCandidate): boolean {
    const value = candidate.value;

    if (
        candidate.strategy === 'id' ||
        candidate.strategy === 'name'
    ) {
        return /^(react-select-\d+|css-|sc-|jsx-)/i.test(value);
    }

    if (candidate.strategy === 'css') {
        return /:nth-child|:nth-of-type|react-select-\d+/i.test(value);
    }

    return false;
}

function scoreCandidate(
    candidate: LocatorCandidate,
): number {
    let score = STRATEGY_SCORES[candidate.strategy];

    if (candidate.exact === false) {
        score -= 15;
    }

    if (candidate.scopeGroupKey) {
        score += 5;
    }

    return score;
}

function evaluateCandidate(
    root: ParentNode,
    target: Element,
    candidate: LocatorCandidate,
): LocatorEvaluation {
    const matches = queryCandidate(root, candidate);
    const matchesTarget = matches.includes(target);
    const unstable = isUnstable(candidate);
    const unique = matches.length === 1;

    const accepted =
        unique &&
        matchesTarget &&
        !unstable;

    let reason = 'Unique locator for the target.';

    if (unstable) {
        reason = 'Potentially generated or position-dependent locator.';
    } else if (matches.length === 0) {
        reason = 'No elements matched.';
    } else if (!matchesTarget) {
        reason = 'Locator does not match the target element.';
    } else if (!unique) {
        reason = `Locator matched ${matches.length} elements.`;
    }

    return {
        candidate,
        matchCount: matches.length,
        matchesTarget,
        score: scoreCandidate(candidate),
        accepted,
        reason,
    };
}

function deduplicate(
    candidates: readonly LocatorCandidate[],
): LocatorCandidate[] {
    const seen = new Set<string>();

    return candidates.filter((candidate) => {
        const identity = JSON.stringify(candidate);

        if (seen.has(identity)) {
            return false;
        }

        seen.add(identity);
        return true;
    });
}

function collectCandidates(
    element: ScannedElement,
): LocatorCandidate[] {
    const candidates = [
        element.locators.primary,
        ...element.locators.fallbacks,
    ];

    const role = element.fingerprint.role;

    if (role) {
        candidates.push({
            strategy: 'role',
            value: role,
            role,
            ...(element.fingerprint.labels.accessible
                ? { name: element.fingerprint.labels.accessible }
                : {}),
            exact: true,
        });
    }

    return deduplicate(candidates);
}

export function rankLocators(
    target: Element,
    element: ScannedElement,
    options: LocatorRankingOptions = {},
): LocatorRankingResult {
    const root = options.scope ?? target.ownerDocument;
    const warnings: string[] = [];

    const evaluations = collectCandidates(element)
        .map((candidate) =>
            evaluateCandidate(root, target, candidate),
        )
        .sort((left, right) => right.score - left.score);

    const accepted = evaluations.filter(
        (evaluation) => evaluation.accepted,
    );

    if (accepted.length === 0) {
        warnings.push(
            `No unique, stable locator for ${element.temporaryId}.`,
        );

        return { evaluations, warnings };
    }

    const maxFallbacks = Math.max(
        0,
        options.maxFallbacks ?? 4,
    );

    return {
        locators: {
            primary: accepted[0].candidate,
            fallbacks: accepted
                .slice(1, maxFallbacks + 1)
                .map((evaluation) => evaluation.candidate),
        },
        evaluations,
        warnings,
    };
}
