
import type {
    LocatorCandidate,
    LocatorDefinition,
    ScannedElement,
} from '../models/generator.types';

function locatorCandidates(
    definition: LocatorDefinition,
): LocatorCandidate[] {
    return [
        definition.primary,
        ...definition.fallbacks,
    ];
}

function candidateKey(
    candidate: LocatorCandidate,
): string {
    return JSON.stringify([
        candidate.strategy,
        candidate.value,
        candidate.role ?? null,
        candidate.name ?? null,
        candidate.exact ?? true,
        candidate.scopeGroupKey ?? null,
    ]);
}

function sharedRepeatableLocators(
    members: readonly ScannedElement[],
    stableKey: string,
): LocatorDefinition {
    const first = members[0];
    const candidates = locatorCandidates(first.locators);

    const shared = candidates.filter((candidate) => {
        const key = candidateKey(candidate);

        return members.slice(1).every((member) =>
            locatorCandidates(member.locators).some(
                (other) => candidateKey(other) === key,
            ),
        );
    });

    if (shared.length === 0) {
        throw new Error(
            `Repeatable element "${stableKey}" has no locator ` +
            'validated in every instance. Generation blocked.',
        );
    }

    return {
        primary: shared[0],
        fallbacks: shared.slice(1),
    };
}

export function validateLogicalMembers(
    members: readonly ScannedElement[],
    stableKey: string,
): LocatorDefinition {
    const first = members[0];

    if (!first) {
        throw new Error(
            `Element "${stableKey}" has no scan members.`,
        );
    }

    for (const member of members) {
        if (
            member.kind !== first.kind ||
            member.repeatableGroupKey !== first.repeatableGroupKey
        ) {
            throw new Error(
                `Element "${stableKey}" groups incompatible controls.`,
            );
        }
    }

    if (members.length === 1) {
        return first.locators;
    }

    if (!first.repeatableGroupKey) {
        throw new Error(
            `Non-repeatable element "${stableKey}" has ` +
            'multiple scan members.',
        );
    }

    const instances = new Set<number>();

    for (const member of members) {
        const instance = member.repeatableInstance;

        if (
            instance === undefined ||
            !Number.isInteger(instance) ||
            instance < 1 ||
            instances.has(instance)
        ) {
            throw new Error(
                `Element "${stableKey}" has missing, invalid, ` +
                'or duplicate repeatable instance identities.',
            );
        }

        instances.add(instance);
    }

    return sharedRepeatableLocators(members, stableKey);
}
