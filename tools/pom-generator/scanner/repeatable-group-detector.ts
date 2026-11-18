
import type {
    LocatorCandidate,
    RepeatableGroup,
} from '../models/generator.types';

export interface RepeatedSection {
    element: Element;
    index: number;
    fieldLabels: string[];
    structuralSignature: string;
}

export interface DetectedRepeatableGroup {
    key: string;
    name: string;
    parentKey?: string;
    sections: RepeatedSection[];
    confidence: number;
    selection: RepeatableGroup['selection'];
    locator?: LocatorCandidate;
}

export interface RepeatableDetectionResult {
    groups: DetectedRepeatableGroup[];
    warnings: string[];
}

interface SectionCandidate {
    element: Element;
    parent: Element;
    signature: string;
    labels: string[];
}

const CONTROL_SELECTOR = [
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="combobox"]',
].join(', ');

const MIN_REPEATED_SECTIONS = 2;
const MIN_CONTROLS_PER_SECTION = 2;

function normalize(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'repeated-group';
}

function getFieldLabels(section: Element): string[] {
    const labels = Array.from(
        section.querySelectorAll('label'),
    );

    const values = labels
        .map((label) => normalize(label.textContent))
        .filter(Boolean);

    return [...new Set(values)];
}

function getControls(section: Element): Element[] {
    const controls = Array.from(
        section.querySelectorAll(CONTROL_SELECTOR),
    );

    // React Select's input already has role="combobox".
    // The selector must not count it twice.
    return [...new Set(controls)];
}

function normalizeAttributePattern(value: string): string {
    return value
        .replace(/\d+/g, '#')
        .toLowerCase();
}

function getControlSignature(control: Element): string {
    const tag = control.tagName.toLowerCase();
    const type = normalize(control.getAttribute('type'));
    const role = normalize(control.getAttribute('role'));

    const id = normalizeAttributePattern(
        normalize(control.getAttribute('id')),
    );

    const name = normalizeAttributePattern(
        normalize(control.getAttribute('name')),
    );

    return [tag, type, role, id, name].join(':');
}

function getStructuralSignature(section: Element): string {
    const controls = getControls(section);

    const controlPattern = controls
        .map(getControlSignature)
        .join('|');

    const labels = getFieldLabels(section)
        .map((label) => label.toLowerCase())
        .join('|');

    return `${controlPattern}::${labels}`;
}

function isMeaningfulSection(element: Element): boolean {
    const controls = getControls(element);

    if (controls.length < MIN_CONTROLS_PER_SECTION) {
        return false;
    }

    return getFieldLabels(element).length > 0;
}

function collectCandidates(root: ParentNode): SectionCandidate[] {
    const candidates: SectionCandidate[] = [];

    const containers = Array.from(
        root.querySelectorAll('div, section, fieldset'),
    );

    for (const element of containers) {
        const parent = element.parentElement;

        if (!parent || !isMeaningfulSection(element)) {
            continue;
        }

        candidates.push({
            element,
            parent,
            signature: getStructuralSignature(element),
            labels: getFieldLabels(element),
        });
    }

    return candidates;
}

function groupSiblingCandidates(
    candidates: SectionCandidate[],
): SectionCandidate[][] {
    const byParent = new Map<Element, SectionCandidate[]>();

    for (const candidate of candidates) {
        const siblings = byParent.get(candidate.parent) ?? [];
        siblings.push(candidate);
        byParent.set(candidate.parent, siblings);
    }

    const results: SectionCandidate[][] = [];

    for (const siblings of byParent.values()) {
        const bySignature = new Map<string, SectionCandidate[]>();

        for (const candidate of siblings) {
            const matches = bySignature.get(candidate.signature) ?? [];
            matches.push(candidate);
            bySignature.set(candidate.signature, matches);
        }

        for (const matches of bySignature.values()) {
            if (matches.length >= MIN_REPEATED_SECTIONS) {
                results.push(matches);
            }
        }
    }

    return results;
}

function deriveGroupName(
    candidates: SectionCandidate[],
): string {
    const first = candidates[0];

    const parentLabel = first.parent.getAttribute('aria-label');

    if (parentLabel) {
        return normalize(parentLabel);
    }

    const firstLabel = first.labels[0] ?? '';

    if (/conviction/i.test(firstLabel)) {
        return 'Driving Convictions';
    }

    if (firstLabel) {
        return `${firstLabel} Entries`;
    }

    return 'Repeated Group';
}

function getSharedClassSelector(
    candidates: SectionCandidate[],
): LocatorCandidate | undefined {
    const classLists = candidates.map((candidate) =>
        Array.from(candidate.element.classList),
    );

    if (classLists.length === 0) {
        return undefined;
    }

    const shared = classLists[0].filter((className) =>
        classLists.every((classes) => classes.includes(className)),
    );

    const stable = shared.find(
        (className) =>
            /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(className) &&
            !/^css-|^sc-|^jsx-/.test(className),
    );

    if (!stable) {
        return undefined;
    }

    return {
        strategy: 'css',
        value: `.${stable}`,
    };
}

function calculateConfidence(
    candidates: SectionCandidate[],
): number {
    const sharedLabels = candidates.every(
        (candidate) =>
            candidate.labels.join('|') ===
            candidates[0].labels.join('|'),
    );

    const sharedStructure = candidates.every(
        (candidate) =>
            candidate.signature === candidates[0].signature,
    );

    if (sharedLabels && sharedStructure) {
        return 0.95;
    }

    if (sharedStructure) {
        return 0.8;
    }

    return 0.5;
}

export function detectRepeatableGroups(
    root: ParentNode = document,
): RepeatableDetectionResult {
    const candidates = collectCandidates(root);
    const siblingGroups = groupSiblingCandidates(candidates);

    const groups: DetectedRepeatableGroup[] = [];
    const warnings: string[] = [];

    const usedElements = new Set<Element>();
    const keyOccurrences = new Map<string, number>();

    for (const candidates of siblingGroups) {
        if (candidates.some((item) => usedElements.has(item.element))) {
            continue;
        }

        const name = deriveGroupName(candidates);
        const slug = slugify(name);
        const occurrence = (keyOccurrences.get(slug) ?? 0) + 1;

        keyOccurrences.set(slug, occurrence);

        const key = occurrence === 1
            ? slug
            : `${slug}-${occurrence}`;

        const locator = getSharedClassSelector(candidates);
        const confidence = calculateConfidence(candidates);

        if (!locator) {
            warnings.push(
                `Repeatable group "${name}" has no shared stable class selector.`,
            );
        }

        const sections = candidates.map((candidate, index) => ({
            element: candidate.element,
            index: index + 1,
            fieldLabels: candidate.labels,
            structuralSignature: candidate.signature,
        }));

        groups.push({
            key,
            name,
            sections,
            confidence,
            selection: 'validated-position',
            ...(locator ? { locator } : {}),
        });

        for (const candidate of candidates) {
            usedElements.add(candidate.element);
        }
    }

    return { groups, warnings };
}
