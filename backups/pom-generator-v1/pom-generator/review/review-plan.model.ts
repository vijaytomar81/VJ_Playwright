import type {
    ChangeType,
} from '../models/change.model';

import type {
    ReviewAction,
} from './review-decision.model';


export interface ReviewPlanItem {
    changeType: ChangeType;

    elementName: string;

    stableKey?: string;

    existingLocator?: string;

    proposedLocator?: string;

    matchScore?: number;

    matchedFields:
    readonly string[];

    conflictingFields:
    readonly string[];

    candidateStableKeys:
    readonly string[];

    allowedActions:
    readonly ReviewAction[];
}


export interface ReviewPlan {
    items:
    readonly ReviewPlanItem[];

    requiresReview: boolean;
}