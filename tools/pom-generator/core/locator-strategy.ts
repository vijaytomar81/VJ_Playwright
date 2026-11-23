
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

const CONTROL_SELECTOR = [
    'input', 'textarea', 'select', 'button',
    'a[href]', '[role="button"]', '[role="link"]',
    '[role="checkbox"]', '[role="radio"]',
    '[role="combobox"]', '[role="textbox"]',
].join(', ');

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string | null | undefined): string {
    return clean(value).toLowerCase();
}

function escapeAttribute(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\a ')
        .replace(/\r/g, '\\d ')
        .replace(/\f/g, '\\c ');
}

function getControls(root: ParentNode): Element[] {
    return Array.from(root.querySelectorAll(CONTROL_SELECTOR));
}

function getAccessibleName(element: Element): string {
    const labelledBy = element.getAttribute('aria-labelledby');

    if (labelledBy) {
        const referenced = labelledBy
            .split(/\s+/)
            .map((id) => element.ownerDocument.getElementById(id))
            .filter((node): node is HTMLElement => Boolean(node))
            .map((node) => clean(node.textContent))
            .filter(Boolean);

        if (referenced.length) return referenced.join(' ');
    }

    const ariaLabel = clean(element.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;

    if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
    ) {
        const labels = Array.from(element.labels ?? [])
            .map((label) => clean(label.textContent))
            .filter(Boolean);

        if (labels.length) return labels.join(' ');
    }

    const tag = element.tagName.toLowerCase();

    if (tag === 'input') {
        const type = normalizeText(element.getAttribute('type'));

        if (['button', 'submit', 'reset'].includes(type)) {
            return clean(element.getAttribute('value'));
        }

        return '';
    }

    if (tag === 'img') {
        return clean(element.getAttribute('alt'));
    }

    return clean(element.textContent);
}

function inferRole(element: Element): string | undefined {
    const explicit = clean(element.getAttribute('role'));
    if (explicit) return explicit;

    const tag = element.tagName.toLowerCase();
    const type = normalizeText(element.getAttribute('type'));

    if (tag === 'button') return 'button';
    if (tag === 'a' && element.hasAttribute('href')) return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';

    if (tag === 'input') {
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';

        if (['button', 'submit', 'reset', 'image'].includes(type)) {
            return 'button';
        }

        if (type === 'hidden') return undefined;
        return 'textbox';
    }

    return undefined;
}

function queryCss(root: ParentNode, selector: string): Element[] {
    try {
        return Array.from(root.querySelectorAll(selector));
    } catch {
        return [];
    }
}

function queryByRole(
    root: ParentNode,
    candidate: LocatorCandidate,
): Element[] {
    const role = candidate.role ?? candidate.value;

    return getControls(root).filter((element) => {
        if (inferRole(element) !== role) return false;
        if (!candidate.name) return true;

        const actual = normalizeText(getAccessibleName(element));
        const expected = normalizeText(candidate.name);

        return candidate.exact === false
            ? actual.includes(expected)
            : actual === expected;
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

function queryCandidate(
    root: ParentNode,
    candidate: LocatorCandidate,
): Element[] {
    const value = escapeAttribute(candidate.value);

    switch (candidate.strategy) {
        case 'testId':
            return queryCss(root, `[data-testid="${value}"]`);
        case 'id':
            return queryCss(root, `[id="${value}"]`);
        case 'name':
            return queryCss(root, `[name="${value}"]`);
        case 'placeholder':
            return queryCss(root, `[placeholder="${value}"]`);
        case 'css':
            return queryCss(root, candidate.value);
        case 'role':
            return queryByRole(root, candidate);
        case 'label':
            return queryByLabel(root, candidate);
        case 'xpath':
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

function scoreCandidate(candidate: LocatorCandidate): number {
    let score = STRATEGY_SCORES[candidate.strategy];

    if (candidate.exact === false) score -= 15;
    if (candidate.scopeGroupKey) score += 5;

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
    const accepted = unique && matchesTarget && !unstable;

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
        const key = JSON.stringify(candidate);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function collectCandidates(
    element: ScannedElement,
): LocatorCandidate[] {
    const candidates: LocatorCandidate[] = [
        element.locators.primary,
        ...element.locators.fallbacks,
    ];

    const fingerprint = element.fingerprint;
    const labels = fingerprint.labels;

    const role = fingerprint.role ||
        ({
            button: 'button',
            link: 'link',
            checkbox: 'checkbox',
            radio: 'radio',
            select: 'combobox',
            combobox: 'combobox',
            input: 'textbox',
            textarea: 'textbox',
        } as Record<string, string>)[element.kind];

    if (role) {
        const accessibleName =
            labels.accessible ||
            labels.direct ||
            (
                element.kind === 'button' ||
                    element.kind === 'link'
                    ? fingerprint.text
                    : undefined
            );

        if (accessibleName) {
            candidates.push({
                strategy: 'role',
                value: role,
                role,
                name: accessibleName,
                exact: true,
            });
        }
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
        .sort((a, b) => b.score - a.score);

    const accepted = evaluations.filter(
        (evaluation) => evaluation.accepted,
    );

    if (!accepted.length) {
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
