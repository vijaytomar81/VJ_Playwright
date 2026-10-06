import {
    test,
    expect,
} from '@playwright/test';

import {
    FingerprintMatcher,
} from '../../../tools/pom-generator/fingerprint/fingerprint-matcher';

import type {
    ElementFingerprint,
} from '../../../tools/pom-generator/fingerprint/element-fingerprint';

const matcher =
    new FingerprintMatcher();

function fingerprint(
    overrides:
        Partial<ElementFingerprint>,
): ElementFingerprint {
    return {
        type: 'input',
        ...overrides,
    };
}

test.describe(
    'FingerprintMatcher',
    () => {

        test('should match identical logical elements', () => {
            const existing =
                fingerprint({
                    role: 'textbox',
                    label: 'first name',
                    name: 'firstname',
                    context:
                        'policyholder details',
                });

            const current =
                fingerprint({
                    role: 'textbox',
                    label: 'first name',
                    name: 'firstname',
                    context:
                        'policyholder details',
                });

            const result =
                matcher.match(
                    existing,
                    current,
                );

            expect(result.matched)
                .toBe(true);

            expect(result.score)
                .toBe(1);
        });


        test('should tolerate a changed lower-weight attribute', () => {
            const existing =
                fingerprint({
                    role: 'textbox',
                    label: 'first name',
                    name: 'firstname',
                    context:
                        'policyholder details',
                });

            const current =
                fingerprint({
                    role: 'textbox',
                    label: 'first name',
                    name:
                        'customerfirstname',
                    context:
                        'policyholder details',
                });

            const result =
                matcher.match(
                    existing,
                    current,
                );

            expect(result.matched)
                .toBe(true);

            expect(
                result.conflictingFields,
            ).toContain('name');
        });


        test('should reject different element types', () => {
            const existing =
                fingerprint({
                    label: 'continue',
                });

            const current:
                ElementFingerprint = {
                type: 'button',
                label: 'continue',
            };

            const result =
                matcher.match(
                    existing,
                    current,
                );

            expect(result.matched)
                .toBe(false);

            expect(result.score)
                .toBe(0);

            expect(
                result.conflictingFields,
            ).toContain('type');
        });


        test('should reject unrelated elements', () => {
            const existing =
                fingerprint({
                    label: 'first name',
                    name: 'firstname',
                    context:
                        'policyholder details',
                });

            const current =
                fingerprint({
                    label: 'postcode',
                    name: 'postcode',
                    context:
                        'address details',
                });

            const result =
                matcher.match(
                    existing,
                    current,
                );

            expect(result.matched)
                .toBe(false);
        });


        test('should reject fingerprints with no comparable information', () => {
            const existing =
                fingerprint({});

            const current =
                fingerprint({});

            const result =
                matcher.match(
                    existing,
                    current,
                );

            expect(result.matched)
                .toBe(false);

            expect(result.score)
                .toBe(0);
        });

    },
);