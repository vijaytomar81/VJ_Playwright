
import type {
    GeneratedElement,
} from '../models/page.model';

import type {
    ElementChange,
} from '../models/change.model';

import {
    ElementComparator,
} from './element-comparator';

import {
    FingerprintMatcher,
} from '../fingerprint/fingerprint-matcher';

import type {
    FingerprintMatchResult,
} from '../fingerprint/fingerprint-matcher';


interface MatchCandidate {
    existingIndex: number;
    currentIndex: number;
    match: FingerprintMatchResult;
}

interface AttributeIdentity {
    kind: 'testid' | 'id';
    value: string;
}


export class PageComparator {

    private readonly ambiguityTolerance = 0.05;

    constructor(
        private readonly elementComparator =
            new ElementComparator(),

        private readonly fingerprintMatcher =
            new FingerprintMatcher(),
    ) { }


    compare(
        existing: readonly GeneratedElement[],
        current: readonly GeneratedElement[],
    ): ElementChange[] {

        this.assertUniqueStableKeys(
            existing,
            'existing',
        );

        this.assertUniqueStableKeys(
            current,
            'current',
        );

        const changes: ElementChange[] = [];

        const matchedExistingIndexes =
            new Set<number>();

        const matchedCurrentIndexes =
            new Set<number>();

        const ambiguousExistingIndexes =
            new Set<number>();

        const ambiguousCurrentIndexes =
            new Set<number>();

        const existingIdentities =
            existing.map(element =>
                this.getAttributeIdentities(element),
            );

        const currentIdentities =
            current.map(element =>
                this.getAttributeIdentities(element),
            );

        /*
         * Pass 0: detect duplicate target identities.
         *
         * This must run before stable-key,
         * attribute, and fingerprint matching.
         *
         * Two existing metadata entries that
         * claim the same target must never
         * compete for a single scanned element.
         */
        const duplicateGroups =
            this.findDuplicateIdentityGroups(
                existing,
                existingIdentities,
            );

        for (const group of duplicateGroups) {

            const relatedCurrentIndexes =
                current
                    .map((element, index) => ({
                        element,
                        index,
                    }))
                    .filter(
                        ({ element, index }) =>
                            group.some(
                                existingIndex =>
                                    existing[
                                        existingIndex
                                    ].type ===
                                    element.type &&
                                    this.identitiesOverlap(
                                        existingIdentities[
                                        existingIndex
                                        ],
                                        currentIdentities[
                                        index
                                        ],
                                    ) &&
                                    !this.identitiesConflict(
                                        existingIdentities[
                                        existingIndex
                                        ],
                                        currentIdentities[
                                        index
                                        ],
                                    ),
                            ),
                    )
                    .map(({ index }) => index);

            /*
             * If the duplicated target is not
             * present in this scan, ordinary
             * NOT_FOUND handling remains valid.
             */
            if (
                relatedCurrentIndexes.length === 0
            ) {
                continue;
            }

            for (const existingIndex of group) {

                if (
                    ambiguousExistingIndexes.has(
                        existingIndex,
                    )
                ) {
                    continue;
                }

                ambiguousExistingIndexes.add(
                    existingIndex,
                );

                const existingElement =
                    existing[existingIndex];

                changes.push({
                    type: 'AMBIGUOUS',
                    elementName:
                        existingElement.name,
                    stableKey:
                        existingElement.stableKey,
                    existing:
                        existingElement,
                    matchScore: 1,
                    matchedFields: [
                        'duplicateAttributeIdentity',
                    ],
                    candidateStableKeys:
                        relatedCurrentIndexes.map(
                            currentIndex =>
                                current[
                                    currentIndex
                                ].stableKey,
                        ),
                });
            }

            for (
                const currentIndex
                of relatedCurrentIndexes
            ) {
                ambiguousCurrentIndexes.add(
                    currentIndex,
                );
            }
        }

        /*
         * Pass 1: exact stable-key matching.
         *
         * Do not override duplicate-identity
         * ambiguity, even when keys match.
         */
        const currentKeyIndexes =
            this.indexStableKeys(current);

        existing.forEach(
            (existingElement, existingIndex) => {

                if (
                    ambiguousExistingIndexes.has(
                        existingIndex,
                    )
                ) {
                    return;
                }

                const currentIndexes =
                    currentKeyIndexes.get(
                        existingElement.stableKey,
                    ) ?? [];

                if (
                    currentIndexes.length !== 1
                ) {
                    return;
                }

                const currentIndex =
                    currentIndexes[0];

                if (
                    matchedCurrentIndexes.has(
                        currentIndex,
                    ) ||
                    ambiguousCurrentIndexes.has(
                        currentIndex,
                    )
                ) {
                    return;
                }

                matchedExistingIndexes.add(
                    existingIndex,
                );

                matchedCurrentIndexes.add(
                    currentIndex,
                );

                changes.push(
                    this.compareMatchedElements(
                        existingElement,
                        current[currentIndex],
                        1,
                    ),
                );
            },
        );

        /*
         * Pass 2: unique attribute-identity
         * matching.
         */
        existing.forEach(
            (existingElement, existingIndex) => {

                if (
                    matchedExistingIndexes.has(
                        existingIndex,
                    ) ||
                    ambiguousExistingIndexes.has(
                        existingIndex,
                    )
                ) {
                    return;
                }

                const identities =
                    existingIdentities[
                    existingIndex
                    ];

                if (identities.length === 0) {
                    return;
                }

                const eligibleCurrentIndexes =
                    current
                        .map((element, index) => ({
                            element,
                            index,
                        }))
                        .filter(
                            ({ element, index }) =>
                                !matchedCurrentIndexes.has(
                                    index,
                                ) &&
                                !ambiguousCurrentIndexes.has(
                                    index,
                                ) &&
                                existingElement.type ===
                                element.type &&
                                this.identitiesOverlap(
                                    identities,
                                    currentIdentities[
                                    index
                                    ],
                                ) &&
                                !this.identitiesConflict(
                                    identities,
                                    currentIdentities[
                                    index
                                    ],
                                ),
                        )
                        .map(({ index }) => index);

                if (
                    eligibleCurrentIndexes.length !== 1
                ) {
                    return;
                }

                const currentIndex =
                    eligibleCurrentIndexes[0];

                const currentElement =
                    current[currentIndex];

                const eligibleExistingIndexes =
                    existing
                        .map((element, index) => ({
                            element,
                            index,
                        }))
                        .filter(
                            ({ element, index }) =>
                                !matchedExistingIndexes.has(
                                    index,
                                ) &&
                                !ambiguousExistingIndexes.has(
                                    index,
                                ) &&
                                element.type ===
                                currentElement.type &&
                                this.identitiesOverlap(
                                    existingIdentities[
                                    index
                                    ],
                                    currentIdentities[
                                    currentIndex
                                    ],
                                ) &&
                                !this.identitiesConflict(
                                    existingIdentities[
                                    index
                                    ],
                                    currentIdentities[
                                    currentIndex
                                    ],
                                ),
                        )
                        .map(({ index }) => index);

                if (
                    eligibleExistingIndexes.length !== 1 ||
                    eligibleExistingIndexes[0] !==
                    existingIndex
                ) {
                    return;
                }

                const matchedCurrent: GeneratedElement = {
                    ...currentElement,
                    stableKey:
                        existingElement.stableKey,
                };

                matchedExistingIndexes.add(
                    existingIndex,
                );

                matchedCurrentIndexes.add(
                    currentIndex,
                );

                changes.push(
                    this.compareMatchedElements(
                        existingElement,
                        matchedCurrent,
                        1,
                        ['attributeIdentity'],
                    ),
                );
            },
        );

        /*
         * Pass 3: fingerprint matching.
         *
         * Exclude duplicate-identity elements
         * and reject conflicting target IDs.
         */
        const candidates: MatchCandidate[] = [];

        existing.forEach(
            (existingElement, existingIndex) => {

                if (
                    matchedExistingIndexes.has(
                        existingIndex,
                    ) ||
                    ambiguousExistingIndexes.has(
                        existingIndex,
                    )
                ) {
                    return;
                }

                current.forEach(
                    (currentElement, currentIndex) => {

                        if (
                            matchedCurrentIndexes.has(
                                currentIndex,
                            ) ||
                            ambiguousCurrentIndexes.has(
                                currentIndex,
                            )
                        ) {
                            return;
                        }

                        if (
                            existingElement.type !==
                            currentElement.type ||
                            this.identitiesConflict(
                                existingIdentities[
                                existingIndex
                                ],
                                currentIdentities[
                                currentIndex
                                ],
                            )
                        ) {
                            return;
                        }

                        const match =
                            this.fingerprintMatcher.match(
                                existingElement.fingerprint,
                                currentElement.fingerprint,
                            );

                        if (!match.matched) {
                            return;
                        }

                        candidates.push({
                            existingIndex,
                            currentIndex,
                            match,
                        });
                    },
                );
            },
        );

        const safeCandidates =
            candidates.filter(candidate => {

                const competingCurrent =
                    candidates.some(
                        other =>
                            other.existingIndex ===
                            candidate.existingIndex &&
                            other.currentIndex !==
                            candidate.currentIndex &&
                            other.match.score >=
                            candidate.match.score -
                            this.ambiguityTolerance,
                    );

                const competingExisting =
                    candidates.some(
                        other =>
                            other.currentIndex ===
                            candidate.currentIndex &&
                            other.existingIndex !==
                            candidate.existingIndex &&
                            other.match.score >=
                            candidate.match.score -
                            this.ambiguityTolerance,
                    );

                return (
                    !competingCurrent &&
                    !competingExisting
                );
            });

        safeCandidates.sort(
            (left, right) =>
                right.match.score -
                left.match.score,
        );

        for (const candidate of safeCandidates) {

            if (
                matchedExistingIndexes.has(
                    candidate.existingIndex,
                ) ||
                matchedCurrentIndexes.has(
                    candidate.currentIndex,
                )
            ) {
                continue;
            }

            const existingElement =
                existing[
                candidate.existingIndex
                ];

            const currentElement =
                current[
                candidate.currentIndex
                ];

            const matchedCurrent: GeneratedElement = {
                ...currentElement,
                stableKey:
                    existingElement.stableKey,
            };

            matchedExistingIndexes.add(
                candidate.existingIndex,
            );

            matchedCurrentIndexes.add(
                candidate.currentIndex,
            );

            changes.push(
                this.compareMatchedElements(
                    existingElement,
                    matchedCurrent,
                    candidate.match.score,
                    candidate.match.matchedFields,
                    candidate.match.conflictingFields,
                ),
            );
        }

        /*
         * Pass 4: remaining fingerprint
         * ambiguities.
         */
        existing.forEach(
            (existingElement, existingIndex) => {

                if (
                    matchedExistingIndexes.has(
                        existingIndex,
                    ) ||
                    ambiguousExistingIndexes.has(
                        existingIndex,
                    )
                ) {
                    return;
                }

                const remainingCandidates =
                    candidates.filter(
                        candidate =>
                            candidate.existingIndex ===
                            existingIndex &&
                            !matchedCurrentIndexes.has(
                                candidate.currentIndex,
                            ),
                    );

                if (
                    remainingCandidates.length === 0
                ) {
                    return;
                }

                ambiguousExistingIndexes.add(
                    existingIndex,
                );

                for (
                    const candidate
                    of remainingCandidates
                ) {
                    ambiguousCurrentIndexes.add(
                        candidate.currentIndex,
                    );
                }

                const bestScore =
                    Math.max(
                        ...remainingCandidates.map(
                            candidate =>
                                candidate.match.score,
                        ),
                    );

                changes.push({
                    type: 'AMBIGUOUS',
                    elementName:
                        existingElement.name,
                    stableKey:
                        existingElement.stableKey,
                    existing:
                        existingElement,
                    matchScore:
                        bestScore,
                    candidateStableKeys:
                        remainingCandidates.map(
                            candidate =>
                                current[
                                    candidate.currentIndex
                                ].stableKey,
                        ),
                });
            },
        );

        /*
         * Pass 5: missing existing elements.
         */
        existing.forEach(
            (existingElement, existingIndex) => {

                if (
                    matchedExistingIndexes.has(
                        existingIndex,
                    ) ||
                    ambiguousExistingIndexes.has(
                        existingIndex,
                    )
                ) {
                    return;
                }

                changes.push({
                    type: 'NOT_FOUND',
                    elementName:
                        existingElement.name,
                    stableKey:
                        existingElement.stableKey,
                    existing:
                        existingElement,
                });
            },
        );

        /*
         * Pass 6: genuinely new elements.
         */
        current.forEach(
            (currentElement, currentIndex) => {

                if (
                    matchedCurrentIndexes.has(
                        currentIndex,
                    ) ||
                    ambiguousCurrentIndexes.has(
                        currentIndex,
                    )
                ) {
                    return;
                }

                changes.push({
                    type: 'NEW',
                    elementName:
                        currentElement.name,
                    stableKey:
                        currentElement.stableKey,
                    current:
                        currentElement,
                });
            },
        );

        return changes;
    }


