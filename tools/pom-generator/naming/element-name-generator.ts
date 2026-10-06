import {
    StringUtils,
} from '../../../utils/string/string.utils';

import type {
    CapturedElement,
    ElementType,
} from '../models/captured-element.model';

export class ElementNameGenerator {

    generate(
        element: CapturedElement,
    ): string {
        const source =
            this.getBestNameSource(element);

        const baseName =
            StringUtils.toCamelCase(source);

        return this.addTypeSuffix(
            baseName || 'element',
            element.type,
        );
    }

    private getBestNameSource(
        element: CapturedElement,
    ): string {
        return (
            element.label ||
            element.ariaLabel ||
            element.placeholder ||
            element.text ||
            element.name ||
            element.id ||
            element.testId ||
            element.tagName
        );
    }

    private addTypeSuffix(
        name: string,
        type: ElementType,
    ): string {
        const suffixes: Partial<
            Record<ElementType, string>
        > = {
            button: 'Button',
            checkbox: 'Checkbox',
            radio: 'Radio',
            link: 'Link',
        };

        const suffix =
            suffixes[type];

        if (!suffix) {
            return name;
        }

        if (
            name.toLowerCase().endsWith(
                suffix.toLowerCase(),
            )
        ) {
            return name;
        }

        return `${name}${suffix}`;
    }
}