
import type {
    ElementHandle,
    Page,
} from '@playwright/test';

import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    LocatorCandidate,
    GeneratedLocator,
} from '../models/locator.model';

import {
    LocatorBuilder,
} from '../locator/locator-builder';

import {
    LocatorValidator,
} from '../locator/locator-validator';

import {
    LocatorSelector,
} from '../locator/locator-selector';

import {
    AdaptiveLocatorRefiner,
} from '../locator/adaptive-locator-refiner';


export type LocatorResolutionResult =
    | {
        success: true;
        locator: GeneratedLocator;
    }
    | {
        success: false;
        candidates: readonly LocatorCandidate[];
    };


export class GeneratedElementLocatorResolver {

    private readonly locatorValidator:
        LocatorValidator;

    constructor(
        page: Page,

        private readonly locatorBuilder =
            new LocatorBuilder(),

        private readonly locatorSelector =
            new LocatorSelector(),

        private readonly adaptiveLocatorRefiner =
            new AdaptiveLocatorRefiner(),
    ) {
        this.locatorValidator =
            new LocatorValidator(page);
    }


    /**
     * Resolve the locator for one captured element.
     *
     * Existing validated locator candidates are
     * preferred over adaptive refinement.
     */
    async resolve(
        element: CapturedElement,
        originalElement?: ElementHandle<
            HTMLElement | SVGElement
        >,
    ): Promise<LocatorResolutionResult> {

        const candidates =
            this.locatorBuilder.build(element);

        let validatedCandidates =
            await this.locatorValidator.validate(
                candidates,
                originalElement,
            );

        const hasValidCandidate =
            validatedCandidates.some(
                candidate => candidate.unique,
            );

        /*
         * Only attempt adaptive refinement when
         * the initial candidates contain no
         * valid unique locator.
         */
        if (
            !hasValidCandidate &&
            originalElement
        ) {
            const refinedCandidates =
                await this.adaptiveLocatorRefiner.refine(
                    element,
                    originalElement,
                );

            const validatedRefinedCandidates =
                await this.locatorValidator.validate(
                    refinedCandidates,
                    originalElement,
                );

            validatedCandidates = [
                ...validatedCandidates,
                ...validatedRefinedCandidates,
            ];
        }

        const uniqueCandidates =
            validatedCandidates.filter(
                candidate => candidate.unique,
            );

        /*
         * Return structured failure information.
         * The assembler remains responsible for
         * creating UnresolvedLocatorError.
         */
        if (uniqueCandidates.length === 0) {
            return {
                success: false,
                candidates: validatedCandidates,
            };
        }

        const locator =
            this.locatorSelector.select(
                validatedCandidates,
            );

        return {
            success: true,
            locator,
        };
    }
}