    /*
     * Find connected groups of existing
     * elements that claim the same target
     * identity.
     *
     * Grouping is limited to the same element
     * type and the same ID/test-ID kind.
     */
    private findDuplicateIdentityGroups(
        elements: readonly GeneratedElement[],
        identities: readonly AttributeIdentity[][],
    ): number[][] {

        const parent =
            elements.map((_, index) => index);

        const find = (index: number): number => {

            while (parent[index] !== index) {
                index = parent[index];
            }

            return index;
        };

        const join = (
            left: number,
            right: number,
        ): void => {

            const leftRoot = find(left);
            const rightRoot = find(right);

            if (leftRoot !== rightRoot) {
                parent[rightRoot] = leftRoot;
            }
        };

        for (
            let left = 0;
            left < elements.length;
            left++
        ) {

            for (
                let right = left + 1;
                right < elements.length;
                right++
            ) {

                if (
                    elements[left].type !==
                    elements[right].type
                ) {
                    continue;
                }

                if (
                    this.identitiesOverlap(
                        identities[left],
                        identities[right],
                    )
                ) {
                    join(left, right);
                }
            }
        }

        const groups =
            new Map<number, number[]>();

        elements.forEach((_, index) => {

            const root = find(index);

            const group =
                groups.get(root) ?? [];

            group.push(index);
            groups.set(root, group);
        });

        return [...groups.values()]
            .filter(group =>
                group.length > 1,
            );
    }


