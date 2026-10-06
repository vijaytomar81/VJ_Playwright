import type {
    LocatorCandidate,
} from './locator.model';

export type ElementType =
    | 'input'
    | 'button'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'radio'
    | 'link'
    | 'text';

export interface CapturedElement {
    tagName: string;

    type: ElementType;

    role?: string;

    label?: string;

    text?: string;

    id?: string;

    name?: string;

    testId?: string;

    placeholder?: string;

    ariaLabel?: string;

    visible: boolean;

    /**
     * Context surrounding the element.
     *
     * Used by stable-key/fingerprint matching during
     * POM regeneration.
     */
    context?: string;

    locatorCandidates: readonly LocatorCandidate[];
}