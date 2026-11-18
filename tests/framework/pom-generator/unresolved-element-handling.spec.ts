
import {
    test,
    expect,
} from '@playwright/test';

import type {
    ElementHandle,
    Page,
} from '@playwright/test';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';

import type {
    GeneratedElement,
} from '../../../tools/pom-generator/models/page.model';

import type {
    ScannedElementWithHandle,
} from '../../../tools/pom-generator/scanner/dom-scanner';

import type {
    UnresolvedElement,
} from '../../../tools/pom-generator/models/unresolved-element.model';

import {
    GeneratedElementAssembler,
    UnresolvedLocatorError,
} from '../../../tools/pom-generator/generators/generated-element-assembler';


test.describe(
    'Unresolved element handling',
    () => {

        const capturedElement = (
            text: string,
        ): CapturedElement => ({
            tagName: 'button',
            type: 'button',
            role: 'button',
            text,
            visible: true,
            locatorCandidates: [],
        });


        const generatedElement = (
            name: string,
        ): GeneratedElement => ({
            name,
            type: 'button',
            stableKey: `stable-${name}`,
            fingerprint: {
                type: 'button',
                role: 'button',
                text: name,
            },
            locator: {
                preferred: `css=#${name}`,
                fallbacks: [],
            },
        });


        const unresolvedElement = (
            element: CapturedElement,
            reason:
                UnresolvedElement['reason'] =
                'no-unique-locator',
        ): UnresolvedElement => ({
            name: 'unresolvedButton',
            element,
            reason,
            candidates: [],
            message:
                'Unable to generate a unique locator.',
        });


        const scannedElement = (
            element: CapturedElement,
        ): ScannedElementWithHandle => ({
            element,
            handle: {} as ElementHandle<
                HTMLElement | SVGElement
            >,
        });


        const createAssembler = ():
            GeneratedElementAssembler =>
            new GeneratedElementAssembler(
                {} as Page,
            );


        test(
            'continues generating valid elements after an unresolved element',
            async () => {

                const first =
                    capturedElement('Unresolved');

                const second =
                    capturedElement('Submit');

                const expected =
                    generatedElement('submitButton');

                const assembler =
                    createAssembler();

                assembler.assemble =
                    async element => {

                        if (element === first) {
                            throw new UnresolvedLocatorError(
                                unresolvedElement(first),
                            );
                        }

                        return expected;
                    };


                const result =
                    await assembler
                        .assembleAllWithHandlesAndDiagnostics([
                            scannedElement(first),
                            scannedElement(second),
                        ]);


                expect(result.elements).toEqual([
                    expected,
                ]);

                expect(
                    result.unresolvedElements,
                ).toHaveLength(1);

                expect(
                    result.unresolvedElements[0].element,
                ).toBe(first);
            },
        );


        test(
            'preserves unresolved diagnostic reasons',
            async () => {

                const element =
                    capturedElement('Back');

                const diagnostic =
                    unresolvedElement(
                        element,
                        'original-element-mismatch',
                    );

                const assembler =
                    createAssembler();

                assembler.assemble =
                    async () => {
                        throw new UnresolvedLocatorError(
                            diagnostic,
                        );
                    };


                const result =
                    await assembler
                        .assembleAllWithHandlesAndDiagnostics([
                            scannedElement(element),
                        ]);


                expect(result.elements).toEqual([]);

                expect(
                    result.unresolvedElements,
                ).toEqual([
                    diagnostic,
                ]);

                expect(
                    result.unresolvedElements[0].reason,
                ).toBe(
                    'original-element-mismatch',
                );
            },
        );


        test(
            'preserves locator candidates and diagnostic messages',
            async () => {

                const element =
                    capturedElement('Back');

                const diagnostic:
                    UnresolvedElement = {
                    name: 'backButton',
                    element,
                    reason: 'no-unique-locator',
                    candidates: [
                        {
                            strategy: 'css',
                            value: '.btn-back-link',
                            descriptor:
                                'css=.btn-back-link',
                            unique: false,
                            matchCount: 2,
                        },
                    ],
                    message:
                        'Two Back buttons matched the locator.',
                };

                const assembler =
                    createAssembler();

                assembler.assemble =
                    async () => {
                        throw new UnresolvedLocatorError(
                            diagnostic,
                        );
                    };


                const result =
                    await assembler
                        .assembleAllWithHandlesAndDiagnostics([
                            scannedElement(element),
                        ]);


                expect(
                    result.unresolvedElements[0].candidates,
                ).toEqual(
                    diagnostic.candidates,
                );

                expect(
                    result.unresolvedElements[0].message,
                ).toBe(
                    'Two Back buttons matched the locator.',
                );
            },
        );


        test(
            'does not include unresolved elements in generated elements',
            async () => {

                const element =
                    capturedElement('Back');

                const assembler =
                    createAssembler();

                assembler.assemble =
                    async () => {
                        throw new UnresolvedLocatorError(
                            unresolvedElement(element),
                        );
                    };


                const result =
                    await assembler
                        .assembleAllWithHandlesAndDiagnostics([
                            scannedElement(element),
                        ]);


                expect(result.elements).toHaveLength(0);

                expect(
                    result.unresolvedElements,
                ).toHaveLength(1);
            },
        );


        test(
            'propagates unexpected errors',
            async () => {

                const element =
                    capturedElement('Submit');

                const assembler =
                    createAssembler();

                const unexpectedError =
                    new Error(
                        'Unexpected scanner failure',
                    );

                assembler.assemble =
                    async () => {
                        throw unexpectedError;
                    };


                await expect(
                    assembler
                        .assembleAllWithHandlesAndDiagnostics([
                            scannedElement(element),
                        ]),
                ).rejects.toBe(
                    unexpectedError,
                );
            },
        );


        test(
            'stops processing after an unexpected error',
            async () => {

                const first =
                    capturedElement('First');

                const second =
                    capturedElement('Second');

                const processed:
                    CapturedElement[] = [];

                const assembler =
                    createAssembler();

                assembler.assemble =
                    async element => {
                        processed.push(element);

                        throw new Error(
                            'Unexpected failure',
                        );
                    };


                await expect(
                    assembler
                        .assembleAllWithHandlesAndDiagnostics([
                            scannedElement(first),
                            scannedElement(second),
                        ]),
                ).rejects.toThrow(
                    'Unexpected failure',
                );

                expect(processed).toEqual([
                    first,
                ]);
            },
        );


        test(
            'preserves backward-compatible error behavior',
            async () => {

                const element =
                    capturedElement('Back');

                const assembler =
                    createAssembler();

                assembler.assemble =
                    async () => {
                        throw new UnresolvedLocatorError(
                            unresolvedElement(element),
                        );
                    };


                await expect(
                    assembler.assembleAll([
                        element,
                    ]),
                ).rejects.toBeInstanceOf(
                    UnresolvedLocatorError,
                );
            },
        );
    },
);
