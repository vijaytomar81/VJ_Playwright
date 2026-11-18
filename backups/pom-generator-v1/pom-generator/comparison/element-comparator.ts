import type {
    GeneratedElement,
} from '../models/page.model';

export interface ElementComparisonResult {
    changed: boolean;

    changedFields: readonly string[];
}

export class ElementComparator {

    compare(
        existing: GeneratedElement,
        current: GeneratedElement,
    ): ElementComparisonResult {

        const changedFields: string[] = [];

        if (
            existing.name !==
            current.name
        ) {
            changedFields.push('name');
        }

        if (
            existing.type !==
            current.type
        ) {
            changedFields.push('type');
        }

        if (
            existing.locator.preferred !==
            current.locator.preferred
        ) {
            changedFields.push(
                'locator.preferred',
            );
        }

        if (
            !this.sameArray(
                existing.locator.fallbacks,
                current.locator.fallbacks,
            )
        ) {
            changedFields.push(
                'locator.fallbacks',
            );
        }

        return {
            changed:
                changedFields.length > 0,

            changedFields,
        };
    }


    private sameArray(
        left: readonly string[],
        right: readonly string[],
    ): boolean {

        if (
            left.length !==
            right.length
        ) {
            return false;
        }

        return left.every(
            (value, index) =>
                value === right[index],
        );
    }
}