
import type {
    CapturedElement,
} from '../models/captured-element.model';

import type {
    LocatorCandidate,
} from '../models/locator.model';

export class LocatorBuilder {

    build(
        element: CapturedElement,
    ): LocatorCandidate[] {
        const candidates: LocatorCandidate[] = [];

        this.addRoleCandidate(
            candidates,
            element,
        );

        this.addLabelCandidate(
            candidates,
            element,
        );

        this.addTestIdCandidate(
            candidates,
            element,
        );

        this.addPlaceholderCandidate(
            candidates,
            element,
        );

        this.addIdCandidate(
            candidates,
            element,
        );

        this.addNameCandidate(
            candidates,
            element,
        );

        /*
         * CSS class locators are fallback candidates.
         *
         * They are generated after semantic and
         * attribute-based candidates.
         *
         * LocatorValidator remains responsible
         * for checking uniqueness.
         */
        this.addCssClassCandidates(
            candidates,
            element,
        );

        return this.removeDuplicates(
            candidates,
        );
    }

    private addRoleCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {

        /*
         * Preserve explicitly declared roles.
         *
         * Native HTML buttons have an implicit
         * button role.
         *
         * Native HTML anchors have an implicit
         * link role only when href is present.
         */
        const role =
            element.role ??
            (
                element.tagName === 'button'
                    ? 'button'
                    : element.tagName === 'a' &&
                        element.hasHref === true
                        ? 'link'
                        : undefined
            );

        if (!role) {
            return;
        }

        const accessibleName =
            element.ariaLabel ||
            element.label ||
            element.text;

        if (!accessibleName) {
            return;
        }

        candidates.push({
            strategy: 'role',
            value: accessibleName,
            descriptor:
                `role=${role}[name="${accessibleName}"]`,
            unique: false,
        });
    }

    private addLabelCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {
        if (!element.label) {
            return;
        }

        candidates.push({
            strategy: 'label',
            value: element.label,
            descriptor:
                `label=${element.label}`,
            unique: false,
        });
    }

    private addTestIdCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {
        if (!element.testId) {
            return;
        }

        candidates.push({
            strategy: 'testid',
            value: element.testId,
            descriptor:
                `testid=${element.testId}`,
            unique: false,
        });
    }

    private addPlaceholderCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {
        if (!element.placeholder) {
            return;
        }

        candidates.push({
            strategy: 'placeholder',
            value: element.placeholder,
            descriptor:
                `placeholder=${element.placeholder}`,
            unique: false,
        });
    }

    private addIdCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {
        if (!element.id) {
            return;
        }

        candidates.push({
            strategy: 'id',
            value: element.id,
            descriptor:
                `css=#${this.escapeCssIdentifier(element.id)}`,
            unique: false,
        });
    }

    private addNameCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {
        if (!element.name) {
            return;
        }

        candidates.push({
            strategy: 'name',
            value: element.name,
            descriptor:
                `css=[name="${this.escapeAttribute(
                    element.name,
                )}"]`,
            unique: false,
        });
    }

    private addCssClassCandidates(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {

        const tagName =
            element.tagName.toLowerCase();

        /*
         * Only use valid HTML tag names.
         *
         * Class names are escaped separately
         * using CSS identifier escaping.
         */
        if (
            !/^[a-z][a-z0-9-]*$/.test(tagName)
        ) {
            return;
        }

        const classNames = Array.from(
            new Set(
                element.classNames ?? [],
            ),
        ).filter(className =>
            className.trim().length > 0,
        );

        if (classNames.length === 0) {
            return;
        }

        /*
         * Generate a tag-qualified candidate
         * for each individual class.
         *
         * For example:
         * button.btn-back-link
         *
         * The validator will reject candidates
         * matching zero or multiple elements.
         */
        for (const className of classNames) {
            const selector =
                `${tagName}.${this.escapeCssIdentifier(
                    className,
                )}`;

            candidates.push({
                strategy: 'css',
                value: selector,
                descriptor: `css=${selector}`,
                unique: false,
            });
        }

        /*
         * Generate a combined class candidate.
         *
         * For example:
         * button.btn.btn-back-link
         *
         * This provides a more specific fallback
         * when individual classes are not unique.
         */
        if (classNames.length > 1) {
            const selector =
                tagName +
                classNames
                    .map(className =>
                        `.${this.escapeCssIdentifier(
                            className,
                        )}`,
                    )
                    .join('');

            candidates.push({
                strategy: 'css',
                value: selector,
                descriptor: `css=${selector}`,
                unique: false,
            });
        }
    }

    private removeDuplicates(
        candidates: LocatorCandidate[],
    ): LocatorCandidate[] {
        const seen = new Set<string>();

        return candidates.filter(candidate => {
            if (seen.has(candidate.descriptor)) {
                return false;
            }

            seen.add(candidate.descriptor);

            return true;
        });
    }

    private escapeAttribute(
        value: string,
    ): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
    }

    private escapeCssIdentifier(
        value: string,
    ): string {
        return value.replace(
            /([^a-zA-Z0-9_-])/g,
            '\\$1',
        );
    }
}
