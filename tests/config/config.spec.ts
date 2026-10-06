import { test, expect } from '@playwright/test';

import {
    getBrands,
    getChannels,
    getProducts,
    isValidCombination,
    validateConfiguration,
} from '../../configLayer/config';

test.describe('Brand → Channel → Product Configuration', () => {

    test('should return configured brands', () => {
        const brands = getBrands();

        expect(brands).toContain('AZO');
        expect(brands).toContain('BRI');
        expect(brands).toContain('FERRY');
    });


    test('should return channels configured for AZO', () => {
        const channels = getChannels('AZO');

        expect(channels).toContain('CTM');
        expect(channels).toContain('CNF');
        expect(channels).toContain('MSM');
    });


    test('should return products configured for AZO → CTM', () => {
        const products = getProducts(
            'AZO',
            'CTM',
        );

        expect(products).toContain('Home');
        expect(products).toContain('Motor');
    });


    test('should accept valid AZO → CTM → Motor combination', () => {
        const valid = isValidCombination(
            'AZO',
            'CTM',
            'Motor',
        );

        expect(valid).toBe(true);
    });


    test('should reject unsupported AZO → CNF → Home combination', () => {
        const result = validateConfiguration({
            brand: 'AZO',
            channel: 'CNF',
            product: 'Home',
        });

        expect(result.valid).toBe(false);

        expect(result.message).toContain(
            "Product 'Home' is not configured",
        );
    });

});