import {
    test,
    expect,
} from '@playwright/test';

import {
    ElementMetadataReader,
} from '../../../tools/pom-generator/scanner/element-metadata-reader';

const reader =
    new ElementMetadataReader();

test.describe(
    'ElementMetadataReader',
    () => {

        test('should read element attributes', async ({
            page,
        }) => {
            await page.setContent(`
        <input
          id="firstName"
          name="customerFirstName"
          data-testid="first-name"
          placeholder="Enter first name"
          aria-label="First name"
        />
      `);

            const handle =
                await page.$('#firstName');

            expect(handle)
                .not.toBeNull();

            const metadata =
                await reader.read(
                    handle!,
                );

            expect(metadata.tagName)
                .toBe('input');

            expect(metadata.id)
                .toBe('firstName');

            expect(metadata.name)
                .toBe('customerFirstName');

            expect(metadata.testId)
                .toBe('first-name');

            expect(metadata.placeholder)
                .toBe('Enter first name');

            expect(metadata.ariaLabel)
                .toBe('First name');
        });


        test('should discover label using for attribute', async ({
            page,
        }) => {
            await page.setContent(`
        <label for="postcode">
          Postcode
        </label>

        <input id="postcode" />
      `);

            const handle =
                await page.$('#postcode');

            const metadata =
                await reader.read(
                    handle!,
                );

            expect(metadata.label)
                .toBe('Postcode');
        });


        test('should discover wrapping label', async ({
            page,
        }) => {
            await page.setContent(`
        <label>
          Email address
          <input id="email" />
        </label>
      `);

            const handle =
                await page.$('#email');

            const metadata =
                await reader.read(
                    handle!,
                );

            expect(metadata.label)
                .toBe('Email address');
        });


        test('should capture surrounding semantic context', async ({
            page,
        }) => {
            await page.setContent(`
        <fieldset>
          <legend>
            Policyholder Details
          </legend>

          <input id="firstName" />
        </fieldset>
      `);

            const handle =
                await page.$('#firstName');

            const metadata =
                await reader.read(
                    handle!,
                );

            expect(metadata.context)
                .toBe(
                    'Policyholder Details',
                );
        });


        test('should identify hidden elements', async ({
            page,
        }) => {
            await page.setContent(`
        <input
          id="hiddenInput"
          style="display: none"
        />
      `);

            const handle =
                await page.$(
                    '#hiddenInput',
                );

            const metadata =
                await reader.read(
                    handle!,
                );

            expect(metadata.visible)
                .toBe(false);
        });

    },
);