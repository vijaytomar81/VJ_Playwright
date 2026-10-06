import type {
    ElementChange,
} from '../models/change.model';

import type {
    GeneratedElement,
} from '../models/page.model';

import type {
    ReviewAction,
    ReviewDecision,
    ReviewResult,
} from './review-decision.model';

import {
    ReviewActionPolicy,
} from './review-action-policy';


export class ChangeReviewer {

    constructor(

        private readonly actionPolicy =

            new ReviewActionPolicy(),

    ) { }

    apply(
        changes:
            readonly ElementChange[],

        decisions:
            readonly ReviewDecision[],
    ): ReviewResult {

        const elements:
            GeneratedElement[] = [];

        const appliedDecisions:
            ReviewDecision[] = [];

        const unresolvedStableKeys:
            string[] = [];


        const decisionMap =
            this.buildDecisionMap(
                decisions,
            );


        for (const change of changes) {

            if (
                change.type ===
                'UNCHANGED'
            ) {
                if (change.existing) {
                    elements.push(
                        change.existing,
                    );
                }

                continue;
            }


            if (
                !change.stableKey
            ) {
                continue;
            }


            const decision =
                decisionMap.get(
                    change.stableKey,
                );


            if (!decision) {
                unresolvedStableKeys.push(
                    change.stableKey,
                );

                continue;
            }


            if (
                !this.actionPolicy.isAllowed(
                    change.type,
                    decision.action,
                )
            ) {
                throw new Error(
                    `Review action ${decision.action} is not valid ` +
                    `for change type ${change.type} ` +
                    `(${change.elementName}).`,
                );
            }


            this.applyDecision(
                change,
                decision.action,
                elements,
            );


            appliedDecisions.push(
                decision,
            );
        }


        return {
            elements,

            appliedDecisions,

            unresolvedStableKeys,
        };
    }


    private buildDecisionMap(
        decisions:
            readonly ReviewDecision[],
    ): Map<string, ReviewDecision> {

        const decisionMap =
            new Map<
                string,
                ReviewDecision
            >();


        for (const decision of decisions) {

            if (
                decisionMap.has(
                    decision.stableKey,
                )
            ) {
                throw new Error(
                    `Duplicate review decision for stableKey: ` +
                    `${decision.stableKey}`,
                );
            }


            decisionMap.set(
                decision.stableKey,
                decision,
            );
        }


        return decisionMap;
    }


    private applyDecision(
        change:
            ElementChange,

        action:
            ReviewAction,

        elements:
            GeneratedElement[],
    ): void {

        switch (action) {

            case 'ADD':

                if (change.current) {
                    elements.push(
                        change.current,
                    );
                }

                return;


            case 'UPDATE':

                if (change.current) {
                    elements.push(
                        change.current,
                    );
                }

                return;


            case 'KEEP':

                if (change.existing) {
                    elements.push(
                        change.existing,
                    );
                }

                return;


            case 'IGNORE':

                /*
                 * IGNORE means:
                 *
                 * preserve an existing element
                 * when one exists, but do not
                 * accept a NEW element.
                 */
                if (change.existing) {
                    elements.push(
                        change.existing,
                    );
                }

                return;


            case 'REMOVE':

                /*
                 * Explicitly approved removal.
                 *
                 * Do not add the existing element
                 * to the resulting collection.
                 */
                return;
        }
    }
}