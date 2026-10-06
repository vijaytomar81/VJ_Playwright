import {
    test,
    expect,
} from '@playwright/test';

import {
    ElementNameGenerator,
} from '../../../tools/pom-generator/naming/element-name-generator';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';

const generator =
    new ElementNameGenerator();

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

test.describe('ElementNameGenerator', () => {

    test('should use label as the preferred name source', () => {
        const element = createElement({
            label: 'First name',
            id: 'customer_first_name_123',
        });

        expect(
            generator.generate(element),
        ).toBe('firstName');
    });


    test('should use aria-label when label is unavailable', () => {
        const element = createElement({
            ariaLabel: 'Email address',
            id: 'email_123',
        });

        expect(
            generator.generate(element),
        ).toBe('emailAddress');
    });


    test('should append Button for button elements', () => {
        const element = createElement({
            tagName: 'button',
            type: 'button',
            text: 'Continue',
        });

        expect(
            generator.generate(element),
        ).toBe('continueButton');
    });


    test('should append Checkbox for checkbox elements', () => {
        const element = createElement({
            type: 'checkbox',
            label: 'Marketing choice',
        });

        expect(
            generator.generate(element),
        ).toBe('marketingChoiceCheckbox');
    });


    test('should not duplicate an existing type suffix', () => {
        const element = createElement({
            tagName: 'button',
            type: 'button',
            text: 'Continue button',
        });

        expect(
            generator.generate(element),
        ).toBe('continueButton');
    });


    test('should fall back to id when descriptive properties are unavailable', () => {
        const element = createElement({
            id: 'policyNumber',
        });

        expect(
            generator.generate(element),
        ).toBe('policyNumber');
    });

});