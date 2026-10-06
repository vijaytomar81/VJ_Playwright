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

        return this.removeDuplicates(
            candidates,
        );
    }

    private addRoleCandidate(
        candidates: LocatorCandidate[],
        element: CapturedElement,
    ): void {
        if (!element.role) {
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
                `role=${element.role}[name="${accessibleName}"]`,
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