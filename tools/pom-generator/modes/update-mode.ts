import type {
    GeneratedPage,
} from '../models/page.model';

import type {
    ElementChange,
} from '../models/change.model';

import type {
    ReviewDecision,
    ReviewResult,
} from '../review/review-decision.model';

import type {
    ReviewPlan,
} from '../review/review-plan.model';

import type {
    PomWriteResult,
} from '../writers/pom-output-writer';

import {
    MetadataStore,
} from '../metadata/metadata-store';

import {
    PageComparator,
} from '../comparison/page-comparator';

import {
    ReviewPlanBuilder,
} from '../review/review-plan-builder';

import {
    ChangeReviewer,
} from '../review/change-reviewer';

import {
    PomOutputWriter,
} from '../writers/pom-output-writer';

import {
    RegenerationSnapshotManager,
} from '../persistence/regeneration-snapshot-manager';

import type {
    RegenerationSnapshot,
} from '../persistence/regeneration-snapshot-manager';


export interface UpdateResult {
    existingPage:
    GeneratedPage;

    currentPage:
    GeneratedPage;

    updatedPage:
    GeneratedPage;

    changes:
    readonly ElementChange[];

    reviewPlan:
    ReviewPlan;

    reviewResult:
    ReviewResult;

    pom:
    PomWriteResult;

    metadataFile:
    string;
}


export class UpdateMode {

    constructor(
        private readonly metadataStore =
            new MetadataStore(),

        private readonly pageComparator =
            new PageComparator(),

        private readonly reviewPlanBuilder =
            new ReviewPlanBuilder(),

        private readonly changeReviewer =
            new ChangeReviewer(),

        private readonly pomOutputWriter =
            new PomOutputWriter(),

        private readonly snapshotManager =
            new RegenerationSnapshotManager(),
    ) { }


    async execute(
        currentPage: GeneratedPage,
        decisions:
            readonly ReviewDecision[],
    ): Promise<UpdateResult> {

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


        const reviewPlan =
            this.reviewPlanBuilder.build(
                changes,
            );


        const reviewResult =
            this.changeReviewer.apply(
                changes,
                decisions,
            );


        if (
            reviewResult
                .unresolvedStableKeys
                .length > 0
        ) {
            throw new Error(
                `Cannot UPDATE POM because review decisions are unresolved: ` +
                reviewResult
                    .unresolvedStableKeys
                    .join(', '),
            );
        }


        const updatedPage:
            GeneratedPage = {
            ...currentPage,

            elements:
                reviewResult.elements,
        };


        const snapshot =
            await this.snapshotManager.capture(
                currentPage,
                'UPDATE',
            );


        try {

            const pom =
                await this.pomOutputWriter.write(
                    updatedPage,
                );


            const metadataFile =
                await this.metadataStore.save(
                    updatedPage,
                );


            return {
                existingPage,
                currentPage,
                updatedPage,
                changes,
                reviewPlan,
                reviewResult,
                pom,
                metadataFile,
            };

        } catch (error) {

            return this.rollback(
                snapshot,
                error,
            );
        }
    }


    private async rollback(
        snapshot:
            RegenerationSnapshot,

        originalError:
            unknown,
    ): Promise<never> {

        try {

            await this.snapshotManager
                .restore(
                    snapshot,
                );

        } catch (rollbackError) {

            throw new AggregateError(
                [
                    originalError,
                    rollbackError,
                ],
                'UPDATE failed and rollback also failed.',
            );
        }


        throw originalError;
    }
}