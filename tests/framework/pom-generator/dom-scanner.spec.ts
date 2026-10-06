import {
    test,
    expect,
} from '@playwright/test';

import {
    DomScanner,
} from '../../../tools/pom-generator/scanner/dom-scanner';

test.describe(
    'DomScanner',
    () => {

        test('should scan supported visible elements', async ({
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

        <button id="continue">
          Continue
        </button>

        <a href="/help">
          Help
        </a>
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(elements)
                .toHaveLength(3);

            expect(
                elements.map(
                    element => element.type,
                ),
            ).toEqual([
                'input',
                'button',
                'link',
            ]);
        });


        test('should capture discovered metadata', async ({
            page,
        }) => {
            await page.setContent(`
        <fieldset>
          <legend>
            Policyholder Details
          </legend>

          <label for="firstName">
            First name
          </label>

          <input
            id="firstName"
            name="firstName"
            data-testid="first-name"
            placeholder="Enter first name"
          />
        </fieldset>
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(elements)
                .toHaveLength(1);

            const element =
                elements[0];

            expect(element.type)
                .toBe('input');

            expect(element.label)
                .toBe('First name');

            expect(element.id)
                .toBe('firstName');

            expect(element.name)
                .toBe('firstName');

            expect(element.testId)
                .toBe('first-name');

            expect(element.placeholder)
                .toBe('Enter first name');

            expect(element.context)
                .toBe(
                    'Policyholder Details',
                );
        });


        test('should classify checkbox and radio correctly', async ({
            page,
        }) => {
            await page.setContent(`
        <label>
          Marketing
          <input
            type="checkbox"
            id="marketing"
          />
        </label>

        <label>
          Yes
          <input
            type="radio"
            name="answer"
            value="yes"
          />
        </label>
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(
                elements.map(
                    element => element.type,
                ),
            ).toEqual([
                'checkbox',
                'radio',
            ]);
        });


        test('should scan role based controls', async ({
            page,
        }) => {
            await page.setContent(`
        <div
          role="button"
          aria-label="Continue"
          tabindex="0"
        >
          Continue
        </div>
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(elements)
                .toHaveLength(1);

            expect(elements[0].type)
                .toBe('button');

            expect(elements[0].role)
                .toBe('button');

            expect(elements[0].ariaLabel)
                .toBe('Continue');
        });


        test('should exclude hidden elements by default', async ({
            page,
        }) => {
            await page.setContent(`
        <input
          id="visibleInput"
        />

        <input
          id="hiddenInput"
          style="display: none"
        />
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(elements)
                .toHaveLength(1);

            expect(elements[0].id)
                .toBe('visibleInput');
        });


        test('should not generate locator candidates', async ({
            page,
        }) => {
            await page.setContent(`
        <label for="postcode">
          Postcode
        </label>

        <input
          id="postcode"
          name="postcode"
        />
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(
                elements[0]
                    .locatorCandidates,
            ).toEqual([]);
        });


        test('should ignore unsupported non-interactive elements', async ({
            page,
        }) => {
            await page.setContent(`
        <div>
          Ordinary content
        </div>

        <p>
          Some paragraph
        </p>

        <span>
          Some text
        </span>

        <button>
          Continue
        </button>
      `);

            const scanner =
                new DomScanner(page);

            const elements =
                await scanner.scan();

            expect(elements)
                .toHaveLength(1);

            expect(elements[0].type)
                .toBe('button');
        });

    },
);