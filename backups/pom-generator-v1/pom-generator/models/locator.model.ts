export type LocatorStrategy =
    | 'role'
    | 'label'
    | 'testid'
    | 'placeholder'
    | 'id'
    | 'name'
    | 'css';

export interface LocatorCandidate {
    strategy: LocatorStrategy;
    value: string;
    descriptor: string;
    unique: boolean;
    /**
     * Number of elements matched during validation.
     * Diagnostic only; does not affect uniqueness rules.
     */
    matchCount?: number;
}

export interface GeneratedLocator {
    preferred: string;
    fallbacks: readonly string[];
}