    private getAttributeIdentities(
        element: GeneratedElement,
    ): AttributeIdentity[] {

        const locators = [
            element.locator.preferred,
            ...element.locator.fallbacks,
        ];

        const identities: AttributeIdentity[] = [];

        for (const locator of locators) {

            if (locator.startsWith('testid=')) {

                const value =
                    locator.slice(
                        'testid='.length,
                    );

                if (value) {
                    identities.push({
                        kind: 'testid',
                        value,
                    });
                }

                continue;
            }

            const idMatch =
                locator.match(
                    /^css=#([a-zA-Z_][a-zA-Z0-9_-]*)$/,
                );

            if (idMatch) {
                identities.push({
                    kind: 'id',
                    value: idMatch[1],
                });
            }
        }

        return identities;
    }


    private identitiesOverlap(
        left: readonly AttributeIdentity[],
        right: readonly AttributeIdentity[],
    ): boolean {

        return left.some(
            leftIdentity =>
                right.some(
                    rightIdentity =>
                        leftIdentity.kind ===
                        rightIdentity.kind &&
                        leftIdentity.value ===
                        rightIdentity.value,
                ),
        );
    }


    private identitiesConflict(
        left: readonly AttributeIdentity[],
        right: readonly AttributeIdentity[],
    ): boolean {

        const kinds: readonly AttributeIdentity['kind'][] = [
            'testid',
            'id',
        ];

        return kinds.some(kind => {

            const leftValues = new Set(
                left
                    .filter(identity =>
                        identity.kind === kind,
                    )
                    .map(identity =>
                        identity.value,
                    ),
            );

            const rightValues = new Set(
                right
                    .filter(identity =>
                        identity.kind === kind,
                    )
                    .map(identity =>
                        identity.value,
                    ),
            );

            if (
                leftValues.size === 0 ||
                rightValues.size === 0
            ) {
                return false;
            }

            return (
                leftValues.size !== 1 ||
                rightValues.size !== 1 ||
                ![...leftValues].every(
                    value => rightValues.has(value),
                )
            );
        });
    }


