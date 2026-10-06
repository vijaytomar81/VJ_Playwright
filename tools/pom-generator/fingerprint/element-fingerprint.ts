import type {
    CapturedElement,
    ElementType,
} from '../models/captured-element.model';

export interface ElementFingerprint {
    type: ElementType;

    role?: string;

    label?: string;

    ariaLabel?: string;

    name?: string;

    testId?: string;

    placeholder?: string;

    text?: string;

    context?: string;
}

export class ElementFingerprintBuilder {

    build(
        element: CapturedElement,
    ): ElementFingerprint {
        return {
            type: element.type,

            role:
                this.normalize(element.role),

            label:
                this.normalize(element.label),

            ariaLabel:
                this.normalize(element.ariaLabel),

            name:
                this.normalize(element.name),

            testId:
                this.normalize(element.testId),

            placeholder:
                this.normalize(element.placeholder),

            text:
                this.normalize(element.text),

            context:
                this.normalize(element.context),
        };
    }

    private normalize(
        value?: string,
    ): string | undefined {
        if (!value) {
            return undefined;
        }

        const normalized =
            value
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ');

        return normalized || undefined;
    }
}