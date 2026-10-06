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

export class PageComparator {

    constructor(
        private readonly elementComparator =
            new ElementComparator(),

        private readonly fingerprintMatcher =
            new FingerprintMatcher(),
    ) { }


    compare(
        existing:
            readonly GeneratedElement[],

        current:
            readonly GeneratedElement[],
    ): ElementChange[] {

        const changes:
            ElementChange[] = [];

        const matchedCurrentIndexes =
            new Set<number>();


        /*
         * Pass 1:
         *
         * Exact stable-key matching.
         *
         * This is always preferred over fingerprint
         * matching because stableKey represents
         * persisted logical identity.
         */
        existing.forEach(existingElement => {

            const index =
                current.findIndex(
                    (
                        currentElement,
                        currentIndex,
                    ) =>
                        !matchedCurrentIndexes.has(
                            currentIndex,
                        ) &&
                        Boolean(
                            existingElement.stableKey,
                        ) &&
                        existingElement.stableKey ===
                        currentElement.stableKey,
                );

            if (index === -1) {
                return;
            }

            matchedCurrentIndexes.add(
                index,
            );

            changes.push(
                this.compareMatchedElements(
                    existingElement,
                    current[index],
                    1,
                ),
            );
        });


        /*
         * Existing elements not already resolved
         * through stableKey.
         */
        const matchedExistingKeys =
            new Set(
                changes
                    .map(change =>
                        change.existing
                            ?.stableKey,
                    )
                    .filter(
                        (
                            value,
                        ): value is string =>
                            Boolean(value),
                    ),
            );


        for (
            const existingElement
            of existing
        ) {

            if (
                existingElement.stableKey &&
                matchedExistingKeys.has(
                    existingElement.stableKey,
                )
            ) {
                continue;
            }


            const candidates =
                current
                    .map(
                        (
                            currentElement,
                            index,
                        ) => ({
                            currentElement,
                            index,

                            match:
                                this.fingerprintMatcher
                                    .match(
                                        existingElement
                                            .fingerprint,

                                        currentElement
                                            .fingerprint,
                                    ),
                        }),
                    )
                    .filter(candidate =>
                        !matchedCurrentIndexes.has(
                            candidate.index,
                        ),
                    )
                    .filter(candidate =>
                        candidate.match.matched,
                    )
                    .sort(
                        (left, right) =>
                            right.match.score -
                            left.match.score,
                    );


            /*
             * No candidate.
             *
             * IMPORTANT:
             * This does not mean delete.
             */
            if (
                candidates.length === 0
            ) {
                changes.push({
                    type: 'NOT_FOUND',

                    elementName:
                        existingElement.name,

                    stableKey:
                        existingElement.stableKey,

                    existing:
                        existingElement,
                });

                continue;
            }


            const best =
                candidates[0];

            const second =
                candidates[1];


            /*
             * Two very similar candidates mean
             * we cannot safely establish identity.
             *
             * A difference <= 0.05 is considered
             * ambiguous for now.
             */
            if (
                second &&
                Math.abs(
                    best.match.score -
                    second.match.score,
                ) <= 0.05
            ) {
                changes.push({
                    type: 'AMBIGUOUS',

                    elementName:
                        existingElement.name,

                    stableKey:
                        existingElement.stableKey,

                    existing:
                        existingElement,

                    matchScore:
                        best.match.score,

                    candidateStableKeys:
                        candidates
                            .map(candidate =>
                                candidate.currentElement
                                    .stableKey,
                            )
                            .filter(
                                (
                                    value,
                                ): value is string =>
                                    Boolean(value),
                            ),
                });

                continue;
            }


            matchedCurrentIndexes.add(
                best.index,
            );


            /*
             * Reuse the existing stable identity.
             *
             * A regenerated locator must NOT create
             * a new logical element identity.
             */
            const matchedCurrent:
                GeneratedElement = {
                ...best.currentElement,

                stableKey:
                    existingElement.stableKey,
            };


            changes.push(
                this.compareMatchedElements(
                    existingElement,
                    matchedCurrent,
                    best.match.score,
                    best.match.matchedFields,
                    best.match.conflictingFields,
                ),
            );
        }


        /*
         * Anything in the current scan that was
         * never matched is genuinely NEW.
         */
        current.forEach(
            (
                currentElement,
                index,
            ) => {

                if (
                    matchedCurrentIndexes.has(
                        index,
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