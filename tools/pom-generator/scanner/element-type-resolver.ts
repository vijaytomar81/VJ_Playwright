import type {
    ElementType,
} from '../models/captured-element.model';

export interface ElementTypeInput {
    tagName: string;
    inputType?: string;
    role?: string;
}

export class ElementTypeResolver {

    resolve(
        input: ElementTypeInput,
    ): ElementType | undefined {
        const tagName =
            input.tagName.toLowerCase();

        const inputType =
            input.inputType?.toLowerCase();

        const role =
            input.role?.toLowerCase();

        if (
            tagName === 'button' ||
            role === 'button'
        ) {
            return 'button';
        }

        if (
            tagName === 'a' ||
            role === 'link'
        ) {
            return 'link';
        }

        if (
            tagName === 'select' ||
            role === 'combobox'
        ) {
            return 'select';
        }

        if (tagName === 'textarea') {
            return 'textarea';
        }

        if (
            inputType === 'checkbox' ||
            role === 'checkbox'
        ) {
            return 'checkbox';
        }

        if (
            inputType === 'radio' ||
            role === 'radio'
        ) {
            return 'radio';
        }

        if (tagName === 'input') {
            return 'input';
        }

        return undefined;
    }
}