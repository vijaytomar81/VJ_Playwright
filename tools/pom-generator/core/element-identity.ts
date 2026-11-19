import type {
    ElementFingerprint,
    ElementKey,
    ElementKind,
    ScannedElement,
    StoredElement,
} from '../models/generator.types';
export interface IdentityCandidate {
    existingKey: ElementKey;
    score: number;
    reasons: string[];
}
export interface IdentityDecision {
    scannedId: string;
    status: 'matched' | 'new' | 'ambiguous';
    stableKey?: ElementKey;
    confidence: number;
    candidates: IdentityCandidate[];
    reason: string;
}
export interface IdentityResolution {
    decisions: IdentityDecision[];
    unmatchedExistingKeys: ElementKey[];
    warnings: string[];
}
interface LogicalScan {
    representative: ScannedElement;
    members: ScannedElement[];
    ambiguous?: string;
}
const MATCH_THRESHOLD = 65;
const AMBIGUITY_MARGIN = 12;
function normalize(value: string | undefined): string {
    return (value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function same(
    left: string | undefined,
    right: string | undefined,
): boolean {
    return Boolean(
        left && right && normalize(left) === normalize(right),
    );
}
function normalizedAttribute(
    value: string | undefined,
    repeatable: boolean,
): string {
    const normalized = normalize(value);
    return repeatable
        ? normalized.replace(/\b\d+\b/g, '#')
        : normalized;
}
function semanticLabel(
    fingerprint: ElementFingerprint,
): string {
    const labels = fingerprint.labels;
    return normalize(
        labels.parentField ||
        labels.direct ||
        labels.accessible ||
        fingerprint.placeholder ||
        fingerprint.ariaLabel ||
        fingerprint.text,
    );
}
function fieldSignature(
    element: ScannedElement,
): string {
    const fingerprint = element.fingerprint;
    const repeatable = Boolean(element.repeatableGroupKey);
    return [
        element.kind,
        element.repeatableGroupKey ?? element.groupKey ?? '',
        semanticLabel(fingerprint),
        normalize(fingerprint.inputType),
        normalizedAttribute(fingerprint.id, repeatable),
        normalizedAttribute(fingerprint.name, repeatable),
    ].join('|');
}
function hasIdentityEvidence(
    element: ScannedElement,
): boolean {
    const fingerprint = element.fingerprint;
    return Boolean(
        semanticLabel(fingerprint) ||
        fingerprint.id ||
        fingerprint.name,
    );
}
function collectLogicalScans(
    elements: readonly ScannedElement[],
): LogicalScan[] {
    const groups: LogicalScan[] = [];
    const repeatable = new Map<string, LogicalScan>();
    for (const element of elements) {
        if (!element.repeatableGroupKey) {
            groups.push({
                representative: element,
                members: [element],
            });
            continue;
        }
        if (!hasIdentityEvidence(element)) {
            groups.push({
                representative: element,
                members: [element],
                ambiguous:
                    'Repeatable field has no distinguishing identity.',
            });
            continue;
        }
        const signature = fieldSignature(element);
        const existing = repeatable.get(signature);
        if (!existing) {
            const group: LogicalScan = {
                representative: element,
                members: [element],
            };
            repeatable.set(signature, group);
            groups.push(group);
            continue;
        }
        const instance = element.repeatableInstance;
        if (
            instance === undefined ||
            existing.members.some(
                (member) =>
                    member.repeatableInstance === undefined ||
                    member.repeatableInstance === instance,
            )
        ) {
            existing.ambiguous =
                'Indistinguishable repeatable fields occur ' +
                'within the same instance.';
        }
        existing.members.push(element);
    }
    return groups;
}
function compareFingerprints(
    scanned: ScannedElement,
    stored: StoredElement,
): IdentityCandidate {
    const left = scanned.fingerprint;
    const right = stored.fingerprint;
    const reasons: string[] = [];
    let score = 0;
    if (scanned.kind !== stored.kind) {
        return {
            existingKey: stored.stableKey,
            score: 0,
            reasons: ['Different element kinds.'],
        };
    }
    score += 15;
    reasons.push('Same element kind.');
    const scannedRepeatable = Boolean(scanned.repeatableGroupKey);
    const storedRepeatable = Boolean(stored.repeatableGroupKey);
    if (scannedRepeatable !== storedRepeatable) {
        return {
            existingKey: stored.stableKey,
            score: 0,
            reasons: ['Repeatable identity mismatch.'],
        };
    }
    if (scannedRepeatable) {
        if (
            scanned.repeatableGroupKey !== stored.repeatableGroupKey
        ) {
            return {
                existingKey: stored.stableKey,
                score: 0,
                reasons: ['Different repeatable groups.'],
            };
        }
        score += 20;
        reasons.push('Same repeatable group.');
    } else if (
        scanned.groupKey &&
        stored.groupKey &&
        scanned.groupKey === stored.groupKey
    ) {
        score += 10;
        reasons.push('Same parent group.');
    }
    if (same(left.labels.direct, right.labels.direct)) {
        score += 25;
        reasons.push('Same direct label.');
    }
    if (same(left.labels.parentField, right.labels.parentField)) {
        score += 20;
        reasons.push('Same parent field label.');
    }
    if (same(left.labels.accessible, right.labels.accessible)) {
        score += 15;
        reasons.push('Same accessible label.');
    }
    if (same(left.labels.parentGroup, right.labels.parentGroup)) {
        score += 10;
        reasons.push('Same parent group label.');
    }
    if (same(left.placeholder, right.placeholder)) {
        score += 8;
        reasons.push('Same placeholder.');
    }
    const repeatable = scannedRepeatable;
    if (
        normalizedAttribute(left.id, repeatable) &&
        normalizedAttribute(left.id, repeatable) ===
        normalizedAttribute(right.id, repeatable)
    ) {
        score += 25;
        reasons.push('Matching ID pattern.');
    }
    if (
        normalizedAttribute(left.name, repeatable) &&
        normalizedAttribute(left.name, repeatable) ===
        normalizedAttribute(right.name, repeatable)
    ) {
        score += 20;
        reasons.push('Matching name pattern.');
    }
    if (left.tagName === right.tagName) {
        score += 5;
    }
    if (same(left.inputType, right.inputType)) {
        score += 5;
    }
    return {
        existingKey: stored.stableKey,
        score,
        reasons,
    };
}
function scoreCandidates(
    scanned: ScannedElement,
    existing: readonly StoredElement[],
): IdentityCandidate[] {
    return existing
        .map((stored) => compareFingerprints(scanned, stored))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score);
}
function decideMatch(
    scanned: ScannedElement,
    existing: readonly StoredElement[],
): IdentityDecision {
    const candidates = scoreCandidates(scanned, existing);
    const best = candidates[0];
    const second = candidates[1];
    if (!best || best.score < MATCH_THRESHOLD) {
        return {
            scannedId: scanned.temporaryId,
            status: 'new',
            confidence: 0,
            candidates,
            reason: 'No sufficiently strong existing identity match.',
        };
    }
    if (
        second &&
        best.score - second.score < AMBIGUITY_MARGIN
    ) {
        return {
            scannedId: scanned.temporaryId,
            status: 'ambiguous',
            confidence: best.score,
            candidates,
            reason:
                'Multiple existing elements have similar identities.',
        };
    }
    return {
        scannedId: scanned.temporaryId,
        status: 'matched',
        stableKey: best.existingKey,
        confidence: best.score,
        candidates,
        reason: best.reasons.join(' '),
    };
}
function createStableKey(
    used: Set<string>,
    prefix = 'el',
): string {
    let next = 1;
    while (
        used.has(`${prefix}_${String(next).padStart(3, '0')}`)
    ) {
        next++;
    }
    const key = `${prefix}_${String(next).padStart(3, '0')}`;
    used.add(key);
    return key;
}
export function resolveElementIdentities(
    scanned: readonly ScannedElement[],
    existing: readonly StoredElement[],
): IdentityResolution {
    const logicalScans = collectLogicalScans(scanned);
    const usedKeys = new Set(
        existing.map((element) => element.stableKey),
    );
    const claimedExisting = new Set<string>();
    const decisions: IdentityDecision[] = [];
    const warnings: string[] = [];
    for (const logical of logicalScans) {
        const decision: IdentityDecision = logical.ambiguous
            ? {
                scannedId: logical.representative.temporaryId,
                status: 'ambiguous',
                confidence: 0,
                candidates: [],
                reason: logical.ambiguous,
            }
            : decideMatch(logical.representative, existing);
        if (
            decision.status === 'matched' &&
            decision.stableKey &&
            claimedExisting.has(decision.stableKey)
        ) {
            decision.status = 'ambiguous';
            decision.reason =
                'Multiple scanned fields claim the same stable key.';
            delete decision.stableKey;
        }
        if (
            decision.status === 'matched' &&
            decision.stableKey
        ) {
            claimedExisting.add(decision.stableKey);
        }
        if (decision.status === 'new') {
            decision.stableKey = createStableKey(usedKeys);
        }
        if (decision.status === 'ambiguous') {
            warnings.push(
                `Ambiguous identity for ${decision.scannedId}: ` +
                decision.reason,
            );
        }
        for (const member of logical.members) {
            decisions.push({
                ...decision,
                scannedId: member.temporaryId,
            });
        }
    }
    const unmatchedExistingKeys = existing
        .filter(
            (element) => !claimedExisting.has(element.stableKey),
        )
        .map((element) => element.stableKey);
    return {
        decisions,
        unmatchedExistingKeys,
        warnings,
    };
}
