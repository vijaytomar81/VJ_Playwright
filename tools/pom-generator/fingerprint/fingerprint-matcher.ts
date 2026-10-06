import type {
    ElementFingerprint,
} from './element-fingerprint';

export interface FingerprintMatchResult {
    matched: boolean;

    score: number;

    matchedFields: readonly string[];

    conflictingFields: readonly string[];
}

type WeightedField =
    Exclude<
        keyof ElementFingerprint,
        'type'
    >;

export class FingerprintMatcher {

    private readonly threshold = 0.65;

    private readonly weights:
        Record<WeightedField, number> = {
            role: 10,
            label: 30,
            ariaLabel: 25,
            name: 15,
            testId: 20,
            placeholder: 10,
            text: 15,
            context: 20,
        };

    match(
        existing: ElementFingerprint,
        current: ElementFingerprint,
    ): FingerprintMatchResult {

        /*
         * Different logical element types are not considered
         * the same element.
         */
        if (existing.type !== current.type) {
            return {
                matched: false,
                score: 0,
                matchedFields: [],
                conflictingFields: ['type'],
            };
        }

        let availableWeight = 0;
        let matchedWeight = 0;

        const matchedFields: string[] = [];
        const conflictingFields: string[] = [];

        const fields =
            Object.keys(
                this.weights,
            ) as WeightedField[];

        for (const field of fields) {
            const oldValue =
                existing[field];

            const newValue =
                current[field];

            /*
             * Only compare a characteristic when both
             * fingerprints contain it.
             */
            if (!oldValue || !newValue) {
                continue;
            }

            const weight =
                this.weights[field];

            availableWeight += weight;

            if (oldValue === newValue) {
                matchedWeight += weight;

                matchedFields.push(field);
            } else {
                conflictingFields.push(field);
            }
        }

        if (availableWeight === 0) {
            return {
                matched: false,
                score: 0,
                matchedFields,
                conflictingFields,
            };
        }

        const score =
            matchedWeight /
            availableWeight;

        return {
            matched:
                score >= this.threshold,

            score,

            matchedFields,

            conflictingFields,
        };
    }
}