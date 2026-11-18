
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

    /*
     * Role and context are supporting evidence,
     * not sufficient identity evidence.
     *
     * At least one of these fields must match
     * before two fingerprints can be considered
     * the same logical element.
     */
    private readonly identityFields:
        readonly WeightedField[] = [
            'label',
            'ariaLabel',
            'name',
            'testId',
            'placeholder',
            'text',
        ];

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
         * Different logical element types are not
         * considered the same element.
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
             * Only compare a characteristic when
             * both fingerprints contain it.
             */
            if (!oldValue || !newValue) {
                continue;
            }

            const weight =
                this.weights[field];

            availableWeight += weight;

            if (oldValue === newValue) {

                matchedWeight += weight;

                matchedFields.push(
                    field,
                );

            } else {

                conflictingFields.push(
                    field,
                );
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

        /*
         * A shared role or page context alone
         * cannot establish element identity.
         *
         * This prevents unrelated controls
         * from receiving a 100% fingerprint
         * match solely because they belong
         * to the same form or section.
         */
        const hasIdentityEvidence =
            this.identityFields.some(
                field =>
                    matchedFields.includes(
                        field,
                    ),
            );

        return {
            matched:
                hasIdentityEvidence &&
                score >= this.threshold,

            score,

            matchedFields,

            conflictingFields,
        };
    }
}
