import {
    test,
    expect,
} from '@playwright/test';

import {
    ElementFingerprintBuilder,
} from '../../../tools/pom-generator/fingerprint/element-fingerprint';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';

const builder =
    new ElementFingerprintBuilder();

function createElement(
    overrides: Partial<CapturedElement>,
): CapturedElement {
    return {
        tagName: 'input',
        type: 'input',
        visible: true,
        locatorCandidates: [],
        ...overrides,
    };
}

test.describe(
    'ElementFingerprintBuilder',
    () => {

        test('should build fingerprint from logical element characteristics', () => {
            const element =
                createElement({
                    role: 'textbox',
                    label: 'First Name',
                    name: 'firstName',
                    context: 'Policyholder Details',
                });

            const fingerprint =
                builder.build(element);

            expect(fingerprint).toEqual({
                type: 'input',
                role: 'textbox',
                label: 'first name',
                ariaLabel: undefined,
                name: 'firstname',
                testId: undefined,
                placeholder: undefined,
                text: undefined,
                context:
                    'policyholder details',
            });
        });


        test('should normalize whitespace and casing', () => {
            const element =
                createElement({
                    label:
                        '  First   Name  ',
                });

            expect(
                builder.build(element).label,
            ).toBe('first name');
        });


        test('should not use locator or html id as fingerprint identity', () => {
            const element =
                createElement({
                    id: 'dynamic_12345',
                    label: 'Postcode',
                });

            const fingerprint =
                builder.build(element);

            expect(
                Object.prototype.hasOwnProperty.call(
                    fingerprint,
                    'id',
                ),
            ).toBe(false);

            expect(
                Object.prototype.hasOwnProperty.call(
                    fingerprint,
                    'locatorCandidates',
                ),
            ).toBe(false);
        });

    },
);