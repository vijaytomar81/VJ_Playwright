import {
    test,
    expect,
} from '@playwright/test';

import {
    LocatorSelector,
} from '../../../tools/pom-generator/locator/locator-selector';

import type {
    LocatorCandidate,
} from '../../../tools/pom-generator/models/locator.model';

const selector =
    new LocatorSelector();

function candidate(
    strategy: LocatorCandidate['strategy'],
    descriptor: string,
    unique: boolean,
): LocatorCandidate {
    return {
        strategy,
        value: descriptor,
        descriptor,
        unique,
    };
}

test.describe('LocatorSelector', () => {

    test('should select highest-priority unique locator as preferred', () => {
        const result =
            selector.select([
                candidate(
                    'css',
                    'css=#continue',
                    true,
                ),

                candidate(
                    'testid',
                    'testid=continue',
                    true,
                ),

                candidate(
                    'role',
                    'role=button[name="Continue"]',
                    true,
                ),
            ]);

        expect(result.preferred)
            .toBe(
                'role=button[name="Continue"]',
            );

        expect(result.fallbacks)
            .toEqual([
                'testid=continue',
                'css=#continue',
            ]);
    });


    test('should exclude non-unique candidates', () => {
        const result =
            selector.select([
                candidate(
                    'role',
                    'role=button[name="Continue"]',
                    false,
                ),

                candidate(
                    'testid',
                    'testid=continue',
                    true,
                ),

                candidate(
                    'css',
                    'css=#continue',
                    true,
                ),
            ]);

        expect(result.preferred)
            .toBe('testid=continue');

        expect(result.fallbacks)
            .toEqual([
                'css=#continue',
            ]);
    });


    test('should allow a single unique locator with no fallbacks', () => {
        const result =
            selector.select([
                candidate(
                    'id',
                    'css=#postcode',
                    true,
                ),
            ]);

        expect(result).toEqual({
            preferred: 'css=#postcode',
            fallbacks: [],
        });
    });


    test('should reject an element when no unique locator exists', () => {
        expect(
            () =>
                selector.select([
                    candidate(
                        'role',
                        'role=button[name="Continue"]',
                        false,
                    ),

                    candidate(
                        'css',
                        'css=.button',
                        false,
                    ),
                ]),
        ).toThrow(
            'Unable to generate a unique locator for the element.',
        );
    });

});