import type {
    GeneratedPage,
} from '../models/page.model';

import type {
    ElementChange,
} from '../models/change.model';

import type {
    ReviewPlan,
} from '../review/review-plan.model';

import {
    MetadataStore,
} from '../metadata/metadata-store';

import {
    PageComparator,
} from '../comparison/page-comparator';

import {
    ReviewPlanBuilder,
} from '../review/review-plan-builder';


export interface ValidateResult {
    existingPage:
    GeneratedPage;

    currentPage:
    GeneratedPage;

    changes:
    readonly ElementChange[];

    reviewPlan:
    ReviewPlan;
}


export class ValidateMode {

    constructor(
        private readonly metadataStore =
            new MetadataStore(),

        private readonly pageComparator =
            new PageComparator(),

        private readonly reviewPlanBuilder =
            new ReviewPlanBuilder(),
    ) { }


    async execute(
        currentPage: GeneratedPage,
    ): Promise<ValidateResult> {

        const existingPage =
            await this.metadataStore.load(
                currentPage,
            );


        if (!existingPage) {
            throw new Error(
                `Cannot VALIDATE POM because metadata does not exist: ` +
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


        const reviewPlan =
            this.reviewPlanBuilder.build(
                changes,
            );


        return {
            existingPage,
            currentPage,
            changes,
            reviewPlan,
        };
    }
}