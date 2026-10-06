import {
    test,
    expect,
} from '@playwright/test';

import {
    LocatorBuilder,
} from '../../../tools/pom-generator/locator/locator-builder';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';

const builder =
    new LocatorBuilder();

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

test.describe('LocatorBuilder', () => {

    test('should build supported locator candidates', () => {
        const element = createElement({
            role: 'textbox',
            label: 'First name',
            testId: 'first-name',
            placeholder: 'Enter first name',
            id: 'firstName',
            name: 'firstName',
        });

        const candidates =
            builder.build(element);

        expect(
            candidates.map(
                candidate =>
                    candidate.descriptor,
            ),
        ).toEqual([
            'role=textbox[name="First name"]',
            'label=First name',
            'testid=first-name',
            'placeholder=Enter first name',
            'css=#firstName',
            'css=[name="firstName"]',
        ]);
    });


    test('should initialise candidates as not yet unique', () => {
        const element = createElement({
            label: 'Postcode',
            id: 'postcode',
        });

        const candidates =
            builder.build(element);

        expect(
            candidates.every(
                candidate =>
                    candidate.unique === false,
            ),
        ).toBe(true);
    });


    test('should only create candidates for available attributes', () => {
        const element = createElement({
            id: 'postcode',
        });

        const candidates =
            builder.build(element);

        expect(candidates).toHaveLength(1);

        expect(candidates[0].descriptor)
            .toBe('css=#postcode');
    });


    test('should create role locator using accessible name', () => {
        const element = createElement({
            tagName: 'button',
            type: 'button',
            role: 'button',
            text: 'Continue',
        });

        const candidates =
            builder.build(element);

        expect(candidates[0].descriptor)
            .toBe(
                'role=button[name="Continue"]',
            );
    });

});