    private assertUniqueStableKeys(
        elements: readonly GeneratedElement[],
        collection: 'existing' | 'current',
    ): void {

        const seen =
            new Set<string>();

        for (const element of elements) {

            const stableKey =
                element.stableKey?.trim();

            if (!stableKey) {
                throw new Error(
                    `PageComparator: missing stable key ` +
                    `for "${element.name}" in ${collection} elements.`,
                );
            }

            if (seen.has(stableKey)) {
                throw new Error(
                    `PageComparator: duplicate stable key ` +
                    `"${stableKey}" in ${collection} elements.`,
                );
            }

            seen.add(stableKey);
        }
    }


    private indexStableKeys(
        elements: readonly GeneratedElement[],
    ): Map<string, number[]> {

        const indexes =
            new Map<string, number[]>();

        elements.forEach(
            (element, index) => {

                const existingIndexes =
                    indexes.get(
                        element.stableKey,
                    ) ?? [];

                existingIndexes.push(index);

                indexes.set(
                    element.stableKey,
                    existingIndexes,
                );
            },
        );

        return indexes;
    }


    private compareMatchedElements(
        existing: GeneratedElement,
        current: GeneratedElement,
        matchScore: number,
        matchedFields:
            readonly string[] = [],
        conflictingFields:
            readonly string[] = [],
    ): ElementChange {

        const comparison =
            this.elementComparator.compare(
                existing,
                current,
            );

        return {
            type:
                comparison.changed
                    ? 'CHANGED'
                    : 'UNCHANGED',
            elementName:
                existing.name,
            stableKey:
                existing.stableKey,
            existing,
            current,
            matchScore,
            matchedFields,
            conflictingFields,
        };
    }
}
