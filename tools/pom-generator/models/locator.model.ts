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
}

export interface GeneratedLocator {
    preferred: string;
    fallbacks: readonly string[];
}