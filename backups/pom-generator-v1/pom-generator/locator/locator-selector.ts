import type {
    GeneratedLocator,
    LocatorCandidate,
} from '../models/locator.model';

import {
    LocatorPriority,
} from './locator-priority';

export class LocatorSelector {

    constructor(
        private readonly priority =
            new LocatorPriority(),
    ) { }

    select(
        candidates: readonly LocatorCandidate[],
    ): GeneratedLocator {
        const uniqueCandidates =
            candidates.filter(
                candidate => candidate.unique,
            );

        const sorted =
            this.priority.sort(
                uniqueCandidates,
            );

        if (sorted.length === 0) {
            throw new Error(
                'Unable to generate a unique locator for the element.',
            );
        }

        const [
            preferred,
            ...fallbacks
        ] = sorted;

        return {
            preferred:
                preferred.descriptor,

            fallbacks:
                fallbacks.map(
                    candidate =>
                        candidate.descriptor,
                ),
        };
    }
}