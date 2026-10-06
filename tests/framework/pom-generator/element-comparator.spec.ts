import {
    test,
    expect,
} from '@playwright/test';

import {
    ElementComparator,
} from '../../../tools/pom-generator/comparison/element-comparator';

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
            label: 'first name',
            context:
                'policyholder details',
        },

        ...overrides,
    };
}


test.describe(
    'ElementComparator',
    () => {

        const comparator =
            new ElementComparator();


        test(
            'should identify unchanged element',
            () => {

                const result =
                    comparator.compare(
                        element(),
                        element(),
                    );

                expect(result.changed)
                    .toBe(false);

                expect(
                    result.changedFields,
                ).toEqual([]);
            },
        );


        test(
            'should detect preferred locator change',
            () => {

                const result =
                    comparator.compare(
                        element(),

                        element({
                            locator: {
                                preferred:
                                    'label=Forename',

                                fallbacks: [
                                    'css=#firstName',
                                ],
                            },
                        }),
                    );

                expect(result.changed)
                    .toBe(true);

                expect(
                    result.changedFields,
                ).toContain(
                    'locator.preferred',
                );
            },
        );


        test(
            'should detect fallback changes',
            () => {

                const result =
                    comparator.compare(
                        element(),

                        element({
                            locator: {
                                preferred:
                                    'label=First name',

                                fallbacks: [
                                    'css=#customerFirstName',
                                ],
                            },
                        }),
                    );

                expect(result.changed)
                    .toBe(true);

                expect(
                    result.changedFields,
                ).toContain(
                    'locator.fallbacks',
                );
            },
        );


        test(
            'should detect element name change',
            () => {

                const result =
                    comparator.compare(
                        element(),

                        element({
                            name: 'forename',
                        }),
                    );

                expect(
                    result.changedFields,
                ).toContain('name');
            },
        );

    },
);