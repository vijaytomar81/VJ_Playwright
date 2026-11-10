
/**
 * Identifies annotation fields that are not included
 * in the consumer's evidence reporting schema.
 *
 * The schema is passed in by the caller.
 * This file does not import consumer-owned schemas.
 */

export interface MissingReportingField {
    field: string;
    affectedTests: string[];
    occurrences: number;
}

interface EvidenceSchemaField {
    readonly field: string;
}

interface TestAnnotations {
    readonly testName: string;
    readonly annotations: readonly {
        readonly type: string;
        readonly description?: string;
    }[];
}

export function findMissingReportingFields(
    tests: readonly TestAnnotations[],
    evidenceSchema: readonly EvidenceSchemaField[],
): MissingReportingField[] {
    const knownFields = new Set(
        evidenceSchema.map(({ field }) => field),
    );

    const missingFields = new Map<
        string,
        {
            affectedTests: Set<string>;
            occurrences: number;
        }
    >();

    for (const test of tests) {
        for (const annotation of test.annotations) {
            const field = annotation.type;

            if (knownFields.has(field)) {
                continue;
            }

            let entry = missingFields.get(field);

            if (!entry) {
                entry = {
                    affectedTests: new Set<string>(),
                    occurrences: 0,
                };

                missingFields.set(field, entry);
            }

            entry.affectedTests.add(test.testName);
            entry.occurrences += 1;
        }
    }

    return Array.from(missingFields.entries())
        .map(([field, entry]) => ({
            field,
            affectedTests: Array.from(entry.affectedTests).sort(),
            occurrences: entry.occurrences,
        }))
        .sort((a, b) => a.field.localeCompare(b.field));
}
