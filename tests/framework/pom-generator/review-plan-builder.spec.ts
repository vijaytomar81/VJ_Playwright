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
    ReviewPlanBuilder,
} from '../../../tools/pom-generator/review/review-plan-builder';


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
    'ReviewPlanBuilder',
    () => {

        const builder =
            new ReviewPlanBuilder();


        test(
            'should build unchanged review item',
            () => {

                const existing =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );


                const plan =
                    builder.build([
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

                            matchScore:
                                1,
                        },
                    ]);


                expect(plan.requiresReview)
                    .toBe(false);

                expect(plan.items[0])
                    .toEqual({
                        changeType:
                            'UNCHANGED',

                        elementName:
                            'firstName',

                        stableKey:
                            'stable-001',

                        existingLocator:
                            'label=First name',

                        proposedLocator:
                            'label=First name',

                        matchScore:
                            1,

                        matchedFields: [],

                        conflictingFields: [],

                        candidateStableKeys: [],

                        allowedActions: [],
                    });
            },
        );


        test(
            'should expose ADD and IGNORE for new element',
            () => {

                const current =
                    element(
                        'stable-002',
                        'surname',
                        'label=Surname',
                    );


                const plan =
                    builder.build([
                        {
                            type:
                                'NEW',

                            elementName:
                                'surname',

                            stableKey:
                                'stable-002',

                            current,
                        },
                    ]);


                expect(plan.requiresReview)
                    .toBe(true);

                expect(
                    plan.items[0]
                        .proposedLocator,
                ).toBe(
                    'label=Surname',
                );

                expect(
                    plan.items[0]
                        .existingLocator,
                ).toBeUndefined();

                expect(
                    plan.items[0]
                        .allowedActions,
                ).toEqual([
                    'ADD',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should expose changed locator details',
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


                const plan =
                    builder.build([
                        {
                            type:
                                'CHANGED',

                            elementName:
                                'firstName',

                            stableKey:
                                'stable-001',

                            existing,

                            current,

                            matchScore:
                                0.85,

                            matchedFields: [
                                'type',
                                'label',
                            ],

                            conflictingFields: [
                                'testId',
                            ],
                        },
                    ]);


                const item =
                    plan.items[0];


                expect(item.existingLocator)
                    .toBe(
                        'label=First name',
                    );

                expect(item.proposedLocator)
                    .toBe(
                        'testid=first-name',
                    );

                expect(item.matchScore)
                    .toBe(
                        0.85,
                    );

                expect(item.matchedFields)
                    .toEqual([
                        'type',
                        'label',
                    ]);

                expect(item.conflictingFields)
                    .toEqual([
                        'testId',
                    ]);

                expect(item.allowedActions)
                    .toEqual([
                        'UPDATE',
                        'KEEP',
                        'IGNORE',
                    ]);
            },
        );


        test(
            'should expose KEEP REMOVE IGNORE for not found element',
            () => {

                const existing =
                    element(
                        'stable-003',
                        'postcode',
                        'label=Postcode',
                    );


                const plan =
                    builder.build([
                        {
                            type:
                                'NOT_FOUND',

                            elementName:
                                'postcode',

                            stableKey:
                                'stable-003',

                            existing,
                        },
                    ]);


                expect(
                    plan.items[0]
                        .existingLocator,
                ).toBe(
                    'label=Postcode',
                );

                expect(
                    plan.items[0]
                        .proposedLocator,
                ).toBeUndefined();

                expect(
                    plan.items[0]
                        .allowedActions,
                ).toEqual([
                    'KEEP',
                    'REMOVE',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should expose ambiguous candidates without selecting one',
            () => {

                const existing =
                    element(
                        'stable-004',
                        'address',
                        'label=Address',
                    );


                const plan =
                    builder.build([
                        {
                            type:
                                'AMBIGUOUS',

                            elementName:
                                'address',

                            stableKey:
                                'stable-004',

                            existing,

                            matchScore:
                                0.8,

                            candidateStableKeys: [
                                'candidate-001',
                                'candidate-002',
                            ],
                        },
                    ]);


                expect(
                    plan.items[0]
                        .candidateStableKeys,
                ).toEqual([
                    'candidate-001',
                    'candidate-002',
                ]);

                expect(
                    plan.items[0]
                        .allowedActions,
                ).toEqual([
                    'KEEP',
                    'IGNORE',
                ]);

                expect(
                    plan.items[0]
                        .proposedLocator,
                ).toBeUndefined();
            },
        );


        test(
            'should require review when any change requires a decision',
            () => {

                const unchanged =
                    element(
                        'stable-001',
                        'firstName',
                        'label=First name',
                    );

                const added =
                    element(
                        'stable-002',
                        'surname',
                        'label=Surname',
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

                            existing:
                                unchanged,

                            current:
                                unchanged,
                        },

                        {
                            type:
                                'NEW',

                            elementName:
                                'surname',

                            stableKey:
                                'stable-002',

                            current:
                                added,
                        },
                    ];


                const plan =
                    builder.build(
                        changes,
                    );


                expect(plan.requiresReview)
                    .toBe(true);

                expect(plan.items)
                    .toHaveLength(2);
            },
        );


        test(
            'should not require review for empty change collection',
            () => {

                const plan =
                    builder.build([]);


                expect(plan.requiresReview)
                    .toBe(false);

                expect(plan.items)
                    .toEqual([]);
            },
        );

    },
);