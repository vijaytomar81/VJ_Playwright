import {
    test,
    expect,
} from '@playwright/test';

import {
    ElementTypeResolver,
} from '../../../tools/pom-generator/scanner/element-type-resolver';

const resolver =
    new ElementTypeResolver();

test.describe(
    'ElementTypeResolver',
    () => {

        test('should resolve standard form elements', () => {
            expect(
                resolver.resolve({
                    tagName: 'input',
                    inputType: 'text',
                }),
            ).toBe('input');

            expect(
                resolver.resolve({
                    tagName: 'button',
                }),
            ).toBe('button');

            expect(
                resolver.resolve({
                    tagName: 'select',
                }),
            ).toBe('select');

            expect(
                resolver.resolve({
                    tagName: 'textarea',
                }),
            ).toBe('textarea');

            expect(
                resolver.resolve({
                    tagName: 'a',
                }),
            ).toBe('link');
        });


        test('should resolve checkbox input', () => {
            expect(
                resolver.resolve({
                    tagName: 'input',
                    inputType: 'checkbox',
                }),
            ).toBe('checkbox');
        });


        test('should resolve radio input', () => {
            expect(
                resolver.resolve({
                    tagName: 'input',
                    inputType: 'radio',
                }),
            ).toBe('radio');
        });


        test('should resolve semantic role elements', () => {
            expect(
                resolver.resolve({
                    tagName: 'div',
                    role: 'button',
                }),
            ).toBe('button');

            expect(
                resolver.resolve({
                    tagName: 'span',
                    role: 'link',
                }),
            ).toBe('link');
        });


        test('should reject unsupported elements', () => {
            expect(
                resolver.resolve({
                    tagName: 'div',
                }),
            ).toBeUndefined();

            expect(
                resolver.resolve({
                    tagName: 'p',
                }),
            ).toBeUndefined();
        });

    },
);