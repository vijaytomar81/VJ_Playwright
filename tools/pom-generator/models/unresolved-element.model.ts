
import type {
    CapturedElement,
} from './captured-element.model';

import type {
    LocatorCandidate,
} from './locator.model';

/**
 * Expected reasons why an element could not
 * be assigned a validated unique locator.
 *
 * Unexpected runtime errors should still
 * propagate rather than being classified
 * as ordinary locator-resolution failures.
 */
export type UnresolvedElementReason =
    | 'no-unique-locator'
    | 'original-element-mismatch';

/**
 * Captures an element that was successfully
 * scanned but could not be assigned a safe
 * locator.
 *
 * Unresolved elements must not be emitted
 * as executable POM actions.
 */
export interface UnresolvedElement {

    /**
     * Proposed generated name.
     *
     * This is diagnostic information, not
     * an approved action name.
     */
    name: string;

    /**
     * Original captured element metadata.
     *
     * Preserves the details needed to
     * investigate the unresolved element.
     */
    element: CapturedElement;

    /**
     * Reason locator resolution failed.
     */
    reason: UnresolvedElementReason;

    /**
     * All candidates attempted, including
     * their validation results.
     *
     * A candidate with unique=false must
     * never be used as an executable locator.
     */
    candidates: readonly LocatorCandidate[];

    /**
     * Human-readable diagnostic message.
     */
    message: string;
}
