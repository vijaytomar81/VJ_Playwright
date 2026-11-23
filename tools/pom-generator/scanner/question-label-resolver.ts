
/**
 * Resolves the question or field label associated with a DOM control.
 *
 * This is naming metadata only. It must not be treated as the
 * control's accessible name or used to construct unvalidated locators.
 */

export interface QuestionLabelResult {
    label: string;
    source:
    | 'group'
    | 'fieldset'
    | 'preceding-label'
    | 'container-label';
}

const CONTROL_SELECTOR = [
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="radio"]',
    '[role="checkbox"]',
    '[role="combobox"]',
].join(', ');

const GROUP_SELECTOR = [
    'fieldset',
    '[role="group"]',
    '[role="radiogroup"]',
].join(', ');

const FIELD_SELECTOR = [
    '.form-group',
    '.input-group',
    '.addressLookup',
    '[class*="field"]',
    '[class*="control"]',
].join(', ');

function clean(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

function directChildText(
    element: Element,
    selector: string,
): string | undefined {
    for (const child of Array.from(element.children)) {
        if (!child.matches(selector)) continue;

        const value = clean(child.textContent);
        if (value) return value;
    }

    return undefined;
}

function referencedText(element: Element): string | undefined {
    const ids = clean(element.getAttribute('aria-labelledby'))
        .split(/\s+/)
        .filter(Boolean);

    if (!ids.length) return undefined;

    const values = ids.map((id) => {
        const referenced = element.ownerDocument.getElementById(id);
        return referenced ? clean(referenced.textContent) : '';
    });

    return values.every(Boolean)
        ? values.join(' ')
        : undefined;
}

function groupQuestion(
    element: Element,
): QuestionLabelResult | undefined {
    let current = element.parentElement;

    while (current) {
        if (current.matches(GROUP_SELECTOR)) {
            const label =
                referencedText(current) ||
                clean(current.getAttribute('aria-label')) ||
                (
                    current.matches('fieldset')
                        ? directChildText(current, 'legend')
                        : undefined
                );

            if (label) {
                return {
                    label,
                    source: current.matches('fieldset')
                        ? 'fieldset'
                        : 'group',
                };
            }
        }

        current = current.parentElement;
    }

    return undefined;
}

function isQuestionLabel(element: Element): boolean {
    return element.matches('label:not([for])');
}

function precedingLabel(
    element: Element,
): QuestionLabelResult | undefined {
    let current: Element | null = element;

    while (current?.parentElement) {
        const previous = current.previousElementSibling;

        if (previous && isQuestionLabel(previous)) {
            const label = clean(previous.textContent);

            if (label) {
                const controls = current.querySelectorAll(
                    CONTROL_SELECTOR,
                );

                const isSingleControl =
                    controls.length === 1 &&
                    controls[0] === element;

                if (isSingleControl) {
                    return {
                        label,
                        source: 'preceding-label',
                    };
                }
            }
        }

        const parent: Element = current.parentElement;

        // Do not search across unrelated form fields.
        if (
            parent.matches(
                'form, fieldset, section, ' +
                '[role="group"], [role="radiogroup"]',
            )
        ) {
            break;
        }

        current = parent;
    }

    return undefined;
}

function containerLabel(
    element: Element,
): QuestionLabelResult | undefined {
    let current = element.parentElement;

    while (current) {
        if (current.matches(FIELD_SELECTOR)) {
            const label = directChildText(
                current,
                'label:not([for])',
            );

            if (label) {
                const controls = Array.from(
                    current.querySelectorAll(CONTROL_SELECTOR),
                );

                if (
                    controls.length === 1 &&
                    controls[0] === element
                ) {
                    return {
                        label,
                        source: 'container-label',
                    };
                }
            }
        }

        if (
            current.matches(
                'form, fieldset, section, ' +
                '[role="group"], [role="radiogroup"]',
            )
        ) {
            break;
        }

        current = current.parentElement;
    }

    return undefined;
}

/**
 * Resolve a question label without modifying the DOM.
 *
 * A missing result means no sufficiently reliable association
 * was found; callers should retain their existing fallback.
 */
export function resolveQuestionLabel(
    element: Element,
): QuestionLabelResult | undefined {
    return (
        groupQuestion(element) ||
        precedingLabel(element) ||
        containerLabel(element)
    );
}
