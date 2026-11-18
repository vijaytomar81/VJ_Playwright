import type {
    GeneratedElement,
} from '../models/page.model';


export type ReviewAction =
    | 'ADD'
    | 'UPDATE'
    | 'KEEP'
    | 'REMOVE'
    | 'IGNORE';


export interface ReviewDecision {
    stableKey: string;

    action: ReviewAction;
}


export interface ReviewResult {
    elements: readonly GeneratedElement[];

    appliedDecisions:
    readonly ReviewDecision[];

    unresolvedStableKeys:
    readonly string[];
}