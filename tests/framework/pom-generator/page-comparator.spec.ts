import {
    test,
    expect,
} from '@playwright/test';

import {
    PageComparator,
} from '../../../tools/pom-generator/comparison/page-comparator';

import type {
    GeneratedElement,
} from '../../../tools/pom-generator/models/page.model';


function element(
    overrides:
        Partial<GeneratedElement> = {},
): GeneratedElement {

    return {
        name: 'firstName',

        type: 'input',

        locator: {
            preferred:
                'label=First name',

            fallbacks: [
                'css=#firstName',
            ],
        },

        stableKey:
            'stable-001',

        fingerprint: {
            type: 'input',
            role: 'textbox',
            label: 'first name',
            name: 'firstname',
            context:
                'policyholder details',
        },

        ...overrides,
    };
}


test.describe(
    'PageComparator',
    () => {

        const comparator =
            new PageComparator();


        test(
            'should identify unchanged element using stableKey',
            () => {

                const changes =
                    comparator.compare(
                        [element()],
                        [element()],
                    );

                expect(changes)
                    .toHaveLength(1);

                expect(changes[0].type)
                    .toBe('UNCHANGED');
            },
        );


        test(
            'should identify changed locator while preserving stableKey',
            () => {

                const changes =
                    comparator.compare(
                        [
                            element({
                                stableKey:
                                    'stable-001',
                            }),
                        ],

                        [
                            element({
                                stableKey:
                                    'stable-001',

                                locator: {
                                    preferred:
                                        'label=Forename',

                                    fallbacks: [
                                        'css=#firstName',
                                    ],
                                },
                            }),
                        ],
                    );

                expect(changes[0].type)
                    .toBe('CHANGED');

                expect(
                    changes[0]
                        .current
                        ?.stableKey,
                ).toBe('stable-001');
            },
        );


        test(
            'should identify new element',
            () => {

                const newElement =
                    element({
                        name:
                            'middleName',

                        stableKey:
                            'stable-002',

                        locator: {
                            preferred:
                                'label=Middle name',

                            fallbacks: [],
                        },

                        fingerprint: {
                            type: 'input',
                            label: 'middle name',
                            context:
                                'policyholder details',
                        },
                    });


                const changes =
                    comparator.compare(
                        [],
                        [newElement],
                    );


                expect(changes)
                    .toHaveLength(1);

                expect(changes[0].type)
                    .toBe('NEW');

                expect(
                    changes[0]
                        .elementName,
                ).toBe('middleName');
            },
        );


        test(
            'should identify existing element as NOT_FOUND',
            () => {

                const changes =
                    comparator.compare(
                        [element()],
                        [],
                    );

                expect(changes)
                    .toHaveLength(1);

                expect(changes[0].type)
                    .toBe('NOT_FOUND');
            },
        );


        test(
            'should match same logical element through fingerprint',
            () => {

                const existing =
                    element({
                        stableKey:
                            'stable-existing',
                    });


                const current =
                    element({
                        stableKey:
                            'temporary-new-key',

                        name:
                            'customerFirstName',

                        locator: {
                            preferred:
                                'label=First name',

                            fallbacks: [
                                'css=#customerFirstName',
                            ],
                        },

                        fingerprint: {
                            type: 'input',
                            role: 'textbox',
                            label: 'first name',
                            name:
                                'customerfirstname',
                            context:
                                'policyholder details',
                        },
                    });


                const changes =
                    comparator.compare(
                        [existing],
                        [current],
                    );


                expect(changes)
                    .toHaveLength(1);

                expect(changes[0].type)
                    .toBe('CHANGED');

                expect(
                    changes[0]
                        .current
                        ?.stableKey,
                ).toBe(
                    'stable-existing',
                );
            },
        );


        test(
            'should report ambiguous candidates instead of choosing automatically',
            () => {

                const existing =
                    element({
                        stableKey:
                            'stable-existing',
                    });


                const candidateOne =
                    element({
                        name:
                            'firstNameOne',

                        stableKey:
                            'candidate-001',
                    });


                const candidateTwo =
                    element({
                        name:
                            'firstNameTwo',

                        stableKey:
                            'candidate-002',
                    });


                const changes =
                    comparator.compare(
                        [existing],

                        [
                            candidateOne,
                            candidateTwo,
                        ],
                    );


                const ambiguous =
                    changes.find(
                        change =>
                            change.type ===
                            'AMBIGUOUS',
                    );


                expect(ambiguous)
                    .toBeDefined();

                expect(
                    ambiguous
                        ?.candidateStableKeys,
                ).toEqual([
                    'candidate-001',
                    'candidate-002',
                ]);
            },
        );

    },
);