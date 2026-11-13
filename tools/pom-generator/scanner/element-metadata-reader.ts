
import type {
    ElementHandle,
} from '@playwright/test';

export interface RawElementMetadata {
    tagName: string;
    inputType?: string;
    role?: string;
    label?: string;
    text?: string;
    id?: string;
    name?: string;
    testId?: string;
    placeholder?: string;
    ariaLabel?: string;
    context?: string;
    visible: boolean;
}

export class ElementMetadataReader {

    async read(
        element: ElementHandle<HTMLElement | SVGElement>,
    ): Promise<RawElementMetadata> {

        const metadata = await element.evaluate(node => {

            if (!(node instanceof HTMLElement)) {
                throw new Error(
                    `Unsupported element type: ${node.tagName}`,
                );
            }

            /*
             * Normalize DOM attribute values.
             * Remove repeated whitespace and trim.
             */
            const normalize = (
                value: string | null | undefined,
            ): string | undefined => {

                const normalized = value
                    ?.replace(/\s+/g, ' ')
                    .trim();

                return normalized || undefined;
            };

            /*
             * Extract associated label text.
             */
            const getLabel = (
                target: HTMLElement,
            ): string | undefined => {

                if (
                    target instanceof HTMLInputElement ||
                    target instanceof HTMLSelectElement ||
                    target instanceof HTMLTextAreaElement
                ) {
                    const labels = Array.from(
                        target.labels ?? [],
                    )
                        .map(label =>
                            normalize(label.textContent),
                        )
                        .filter(
                            (value): value is string =>
                                Boolean(value),
                        );

                    if (labels.length > 0) {
                        return labels.join(' ');
                    }
                }

                /*
                 * Support elements wrapped in a label.
                 */
                const parentLabel =
                    target.closest('label');

                if (parentLabel) {
                    return normalize(
                        parentLabel.textContent,
                    );
                }

                return undefined;
            };

            /*
             * Extract semantic container context.
             */
            const getContext = (
                target: HTMLElement,
            ): string | undefined => {

                const container = target.closest(
                    'fieldset, section, form, article',
                );

                if (!container) {
                    return undefined;
                }

                const heading = container.querySelector(
                    'legend, h1, h2, h3, h4, h5, h6',
                );

                return normalize(
                    heading?.textContent,
                );
            };

            /*
             * Determine element visibility.
             */
            const style =
                window.getComputedStyle(node);

            const rect =
                node.getBoundingClientRect();

            const visible =
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                Number(style.opacity) !== 0 &&
                rect.width > 0 &&
                rect.height > 0;

            /*
             * Return raw DOM metadata.
             * Locator generation remains the
             * responsibility of LocatorBuilder.
             */
            return {
                tagName:
                    node.tagName.toLowerCase(),

                inputType:
                    node instanceof HTMLInputElement
                        ? normalize(node.type)
                        : undefined,

                role:
                    normalize(
                        node.getAttribute('role'),
                    ),

                label:
                    getLabel(node),

                text:
                    normalize(node.textContent),

                id:
                    normalize(node.id),

                name:
                    normalize(
                        node.getAttribute('name'),
                    ),

                testId:
                    normalize(
                        node.getAttribute('data-testid'),
                    ),

                placeholder:
                    normalize(
                        node.getAttribute('placeholder'),
                    ),

                ariaLabel:
                    normalize(
                        node.getAttribute('aria-label'),
                    ),

                context:
                    getContext(node),

                visible,
            };
        });

        return metadata;
    }
}
