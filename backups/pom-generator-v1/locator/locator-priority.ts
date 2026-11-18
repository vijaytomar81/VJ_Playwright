import {
    PomGeneratorConfig,
} from '../config/pom-generator.config';

import type {
    LocatorCandidate,
    LocatorStrategy,
} from '../models/locator.model';

export class LocatorPriority {

    getPriority(
        strategy: LocatorStrategy,
    ): number {
        const index =
            PomGeneratorConfig.locatorPriority.indexOf(
                strategy,
            );

        return index === -1
            ? Number.MAX_SAFE_INTEGER
            : index;
    }

    sort(
        candidates: readonly LocatorCandidate[],
    ): LocatorCandidate[] {
        return [...candidates].sort(
            (a, b) =>
                this.getPriority(a.strategy) -
                this.getPriority(b.strategy),
        );
    }
}