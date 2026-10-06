import type {
    GeneratedElement,
} from './page.model';

export type ChangeType =
    | 'UNCHANGED'
    | 'NEW'
    | 'CHANGED'
    | 'NOT_FOUND'
    | 'AMBIGUOUS';

export interface ElementChange {
    type: ChangeType;

    elementName: string;

    stableKey?: string;

    existing?: GeneratedElement;

    current?: GeneratedElement;

    matchScore?: number;

    matchedFields?: readonly string[];

    conflictingFields?: readonly string[];

    candidateStableKeys?: readonly string[];
}