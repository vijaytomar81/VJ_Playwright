import {
    test,
    expect,
} from '@playwright/test';

import {
    ReviewActionPolicy,
} from '../../../tools/pom-generator/review/review-action-policy';


test.describe(
    'ReviewActionPolicy',
    () => {

        const policy =
            new ReviewActionPolicy();


        test(
            'should expose no actions for unchanged element',
            () => {

                expect(
                    policy.allowedActionsFor(
                        'UNCHANGED',
                    ),
                ).toEqual([]);
            },
        );


        test(
            'should expose ADD and IGNORE for new element',
            () => {

                expect(
                    policy.allowedActionsFor(
                        'NEW',
                    ),
                ).toEqual([
                    'ADD',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should expose UPDATE KEEP IGNORE for changed element',
            () => {

                expect(
                    policy.allowedActionsFor(
                        'CHANGED',
                    ),
                ).toEqual([
                    'UPDATE',
                    'KEEP',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should expose KEEP REMOVE IGNORE for not found element',
            () => {

                expect(
                    policy.allowedActionsFor(
                        'NOT_FOUND',
                    ),
                ).toEqual([
                    'KEEP',
                    'REMOVE',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should expose KEEP IGNORE for ambiguous element',
            () => {

                expect(
                    policy.allowedActionsFor(
                        'AMBIGUOUS',
                    ),
                ).toEqual([
                    'KEEP',
                    'IGNORE',
                ]);
            },
        );


        test(
            'should identify allowed action',
            () => {

                expect(
                    policy.isAllowed(
                        'CHANGED',
                        'UPDATE',
                    ),
                ).toBe(true);
            },
        );


        test(
            'should reject disallowed action',
            () => {

                expect(
                    policy.isAllowed(
                        'NEW',
                        'REMOVE',
                    ),
                ).toBe(false);
            },
        );

    },
);