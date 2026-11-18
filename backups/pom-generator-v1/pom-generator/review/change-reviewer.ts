
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

        const approvedStableKeys =
            new Set<string>();


        const decisionMap =
            this.buildDecisionMap(
                decisions,
            );


        for (const change of changes) {

            /*
             * Every change must have a stable identity.
             *
             * Silently skipping an unidentified change
             * could cause an existing element to
             * disappear from generated metadata.
             */
            if (!change.stableKey) {
                throw new Error(
                    `Cannot review element without a stableKey: ` +
                    `${change.elementName} (${change.type}).`,
                );
            }


            if (
                change.type ===
                'UNCHANGED'
            ) {

                if (!change.existing) {
                    throw new Error(
                        `UNCHANGED element is missing its existing definition: ` +
                        `${change.elementName}.`,
                    );
                }


                this.addApprovedElement(
                    change.existing,
                    elements,
                    approvedStableKeys,
                );

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
                approvedStableKeys,
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
                !decision.stableKey
            ) {
                throw new Error(
                    'Review decision is missing a stableKey.',
                );
            }


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

        approvedStableKeys:
            Set<string>,
    ): void {

        switch (action) {

            case 'ADD': {

                if (!change.current) {
                    throw new Error(
                        `ADD requires a current element: ` +
                        `${change.elementName}.`,
                    );
                }


                this.assertStableKey(
                    change.current,
                    change.stableKey,
                    'ADD',
                );


                this.addApprovedElement(
                    change.current,
                    elements,
                    approvedStableKeys,
                );

                return;
            }


            case 'UPDATE': {

                if (!change.existing) {
                    throw new Error(
                        `UPDATE requires an existing element: ` +
                        `${change.elementName}.`,
                    );
                }


                if (!change.current) {
                    throw new Error(
                        `UPDATE requires a current element: ` +
                        `${change.elementName}.`,
                    );
                }


                this.assertStableKey(
                    change.existing,
                    change.stableKey,
                    'UPDATE existing',
                );


                /*
                 * The comparator must preserve the
                 * existing stable identity when it
                 * creates a matched current element.
                 */
                this.assertStableKey(
                    change.current,
                    change.stableKey,
                    'UPDATE current',
                );


                this.addApprovedElement(
                    change.current,
                    elements,
                    approvedStableKeys,
                );

                return;
            }


            case 'KEEP':
            case 'IGNORE': {

                /*
                 * Preserve the existing element,
                 * including its approved locator,
                 * name, and stableKey.
                 *
                 * IGNORE on NEW intentionally adds
                 * nothing to the output.
                 */
                if (change.existing) {

                    this.assertStableKey(
                        change.existing,
                        change.stableKey,
                        action,
                    );


                    this.addApprovedElement(
                        change.existing,
                        elements,
                        approvedStableKeys,
                    );
                }

                return;
            }


            case 'REMOVE':

                /*
                 * Explicitly approved removal.
                 *
                 * The action policy determines
                 * which change types can be removed.
                 */
                return;
        }
    }


    private assertStableKey(
        element:
            GeneratedElement,

        expectedStableKey:
            string,

        operation:
            string,
    ): void {

        if (
            !element.stableKey ||
            element.stableKey !==
            expectedStableKey
        ) {
            throw new Error(
                `${operation} stableKey mismatch for ` +
                `${element.name}: expected ` +
                `${expectedStableKey}, received ` +
                `${element.stableKey}.`,
            );
        }
    }


    private addApprovedElement(
        element:
            GeneratedElement,

        elements:
            GeneratedElement[],

        approvedStableKeys:
            Set<string>,
    ): void {

        if (!element.stableKey) {
            throw new Error(
                `Approved element is missing a stableKey: ` +
                `${element.name}.`,
            );
        }


        if (
            approvedStableKeys.has(
                element.stableKey,
            )
        ) {
            throw new Error(
                `Duplicate approved element stableKey: ` +
                `${element.stableKey}.`,
            );
        }


        approvedStableKeys.add(
            element.stableKey,
        );


        elements.push(
            element,
        );
    }
}
