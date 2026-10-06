import {
    test,
    expect,
} from '@playwright/test';

import {
    LocatorPriority,
} from '../../../tools/pom-generator/locator/locator-priority';

import type {
    LocatorCandidate,
} from '../../../tools/pom-generator/models/locator.model';

const priority =
    new LocatorPriority();

function candidate(
    strategy: LocatorCandidate['strategy'],
    descriptor: string,
): LocatorCandidate {
    return {
        strategy,
        value: descriptor,
        descriptor,
        unique: true,
    };
}

test.describe('LocatorPriority', () => {

    test('should sort candidates according to configured priority', () => {
        const candidates: LocatorCandidate[] = [
            candidate(
                'css',
                'css=#continue',
            ),

            candidate(
                'testid',
                'testid=continue',
            ),

            candidate(
                'label',
                'label=Continue',
            ),

            candidate(
                'role',
                'role=button[name="Continue"]',
            ),
        ];

        const result =
            priority.sort(candidates);

        expect(
            result.map(
                item => item.strategy,
            ),
        ).toEqual([
            'role',
            'label',
            'testid',
            'css',
        ]);
    });


    test('should not mutate the original candidate array', () => {
        const candidates: LocatorCandidate[] = [
            candidate(
                'css',
                'css=#continue',
            ),

            candidate(
                'role',
                'role=button[name="Continue"]',
            ),
        ];

        priority.sort(candidates);

        expect(
            candidates.map(
                item => item.strategy,
            ),
        ).toEqual([
            'css',
            'role',
        ]);
    });

});