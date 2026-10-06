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


        const locator =
            this.locatorSelector.select(
                validatedCandidates,
            );


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