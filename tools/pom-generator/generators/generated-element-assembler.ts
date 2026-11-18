
import type {
    ElementHandle,
    Page,
} from '@playwright/test';

import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    GeneratedElement,
} from '../models/page.model';

import type {
    UnresolvedElement,
} from '../models/unresolved-element.model';

import type {
    ScannedElementWithHandle,
} from '../scanner/dom-scanner';

import {
    ElementNameGenerator,
} from '../naming/element-name-generator';

import {
    ElementFingerprintBuilder,
} from '../fingerprint/element-fingerprint';

import {
    StableKeyGenerator,
} from '../fingerprint/stable-key-generator';

import {
    GeneratedElementNameResolver,
} from './generated-element-name-resolver';

import type {
    NamedGeneratedElement,
} from './generated-element-name-resolver';

import {
    GeneratedElementLocatorResolver,
} from './generated-element-locator-resolver';

import {
    UnresolvedElementFactory,
} from './unresolved-element-factory';


export interface ElementAssemblyResult {
    elements: readonly GeneratedElement[];
    unresolvedElements: readonly UnresolvedElement[];
}


export class UnresolvedLocatorError extends Error {

    readonly unresolvedElement: UnresolvedElement;

    constructor(
        unresolvedElement: UnresolvedElement,
        cause?: unknown,
    ) {
        super(
            unresolvedElement.message,
            { cause },
        );

        this.name = 'UnresolvedLocatorError';

        this.unresolvedElement =
            unresolvedElement;
    }
}


export class GeneratedElementAssembler {

    private readonly locatorResolver:
        GeneratedElementLocatorResolver;

    constructor(
        page: Page,

        private readonly nameGenerator =
            new ElementNameGenerator(),

        private readonly fingerprintBuilder =
            new ElementFingerprintBuilder(),

        private readonly stableKeyGenerator =
            new StableKeyGenerator(),

        private readonly nameResolver =
            new GeneratedElementNameResolver(),

        private readonly unresolvedElementFactory =
            new UnresolvedElementFactory(),
    ) {
        this.locatorResolver =
            new GeneratedElementLocatorResolver(page);
    }


    /**
     * Assemble one captured element.
     *
     * Each responsibility is delegated to
     * the corresponding specialized class.
     */
    async assemble(
        element: CapturedElement,
        originalElement?: ElementHandle<
            HTMLElement | SVGElement
        >,
    ): Promise<GeneratedElement> {

        const name =
            this.nameGenerator.generate(element);

        const resolution =
            await this.locatorResolver.resolve(
                element,
                originalElement,
            );

        /*
         * Explicit discriminant comparison
         * ensures correct TypeScript narrowing.
         */
        if (resolution.success === false) {

            const unresolvedElement =
                this.unresolvedElementFactory.create(
                    name,
                    element,
                    resolution.candidates,
                    originalElement !== undefined,
                );

            throw new UnresolvedLocatorError(
                unresolvedElement,
            );
        }

        const fingerprint =
            this.fingerprintBuilder.build(element);

        const stableKey =
            this.stableKeyGenerator.generate();

        return {
            name,
            type: element.type,
            locator: resolution.locator,
            stableKey,
            fingerprint,
        };
    }


    /**
     * Assemble elements without DOM handles.
     *
     * Locator failures propagate to the caller.
     */
    async assembleAll(
        elements: readonly CapturedElement[],
    ): Promise<GeneratedElement[]> {

        const namedElements:
            NamedGeneratedElement[] = [];

        for (const element of elements) {

            const generatedElement =
                await this.assemble(element);

            namedElements.push({
                generated: generatedElement,
                captured: element,
            });
        }

        return this.nameResolver.resolve(
            namedElements,
        );
    }


    /**
     * Assemble elements using their DOM handles.
     *
     * The caller remains responsible for
     * disposing the handles.
     */
    async assembleAllWithHandles(
        scanned:
            readonly ScannedElementWithHandle[],
    ): Promise<GeneratedElement[]> {

        const namedElements:
            NamedGeneratedElement[] = [];

        for (const item of scanned) {

            const generatedElement =
                await this.assemble(
                    item.element,
                    item.handle,
                );

            namedElements.push({
                generated: generatedElement,
                captured: item.element,
            });
        }

        return this.nameResolver.resolve(
            namedElements,
        );
    }


    /**
     * Assemble elements while collecting expected
     * locator-resolution failures as diagnostics.
     *
     * Unexpected errors propagate unchanged.
     * The caller owns handle disposal.
     */
    async assembleAllWithHandlesAndDiagnostics(
        scanned:
            readonly ScannedElementWithHandle[],
    ): Promise<ElementAssemblyResult> {

        const namedElements:
            NamedGeneratedElement[] = [];

        const unresolvedElements:
            UnresolvedElement[] = [];

        for (const item of scanned) {

            try {

                const generatedElement =
                    await this.assemble(
                        item.element,
                        item.handle,
                    );

                namedElements.push({
                    generated: generatedElement,
                    captured: item.element,
                });

            } catch (error) {

                if (
                    error instanceof
                    UnresolvedLocatorError
                ) {
                    unresolvedElements.push(
                        error.unresolvedElement,
                    );

                    continue;
                }

                throw error;
            }
        }

        return {
            elements:
                this.nameResolver.resolve(
                    namedElements,
                ),

            unresolvedElements,
        };
    }
}
