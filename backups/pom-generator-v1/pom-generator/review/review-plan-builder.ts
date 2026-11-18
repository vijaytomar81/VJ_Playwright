import type {
    ChangeType,
    ElementChange,
} from '../models/change.model';

import {
    ReviewActionPolicy,
} from './review-action-policy';

import type {
    ReviewPlan,
    ReviewPlanItem,
} from './review-plan.model';


export class ReviewPlanBuilder {

    constructor(
        private readonly actionPolicy =
            new ReviewActionPolicy(),
    ) { }

    build(
        changes:
            readonly ElementChange[],
    ): ReviewPlan {

        const items =
            changes.map(
                change =>
                    this.buildItem(
                        change,
                    ),
            );


        return {
            items,

            requiresReview:
                changes.some(
                    change =>
                        change.type !==
                        'UNCHANGED',
                ),
        };
    }


    private buildItem(
        change:
            ElementChange,
    ): ReviewPlanItem {

        return {
            changeType:
                change.type,

            elementName:
                change.elementName,

            stableKey:
                change.stableKey,

            existingLocator:
                change.existing
                    ?.locator
                    .preferred,

            proposedLocator:
                change.current
                    ?.locator
                    .preferred,

            matchScore:
                change.matchScore,

            matchedFields:
                change.matchedFields ?? [],

            conflictingFields:
                change.conflictingFields ?? [],

            candidateStableKeys:
                change.candidateStableKeys ?? [],

            allowedActions:
                this.actionPolicy
                    .allowedActionsFor(
                        change.type,
                    ),
        };
    }
}