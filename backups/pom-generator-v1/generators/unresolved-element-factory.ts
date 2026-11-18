
import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    LocatorCandidate,
} from '../models/locator.model';

import type {
    UnresolvedElement,
    UnresolvedElementReason,
} from '../models/unresolved-element.model';


/**
 * Creates structured diagnostics for captured
 * elements that cannot be assigned a valid locator.
 *
 * This class does not perform locator validation.
 * It only describes an unsuccessful resolution.
 */
export class UnresolvedElementFactory {

    create(
        name: string,
        element: CapturedElement,
        candidates: readonly LocatorCandidate[],
        originalElementAvailable: boolean,
    ): UnresolvedElement {

        /*
         * A locator that matches exactly one DOM
         * element but fails identity validation
         * indicates an original-element mismatch.
         */
        const hasIdentityMismatch =
            originalElementAvailable &&
            candidates.some(
                candidate =>
                    candidate.matchCount === 1 &&
                    !candidate.unique,
            );

        const reason:
            UnresolvedElementReason =
            hasIdentityMismatch
                ? 'original-element-mismatch'
                : 'no-unique-locator';

        /*
         * Preserve the existing diagnostic
         * payload and its field ordering.
         */
        const details = {
            generatedName: name,
            tagName: element.tagName,
            type: element.type,
            role: element.role,
            label: element.label,
            text: element.text?.slice(0, 100),
            id: element.id,
            name: element.name,
            testId: element.testId,
            placeholder: element.placeholder,
            ariaLabel: element.ariaLabel,
            classNames: element.classNames,
            context: element.context,
            title: element.title,
            outerHTML: element.outerHTML,
            reason,

            candidates: candidates.map(
                candidate => ({
                    strategy: candidate.strategy,
                    descriptor: candidate.descriptor,
                    unique: candidate.unique,
                    matchCount: candidate.matchCount,
                }),
            ),
        };

        const message =
            'Unable to generate a unique locator.\n' +
            JSON.stringify(
                details,
                null,
                2,
            );

        return {
            name,
            element,
            reason,
            candidates: [...candidates],
            message,
        };
    }
}
