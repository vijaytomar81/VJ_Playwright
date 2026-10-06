import {
    test,
    expect,
} from '@playwright/test';

import {
    LocatorValidator,
} from '../../../tools/pom-generator/locator/locator-validator';

import type {
    LocatorCandidate,
} from '../../../tools/pom-generator/models/locator.model';

function candidate(
    strategy: LocatorCandidate['strategy'],
    value: string,
    descriptor: string,
): LocatorCandidate {
    return {
        strategy,
        value,
        descriptor,
        unique: false,
    };
}

test.describe('LocatorValidator', () => {

    test('should mark a single matching locator as unique', async ({
        page,
    }) => {
        await page.setContent(`
      <label for="firstName">
        First name
      </label>

      <input
        id="firstName"
        name="firstName"
      />
    `);

        const validator =
            new LocatorValidator(page);

        const result =
            await validator.validate([
                candidate(
                    'label',
                    'First name',
                    'label=First name',
                ),
            ]);

        expect(result[0].unique)
            .toBe(true);
    });


    test('should mark duplicate locators as non-unique', async ({
        page,
    }) => {
        await page.setContent(`
      <input
        placeholder="Search"
      />

      <input
        placeholder="Search"
      />
    `);

        const validator =
            new LocatorValidator(page);

        const result =
            await validator.validate([
                candidate(
                    'placeholder',
                    'Search',
                    'placeholder=Search',
                ),
            ]);

        expect(result[0].unique)
            .toBe(false);
    });


    test('should mark missing locators as non-unique', async ({
        page,
    }) => {
        await page.setContent(`
      <button>
        Continue
      </button>
    `);

        const validator =
            new LocatorValidator(page);

        const result =
            await validator.validate([
                candidate(
                    'testid',
                    'missing-button',
                    'testid=missing-button',
                ),
            ]);

        expect(result[0].unique)
            .toBe(false);
    });


    test('should validate role locators', async ({
        page,
    }) => {
        await page.setContent(`
      <button>
        Continue
      </button>
    `);

        const validator =
            new LocatorValidator(page);

        const result =
            await validator.validate([
                candidate(
                    'role',
                    'Continue',
                    'role=button[name="Continue"]',
                ),
            ]);

        expect(result[0].unique)
            .toBe(true);
    });


    test('should validate id locators', async ({
        page,
    }) => {
        await page.setContent(`
      <input id="postcode" />
    `);

        const validator =
            new LocatorValidator(page);

        const result =
            await validator.validate([
                candidate(
                    'id',
                    'postcode',
                    'css=#postcode',
                ),
            ]);

        expect(result[0].unique)
            .toBe(true);
    });

});