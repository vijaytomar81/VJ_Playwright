import {
    test,
    expect,
} from '@playwright/test';

import {
    PageNameGenerator,
} from '../../../tools/pom-generator/naming/page-name-generator';

const generator =
    new PageNameGenerator();

test.describe('PageNameGenerator', () => {

    test('should generate page naming representations', () => {
        const result =
            generator.generate(
                'Policyholder Details',
            );

        expect(result).toEqual({
            displayName: 'Policyholder Details',
            fileName: 'policyholder-details',
            className: 'PolicyholderDetails',
        });
    });


    test('should handle camelCase input', () => {
        const result =
            generator.generate(
                'policyholderDetails',
            );

        expect(result.fileName)
            .toBe('policyholder-details');

        expect(result.className)
            .toBe('PolicyholderDetails');
    });


    test('should trim surrounding whitespace', () => {
        const result =
            generator.generate(
                '  Car Details  ',
            );

        expect(result.displayName)
            .toBe('Car Details');

        expect(result.fileName)
            .toBe('car-details');

        expect(result.className)
            .toBe('CarDetails');
    });


    test('should reject an empty page name', () => {
        expect(
            () => generator.generate('   '),
        ).toThrow(
            'Page name cannot be empty.',
        );
    });

});