import {
    test,
    expect,
} from '@playwright/test';

import type {
    GeneratedElement,
} from '../../../tools/pom-generator/models/page.model';

import type {
    ElementChange,
} from '../../../tools/pom-generator/models/change.model';

import {
    ChangeReviewer,
} from '../../../tools/pom-generator/review/change-reviewer';


function element(
    stableKey: string,
    name: string,
    preferred: string,
): GeneratedElement {

    return {
        name,

        type:
            'input',

        locator: {
            preferred,
            fallbacks: [],
        },

        stableKey,

        fingerprint: {
            type:
                'input',

            label:
                name.toLowerCase(),
        },
    };
}


test.describe(
    'ChangeReviewer',
    () => {

        const reviewer =
            new ChangeReviewer();


        test(
            'should preserve unchanged element without decision',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );


                const changes:
                    ElementChange[] = [
                        {
                            type:
                                'UNCHANGED',

                            elementName:
                                'firstName',

                            stableKey:
                                'stable-001',

                            existing,

                            current:
                                existing,
                        },
                    ];


                const result =
                    reviewer.apply(
                        changes,
                        [],
                    );


                expect(result.elements)
                    .toEqual([
                        existing,
                    ]);

                expect(
                    result.unresolvedStableKeys,
                ).toEqual([]);
            },
        );


        test(
            'should add approved new element',
            () => {

                const current =
                    element(
                        'stable-002',
                        'surname',
                        'label=Surname',
                    );


                const changes:
                    ElementChange[] = [
                        {
                            type:
                                'NEW',

                            elementName:
                                'surname',

                            stableKey:
                                'stable-002',

                            current,
                        },
                    ];


                const result =
                    reviewer.apply(
                        changes,
                        [
                            {
                                stableKey:
                                    'stable-002',

                                action:
                                    'ADD',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([
                        current,
                    ]);
            },
        );


        test(
            'should ignore new element without adding it',
            () => {

                const current =
                    element(
                        'stable-002',
                        'surname',
                        'label=Surname',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'NEW',

                                elementName:
                                    'surname',

                                stableKey:
                                    'stable-002',

                                current,
                            },
                        ],
                        [
                            {
                                stableKey:
                                    'stable-002',

                                action:
                                    'IGNORE',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([]);
            },
        );


        test(
            'should update changed element when approved',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );

                const current =
                    element(
                        'stable-001',
                        'firstName',
                        'testid=first-name',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'CHANGED',

                                elementName:
                                    'firstName',

                                stableKey:
                                    'stable-001',

                                existing,

                                current,
                            },
                        ],
                        [
                            {
                                stableKey:
                                    'stable-001',

                                action:
                                    'UPDATE',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([
                        current,
                    ]);

                expect(
                    result.elements[0]
                        .stableKey,
                ).toBe(
                    'stable-001',
                );
            },
        );


        test(
            'should keep existing changed element when update rejected',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );

                const current =
                    element(
                        'stable-001',
                        'firstName',
                        'testid=first-name',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'CHANGED',

                                elementName:
                                    'firstName',

                                stableKey:
                                    'stable-001',

                                existing,

                                current,
                            },
                        ],
                        [
                            {
                                stableKey:
                                    'stable-001',

                                action:
                                    'KEEP',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([
                        existing,
                    ]);
            },
        );


        test(
            'should keep not found element',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'NOT_FOUND',

                                elementName:
                                    'firstName',

                                stableKey:
                                    'stable-001',

                                existing,
                            },
                        ],
                        [
                            {
                                stableKey:
                                    'stable-001',

                                action:
                                    'KEEP',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([
                        existing,
                    ]);
            },
        );


        test(
            'should remove not found element only with explicit REMOVE',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'NOT_FOUND',

                                elementName:
                                    'firstName',

                                stableKey:
                                    'stable-001',

                                existing,
                            },
                        ],
                        [
                            {
                                stableKey:
                                    'stable-001',

                                action:
                                    'REMOVE',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([]);
            },
        );


        test(
            'should preserve ambiguous existing element',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'AMBIGUOUS',

                                elementName:
                                    'firstName',

                                stableKey:
                                    'stable-001',

                                existing,

                                candidateStableKeys: [
                                    'candidate-001',
                                    'candidate-002',
                                ],
                            },
                        ],
                        [
                            {
                                stableKey:
                                    'stable-001',

                                action:
                                    'KEEP',
                            },
                        ],
                    );


                expect(result.elements)
                    .toEqual([
                        existing,
                    ]);
            },
        );


        test(
            'should report unresolved change when no decision exists',
            () => {

                const current =
                    element(
                        'stable-002',
                        'surname',
                        'label=Surname',
                    );


                const result =
                    reviewer.apply(
                        [
                            {
                                type:
                                    'NEW',

                                elementName:
                                    'surname',

                                stableKey:
                                    'stable-002',

                                current,
                            },
                        ],
                        [],
                    );


                expect(
                    result.unresolvedStableKeys,
                ).toEqual([
                    'stable-002',
                ]);

                expect(result.elements)
                    .toEqual([]);
            },
        );


        test(
            'should reject invalid action for change type',
            () => {

                const current =
                    element(
                        'stable-002',
                        'surname',
                        'label=Surname',
                    );


                expect(
                    () =>
                        reviewer.apply(
                            [
                                {
                                    type:
                                        'NEW',

                                    elementName:
                                        'surname',

                                    stableKey:
                                        'stable-002',

                                    current,
                                },
                            ],
                            [
                                {
                                    stableKey:
                                        'stable-002',

                                    action:
                                        'REMOVE',
                                },
                            ],
                        ),
                ).toThrow(
                    'Review action REMOVE is not valid for change type NEW (surname).',
                );
            },
        );


        test(
            'should reject duplicate decisions for same stable key',
            () => {

                expect(
                    () =>
                        reviewer.apply(
                            [],
                            [
                                {
                                    stableKey:
                                        'stable-001',

                                    action:
                                        'KEEP',
                                },

                                {
                                    stableKey:
                                        'stable-001',

                                    action:
                                        'REMOVE',
                                },
                            ],
                        ),
                ).toThrow(
                    'Duplicate review decision for stableKey: stable-001',
                );
            },
        );

    },
);