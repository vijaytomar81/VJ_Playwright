
import type {
    Page,
} from '@playwright/test';

import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    GeneratedElement,
} from '../models/page.model';

import {
    ElementNameGenerator,
} from '../naming/element-name-generator';

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
    ElementFingerprintBuilder,
} from '../fingerprint/element-fingerprint';

import {
    StableKeyGenerator,
} from '../fingerprint/stable-key-generator';


export class GeneratedElementAssembler {

    private readonly locatorValidator:
        LocatorValidator;


    constructor(
        page: Page,

        private readonly nameGenerator =
            new ElementNameGenerator(),

        private readonly locatorBuilder =
            new LocatorBuilder(),

        private readonly locatorSelector =
            new LocatorSelector(),

        private readonly fingerprintBuilder =
            new ElementFingerprintBuilder(),

        private readonly stableKeyGenerator =
            new StableKeyGenerator(),
    ) {
        this.locatorValidator =
            new LocatorValidator(page);
    }


    async assemble(
        element: CapturedElement,
    ): Promise<GeneratedElement> {

        const name =
            this.nameGenerator.generate(
                element,
            );

        const candidates =
            this.locatorBuilder.build(
                element,
            );

        const validatedCandidates =
            await this.locatorValidator.validate(
                candidates,
            );

        let locator: GeneratedElement['locator'];

        try {
            locator =
                this.locatorSelector.select(
                    validatedCandidates,
                );
        } catch (error) {

            /*
             * Diagnostic information for elements
             * without a unique locator.
             *
             * No fallback locator is invented.
             * Existing uniqueness rules are preserved.
             */
            const details = {
                generatedName:
                    name,

                tagName:
                    element.tagName,

                type:
                    element.type,

                role:
                    element.role,

                label:
                    element.label,

                text:
                    element.text?.slice(0, 100),

                id:
                    element.id,

                name:
                    element.name,

                testId:
                    element.testId,

                placeholder:
                    element.placeholder,

                ariaLabel:
                    element.ariaLabel,

                context:
                    element.context,

                /*
                 * Additional diagnostic metadata.
                 *
                 * These values are captured by
                 * ElementMetadataReader and forwarded
                 * through DomScanner.
                 *
                 * They are used only for diagnostics,
                 * not for locator generation.
                 */
                title:
                    element.title,

                outerHTML:
                    element.outerHTML,

                candidates:
                    validatedCandidates.map(
                        candidate => ({
                            strategy:
                                candidate.strategy,

                            descriptor:
                                candidate.descriptor,

                            unique:
                                candidate.unique,

                            matchCount:
                                candidate.matchCount,
                        }),
                    ),
            };

            throw new Error(
                'Unable to generate a unique locator.\n' +
                JSON.stringify(
                    details,
                    null,
                    2,
                ),
                {
                    cause: error,
                },
            );
        }

        const fingerprint =
            this.fingerprintBuilder.build(
                element,
            );

        const stableKey =
            this.stableKeyGenerator.generate();

        return {
            name,

            type:
                element.type,

            locator,

            stableKey,

            fingerprint,
        };
    }


    async assembleAll(
        elements:
            readonly CapturedElement[],
    ): Promise<GeneratedElement[]> {

        const generatedElements:
            GeneratedElement[] = [];

        for (const element of elements) {

            const generatedElement =
                await this.assemble(
                    element,
                );

            generatedElements.push(
                generatedElement,
            );
        }

        return generatedElements;
    }
}
