
import {
    test,
    expect,
} from '@playwright/test';

import type {
    GeneratedElement,
} from '../../../tools/pom-generator/models/page.model';

import {
    PageComparator,
} from '../../../tools/pom-generator/comparison/page-comparator';


test.describe(
    'PageComparator',
    () => {

        const comparator =
            new PageComparator();


        const element = (
            name: string,
            stableKey: string,
            options: {
                text?: string;
                context?: string;
                testId?: string;
                selector?: string;
            } = {},
        ): GeneratedElement => {

            const selector =
                options.selector ??
                `[data-testid="${name}"]`;

            return {
                name,
                type: 'button',
                stableKey,
                fingerprint: {
                    type: 'button',
                    role: 'button',
                    text: options.text ?? name,
                    context: options.context,
                    testId: options.testId,
                },
                locator: {
                    preferred: `css=${selector}`,
                    fallbacks: [],
                },
            };
        };


        test(
            'matches unique existing stable keys exactly',
            () => {

                const existing = element(
                    'backButton',
                    'stable-back',
                );

                const current = element(
                    'backButton',
                    'stable-back',
                );

                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );


                expect(changes).toHaveLength(1);

                expect(changes[0].type).toBe(
                    'UNCHANGED',
                );

                expect(changes[0].stableKey).toBe(
                    'stable-back',
                );
            },
        );


        test(
            'reuses existing stable key after fingerprint matching',
            () => {

                const existing = element(
                    'backButton',
                    'existing-back',
                    {
                        text: 'Back',
                        context: 'header',
                    },
                );

                const current = element(
                    'backButton',
                    'new-scan-back',
                    {
                        text: 'Back',
                        context: 'header',
                    },
                );


                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );


                expect(changes).toHaveLength(1);

                expect(changes[0].stableKey).toBe(
                    'existing-back',
                );

                expect(
                    changes[0].current?.stableKey,
                ).toBe(
                    'existing-back',
                );
            },
        );


        test(
            'retains existing engineer-renamed name in comparison',
            () => {

                const existing = element(
                    'navigateBackButton',
                    'existing-back',
                    {
                        text: 'Back',
                        context: 'header',
                    },
                );

                const current = element(
                    'backButton',
                    'scan-back',
                    {
                        text: 'Back',
                        context: 'header',
                    },
                );


                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );


                expect(changes).toHaveLength(1);

                expect(changes[0].elementName).toBe(
                    'navigateBackButton',
                );

                expect(changes[0].existing?.name).toBe(
                    'navigateBackButton',
                );
            },
        );


        test(
            'marks indistinguishable duplicate Back buttons as ambiguous',
            () => {

                const existing = element(
                    'backButton',
                    'existing-back',
                    {
                        text: 'Back',
                        context: 'navigation',
                    },
                );

                const currentTop = element(
                    'backButtonTop',
                    'scan-top',
                    {
                        text: 'Back',
                        context: 'navigation',
                    },
                );

                const currentDashboard = element(
                    'backButtonDashboard',
                    'scan-dashboard',
                    {
                        text: 'Back',
                        context: 'navigation',
                    },
                );


                const changes =
                    comparator.compare(
                        [existing],
                        [
                            currentTop,
                            currentDashboard,
                        ],
                    );


                const ambiguous =
                    changes.filter(
                        change =>
                            change.type ===
                            'AMBIGUOUS',
                    );

                expect(ambiguous).toHaveLength(1);

                expect(
                    ambiguous[0].candidateStableKeys,
                ).toEqual(
                    expect.arrayContaining([
                        'scan-top',
                        'scan-dashboard',
                    ]),
                );

                expect(
                    changes.some(
                        change =>
                            change.type === 'NEW',
                    ),
                ).toBe(false);
            },
        );


        test(
            'does not assign one current element to two existing identities',
            () => {

                const existingA = element(
                    'backButtonA',
                    'existing-a',
                    {
                        text: 'Back',
                        context: 'navigation',
                    },
                );

                const existingB = element(
                    'backButtonB',
                    'existing-b',
                    {
                        text: 'Back',
                        context: 'navigation',
                    },
                );

                const current = element(
                    'backButton',
                    'scan-back',
                    {
                        text: 'Back',
                        context: 'navigation',
                    },
                );


                const changes =
                    comparator.compare(
                        [
                            existingA,
                            existingB,
                        ],
                        [current],
                    );


                expect(
                    changes.filter(
                        change =>
                            change.type ===
                            'AMBIGUOUS',
                    ),
                ).toHaveLength(2);

                expect(
                    changes.some(
                        change =>
                            change.type === 'NEW',
                    ),
                ).toBe(false);

                expect(
                    changes.some(
                        change =>
                            change.type ===
                            'UNCHANGED' ||
                            change.type ===
                            'CHANGED',
                    ),
                ).toBe(false);
            },
        );


        test(
            'reports genuinely missing existing elements',
            () => {

                const existing = element(
                    'oldButton',
                    'existing-old',
                );


                const changes =
                    comparator.compare(
                        [existing],
                        [],
                    );


                expect(changes).toHaveLength(1);

                expect(changes[0].type).toBe(
                    'NOT_FOUND',
                );

                expect(changes[0].stableKey).toBe(
                    'existing-old',
                );
            },
        );


        test(
            'reports genuinely new elements',
            () => {

                const current = element(
                    'submitButton',
                    'scan-submit',
                );


                const changes =
                    comparator.compare(
                        [],
                        [current],
                    );


                expect(changes).toHaveLength(1);

                expect(changes[0].type).toBe(
                    'NEW',
                );

                expect(changes[0].stableKey).toBe(
                    'scan-submit',
                );
            },
        );


        test(
            'detects locator changes for matched identities',
            () => {

                const existing = element(
                    'backButton',
                    'stable-back',
                    {
                        text: 'Back',
                        selector:
                            '.old-back-button',
                    },
                );

                const current = element(
                    'backButton',
                    'stable-back',
                    {
                        text: 'Back',
                        selector:
                            'div.back-link-top > button.btn-back-link',
                    },
                );


                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );


                expect(changes).toHaveLength(1);

                expect(changes[0].type).toBe(
                    'CHANGED',
                );

                expect(
                    changes[0].existing?.locator
                        .preferred,
                ).toBe(
                    'css=.old-back-button',
                );

                expect(
                    changes[0].current?.locator
                        .preferred,
                ).toBe(
                    'css=div.back-link-top > button.btn-back-link',
                );
            },
        );


        test(
            'rejects duplicate stable keys in existing elements',
            () => {

                const existing = [
                    element(
                        'headerBackButton',
                        'duplicate-back',
                    ),
                    element(
                        'dashboardBackButton',
                        'duplicate-back',
                    ),
                ];

                const current = [
                    element(
                        'backButton',
                        'new-scan-back',
                    ),
                ];


                expect(
                    () => comparator.compare(
                        existing,
                        current,
                    ),
                ).toThrow(
                    'duplicate stable key "duplicate-back" in existing elements',
                );
            },
        );


        test(
            'rejects duplicate stable keys in current elements',
            () => {

                const existing = [
                    element(
                        'backButton',
                        'existing-back',
                    ),
                ];

                const current = [
                    element(
                        'headerBackButton',
                        'duplicate-scan',
                    ),
                    element(
                        'dashboardBackButton',
                        'duplicate-scan',
                    ),
                ];


                expect(
                    () => comparator.compare(
                        existing,
                        current,
                    ),
                ).toThrow(
                    'duplicate stable key "duplicate-scan" in current elements',
                );
            },
        );


        test(
            'rejects missing stable keys in existing elements',
            () => {

                const existing = [
                    element(
                        'backButton',
                        '',
                    ),
                ];


                expect(
                    () => comparator.compare(
                        existing,
                        [],
                    ),
                ).toThrow(
                    'missing stable key for "backButton" in existing elements',
                );
            },
        );


        test(
            'rejects whitespace-only stable keys in current elements',
            () => {

                const current = [
                    element(
                        'backButton',
                        '   ',
                    ),
                ];


                expect(
                    () => comparator.compare(
                        [],
                        current,
                    ),
                ).toThrow(
                    'missing stable key for "backButton" in current elements',
                );
            },
        );


        test(
            'does not recover duplicate identities through fingerprints',
            () => {

                const existing = [
                    element(
                        'headerBackButton',
                        'duplicate-back',
                        {
                            text: 'Back',
                            context: 'header',
                        },
                    ),
                    element(
                        'dashboardBackButton',
                        'duplicate-back',
                        {
                            text: 'Back',
                            context: 'dashboard',
                        },
                    ),
                ];

                const current = [
                    element(
                        'headerBackButton',
                        'new-scan-header',
                        {
                            text: 'Back',
                            context: 'header',
                        },
                    ),
                    element(
                        'dashboardBackButton',
                        'new-scan-dashboard',
                        {
                            text: 'Back',
                            context: 'dashboard',
                        },
                    ),
                ];


                expect(
                    () => comparator.compare(
                        existing,
                        current,
                    ),
                ).toThrow(
                    'duplicate stable key "duplicate-back" in existing elements',
                );
            },
        );


        test(
            'matches manufacture-year select across changing options',
            () => {
                const existing: GeneratedElement = {
                    name: 'selectPleaseSelect200520042003',
                    type: 'select',
                    stableKey: 'existing-year',
                    fingerprint: {
                        type: 'select',
                        text: 'Please select 2005 2004 2003',
                    },
                    locator: {
                        preferred: 'label=Manufacture year',
                        fallbacks: [
                            'css=#vehicle-manufacture-year',
                        ],
                    },
                };

                const current: GeneratedElement = {
                    name: 'vehicleManufactureYear',
                    type: 'select',
                    stableKey: 'scan-year',
                    fingerprint: {
                        type: 'select',
                        text: 'Please select 2026 2025',
                    },
                    locator: {
                        preferred: 'css=#vehicle-manufacture-year',
                        fallbacks: [],
                    },
                };

                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );

                expect(changes).toHaveLength(1);
                expect(changes[0].type).toBe('CHANGED');
                expect(changes[0].stableKey).toBe(
                    'existing-year',
                );
                expect(changes[0].elementName).toBe(
                    'selectPleaseSelect200520042003',
                );
                expect(changes[0].current?.stableKey).toBe(
                    'existing-year',
                );
            },
        );


        test(
            'distinguishes two model inputs with similar fingerprints',
            () => {
                const createInput = (
                    name: string,
                    stableKey: string,
                    id: string,
                ): GeneratedElement => ({
                    name,
                    type: 'input',
                    stableKey,
                    fingerprint: {
                        type: 'input',
                        placeholder:
                            'Start typing the model name of your vehicle',
                    },
                    locator: {
                        preferred: `css=#${id}`,
                        fallbacks: [],
                    },
                });

                const existing = [
                    createInput(
                        'shortenedModel',
                        'existing-shortened',
                        'vehicle-shortened-model',
                    ),
                    createInput(
                        'vehicleModel',
                        'existing-model',
                        'vehicle-model',
                    ),
                ];

                const current = [
                    createInput(
                        'vehicleModel',
                        'scan-model',
                        'vehicle-model',
                    ),
                    createInput(
                        'shortenedModel',
                        'scan-shortened',
                        'vehicle-shortened-model',
                    ),
                ];

                const changes =
                    comparator.compare(
                        existing,
                        current,
                    );

                expect(changes).toHaveLength(2);

                expect(
                    changes.find(
                        change =>
                            change.stableKey ===
                            'existing-shortened',
                    )?.current?.locator.preferred,
                ).toBe(
                    'css=#vehicle-shortened-model',
                );

                expect(
                    changes.find(
                        change =>
                            change.stableKey ===
                            'existing-model',
                    )?.current?.locator.preferred,
                ).toBe(
                    'css=#vehicle-model',
                );

                expect(
                    changes.every(
                        change =>
                            change.type === 'UNCHANGED',
                    ),
                ).toBe(true);
            },
        );


        test(
            'does not match conflicting target IDs',
            () => {
                const existing: GeneratedElement = {
                    name: 'oldInput',
                    type: 'input',
                    stableKey: 'existing-input',
                    fingerprint: {
                        type: 'input',
                        placeholder: 'Enter value',
                    },
                    locator: {
                        preferred: 'css=#old-input',
                        fallbacks: [],
                    },
                };

                const current: GeneratedElement = {
                    name: 'newInput',
                    type: 'input',
                    stableKey: 'scan-input',
                    fingerprint: {
                        type: 'input',
                        placeholder: 'Different value',
                    },
                    locator: {
                        preferred: 'css=#new-input',
                        fallbacks: [],
                    },
                };

                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );

                expect(
                    changes.map(change => change.type).sort(),
                ).toEqual([
                    'NEW',
                    'NOT_FOUND',
                ]);
            },
        );


        test(
            'does not assign one target ID to multiple existing identities',
            () => {
                const createInput = (
                    name: string,
                    stableKey: string,
                ): GeneratedElement => ({
                    name,
                    type: 'input',
                    stableKey,
                    fingerprint: {
                        type: 'input',
                        placeholder: 'Enter value',
                    },
                    locator: {
                        preferred: 'css=#shared-input',
                        fallbacks: [],
                    },
                });

                const existing = [
                    createInput(
                        'firstInput',
                        'existing-first',
                    ),
                    createInput(
                        'secondInput',
                        'existing-second',
                    ),
                ];

                const current = [
                    createInput(
                        'currentInput',
                        'scan-current',
                    ),
                ];

                const changes =
                    comparator.compare(
                        existing,
                        current,
                    );

                expect(
                    changes.filter(
                        change =>
                            change.type === 'UNCHANGED' ||
                            change.type === 'CHANGED',
                    ),
                ).toHaveLength(0);

                expect(
                    changes.filter(
                        change =>
                            change.type === 'AMBIGUOUS',
                    ),
                ).toHaveLength(2);

                expect(
                    changes.some(
                        change => change.type === 'NEW',
                    ),
                ).toBe(false);
            },
        );


        test(
            'does not fingerprint-match identical inputs with conflicting HTML IDs',
            () => {

                const existing: GeneratedElement = {
                    name: 'vehicleModel',
                    type: 'input',
                    stableKey: 'existing-vehicle-model',

                    fingerprint: {
                        type: 'input',
                        placeholder:
                            'Start typing the model name of your vehicle',
                        context: 'Car details',
                    },

                    locator: {
                        preferred: 'css=#vehicle-model',
                        fallbacks: [],
                    },
                };

                const current: GeneratedElement = {
                    name: 'vehicleShortenedModel',
                    type: 'input',
                    stableKey: 'scan-shortened-model',

                    /*
                     * Deliberately identical fingerprint.
                     *
                     * Without the identity-conflict guard,
                     * fingerprint matching could incorrectly
                     * reuse the existing stable key.
                     */
                    fingerprint: {
                        type: 'input',
                        placeholder:
                            'Start typing the model name of your vehicle',
                        context: 'Car details',
                    },

                    locator: {
                        preferred:
                            'css=#vehicle-shortened-model',
                        fallbacks: [],
                    },
                };

                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );

                /*
                 * Different target IDs must not be
                 * treated as the same logical element.
                 */
                expect(changes).toHaveLength(2);

                expect(
                    changes.map(
                        change => change.type,
                    ).sort(),
                ).toEqual([
                    'NEW',
                    'NOT_FOUND',
                ]);

                const notFound =
                    changes.find(
                        change =>
                            change.type === 'NOT_FOUND',
                    );

                expect(notFound?.stableKey).toBe(
                    'existing-vehicle-model',
                );

                const newElement =
                    changes.find(
                        change =>
                            change.type === 'NEW',
                    );

                expect(newElement?.stableKey).toBe(
                    'scan-shortened-model',
                );

                expect(
                    changes.some(
                        change =>
                            change.type === 'CHANGED' ||
                            change.type === 'UNCHANGED' ||
                            change.type === 'AMBIGUOUS',
                    ),
                ).toBe(false);
            },
        );


        test(
            'does not match elements when test IDs agree but HTML IDs conflict',
            () => {

                const existing: GeneratedElement = {
                    name: 'vehicleModel',
                    type: 'input',
                    stableKey: 'existing-vehicle-model',

                    fingerprint: {
                        type: 'input',
                        placeholder:
                            'Start typing the model name of your vehicle',
                    },

                    locator: {
                        preferred: 'testid=vehicle-model-input',
                        fallbacks: [
                            'css=#vehicle-model',
                        ],
                    },
                };

                const current: GeneratedElement = {
                    name: 'vehicleShortenedModel',
                    type: 'input',
                    stableKey: 'scan-shortened-model',

                    fingerprint: {
                        type: 'input',
                        placeholder:
                            'Start typing the model name of your vehicle',
                    },

                    locator: {
                        preferred: 'testid=vehicle-model-input',
                        fallbacks: [
                            'css=#vehicle-shortened-model',
                        ],
                    },
                };

                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );

                expect(
                    changes.map(
                        change => change.type,
                    ).sort(),
                ).toEqual([
                    'NEW',
                    'NOT_FOUND',
                ]);

                expect(
                    changes.find(
                        change =>
                            change.type === 'NOT_FOUND',
                    )?.stableKey,
                ).toBe(
                    'existing-vehicle-model',
                );

                expect(
                    changes.find(
                        change =>
                            change.type === 'NEW',
                    )?.stableKey,
                ).toBe(
                    'scan-shortened-model',
                );
            },
        );

    },
);
