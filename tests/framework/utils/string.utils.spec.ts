import {
    test,
    expect,
} from '@playwright/test';

import {
    StringUtils,
} from '../../../utils/string/string.utils';

test.describe('StringUtils', () => {

    test('should convert text to camelCase', () => {
        expect(
            StringUtils.toCamelCase(
                'Policyholder Details',
            ),
        ).toBe('policyholderDetails');
    });


    test('should convert text to PascalCase', () => {
        expect(
            StringUtils.toPascalCase(
                'Policyholder Details',
            ),
        ).toBe('PolicyholderDetails');
    });


    test('should convert text to kebab-case', () => {
        expect(
            StringUtils.toKebabCase(
                'Policyholder Details',
            ),
        ).toBe('policyholder-details');
    });


    test('should handle existing camelCase text', () => {
        expect(
            StringUtils.toKebabCase(
                'policyholderDetails',
            ),
        ).toBe('policyholder-details');
    });


    test('should handle spaces and special characters', () => {
        expect(
            StringUtils.toCamelCase(
                '  Find   Address!  ',
            ),
        ).toBe('findAddress');
    });


    test('should return empty string for empty input', () => {
        expect(
            StringUtils.toCamelCase(''),
        ).toBe('');

        expect(
            StringUtils.toPascalCase(''),
        ).toBe('');

        expect(
            StringUtils.toKebabCase(''),
        ).toBe('');
    });

});