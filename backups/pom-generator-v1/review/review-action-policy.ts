import type {
    ChangeType,
} from '../models/change.model';

import type {
    ReviewAction,
} from './review-decision.model';


export class ReviewActionPolicy {

    allowedActionsFor(
        changeType: ChangeType,
    ): readonly ReviewAction[] {

        switch (changeType) {

            case 'UNCHANGED':
                return [];


            case 'NEW':
                return [
                    'ADD',
                    'IGNORE',
                ];


            case 'CHANGED':
                return [
                    'UPDATE',
                    'KEEP',
                    'IGNORE',
                ];


            case 'NOT_FOUND':
                return [
                    'KEEP',
                    'REMOVE',
                    'IGNORE',
                ];


            case 'AMBIGUOUS':
                return [
                    'KEEP',
                    'IGNORE',
                ];
        }
    }


    isAllowed(
        changeType: ChangeType,
        action: ReviewAction,
    ): boolean {

        return this
            .allowedActionsFor(
                changeType,
            )
            .includes(
                action,
            );
    }
}