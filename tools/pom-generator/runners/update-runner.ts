
import type {
    Page,
} from '@playwright/test';

import type {
    GeneratePageInput,
} from '../generators/generated-page-assembler';

import {
    GeneratedPageAssembler,
} from '../generators/generated-page-assembler';

import type {
    ElementChange,
} from '../models/change.model';

import type {
    ReviewDecision,
} from '../review/review-decision.model';

import {
    MetadataStore,
} from '../metadata/metadata-store';

import {
    PageComparator,
} from '../comparison/page-comparator';

import {
    UpdateMode,
} from '../modes/update-mode';

import type {
    UpdateResult,
} from '../modes/update-mode';


export class UpdateRunner {

    constructor(
        private readonly metadataStore =
            new MetadataStore(),

        private readonly pageComparator =
            new PageComparator(),

        private readonly updateMode =
            new UpdateMode(),
    ) { }


    async run(
        page: Page,
        input: GeneratePageInput,
    ): Promise<UpdateResult> {

        const assembler =
            new GeneratedPageAssembler(
                page,
            );


        const currentPage =
            await assembler.assemble(
                input,
            );


        const existingPage =
            await this.metadataStore.load(
                currentPage,
            );


        if (!existingPage) {
            throw new Error(
                `Cannot UPDATE POM because metadata does not exist: ` +
                `${currentPage.brand} → ` +
                `${currentPage.channel} → ` +
                `${currentPage.product} → ` +
                `${currentPage.pageKey}`,
            );
        }


        const changes =
            this.pageComparator.compare(
                existingPage.elements,
                currentPage.elements,
            );


        const decisions =
            this.buildDecisions(
                changes,
            );


        const result =
            await this.updateMode.execute(
                currentPage,
                decisions,
            );


        const ambiguousChanges =
            result.changes.filter(
                change =>
                    change.type === 'AMBIGUOUS',
            );


        if (ambiguousChanges.length > 0) {

            console.warn(
                '\nPOM UPDATE warning: ' +
                `${ambiguousChanges.length} ambiguous ` +
                'element(s) were preserved without ' +
                'changing their existing definitions.',
            );


            for (const change of ambiguousChanges) {

                console.warn(
                    `  - ${change.elementName} ` +
                    `(${change.stableKey})`,
                );
            }


            console.warn(
                'Ambiguous current candidates were not ' +
                'automatically added. Review them ' +
                'separately if they represent new fields.',
            );
        }


        return result;
    }


    private buildDecisions(
        changes:
            readonly ElementChange[],
    ): readonly ReviewDecision[] {

        const decisions:
            ReviewDecision[] = [];


        for (const change of changes) {

            switch (change.type) {

                case 'UNCHANGED':
                    // Existing element is retained automatically.
                    break;


                case 'NEW':
                    // Only confidently new elements are added.
                    decisions.push({
                        stableKey:
                            change.stableKey,

                        action:
                            'ADD',
                    });
                    break;


                case 'CHANGED':
                case 'NOT_FOUND':
                case 'AMBIGUOUS':
                    // Preserve existing definitions.
                    decisions.push({
                        stableKey:
                            change.stableKey,

                        action:
                            'KEEP',
                    });
                    break;


                default: {
                    const unexpected:
                        never = change.type;

                    throw new Error(
                        `Unsupported change type: ${unexpected}`,
                    );
                }
            }
        }


        return decisions;
    }
}
