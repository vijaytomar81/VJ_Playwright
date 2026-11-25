/**
 * Identifies annotation fields not included in the
 * consumer's evidence reporting schema.
 *
 * The schema is supplied by the caller.
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
    readonly annotations: Readonly<Record<string, string>>;
}

const SENSITIVE = /card.?number|card.?no|cvv|cvc|security.?code|password|secret|token|authorization|api.?key|access.?key|private.?key/i;

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
        for (const field of Object.keys(test.annotations)) {
            if (knownFields.has(field) || SENSITIVE.test(field)) {
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
