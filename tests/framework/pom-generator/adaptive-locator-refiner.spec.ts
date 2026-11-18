
import {
    test,
    expect,
} from '@playwright/test';

import {
    AdaptiveLocatorRefiner,
} from '../../../tools/pom-generator/locator/adaptive-locator-refiner';

import {
    LocatorValidator,
} from '../../../tools/pom-generator/locator/locator-validator';

import {
    LocatorBuilder,
} from '../../../tools/pom-generator/locator/locator-builder';

import type {
    CapturedElement,
} from '../../../tools/pom-generator/models/captured-element.model';

import type {
    LocatorCandidate,
} from '../../../tools/pom-generator/models/locator.model';


const createCapturedElement = (
    overrides: Partial<CapturedElement> = {},
): CapturedElement => ({
    tagName: 'button',
    type: 'button',
    text: 'Back',
    classNames: [
        'btn',
        'btn-back-link',
    ],
    visible: true,
    locatorCandidates: [],
    ...overrides,
});


test.describe(
    'AdaptiveLocatorRefiner',
    () => {

        test(
            'resolves two Back buttons using different parents',
            async ({ page }) => {

                await page.setContent(`
                    <div class="back-link-top">
                        <button
                            type="button"
                            class="btn btn-back-link"
                        >
                            Back
                        </button>
                    </div>

                    <a href="/dashboard">
                        <button
                            type="button"
                            role="link"
                            class="btn btn-back-link"
                        >
                            Back
                        </button>
                    </a>
                `);

                const refiner =
                    new AdaptiveLocatorRefiner();

                const validator =
                    new LocatorValidator(page);

                const handles =
                    await page.$$(
                        'button.btn-back-link',
                    );

                expect(handles).toHaveLength(2);

                try {
                    const firstCandidates =
                        await refiner.refine(
                            createCapturedElement(),
                            handles[0],
                        );

                    const secondCandidates =
                        await refiner.refine(
                            createCapturedElement({
                                role: 'link',
                            }),
                            handles[1],
                        );

                    const firstValidated =
                        await validator.validate(
                            firstCandidates,
                            handles[0],
                        );

                    const secondValidated =
                        await validator.validate(
                            secondCandidates,
                            handles[1],
                        );

                    expect(
                        firstValidated.some(
                            candidate =>
                                candidate.unique &&
                                candidate.descriptor ===
                                'css=div.back-link-top > button.btn-back-link',
                        ),
                    ).toBe(true);

                    expect(
                        secondValidated.some(
                            candidate =>
                                candidate.unique &&
                                candidate.descriptor ===
                                'css=a[href="/dashboard"] > button.btn-back-link',
                        ),
                    ).toBe(true);
                } finally {
                    await Promise.all(
                        handles.map(
                            handle => handle.dispose(),
                        ),
                    );
                }
            },
        );


        test(
            'uses ancestor context beyond the immediate parent',
            async ({ page }) => {

                await page.setContent(`
                    <section id="primary-section">
                        <div>
                            <div>
                                <button class="action">
                                    Continue
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="secondary-section">
                        <div>
                            <div>
                                <button class="action">
                                    Continue
                                </button>
                            </div>
                        </div>
                    </section>
                `);

                const refiner =
                    new AdaptiveLocatorRefiner();

                const validator =
                    new LocatorValidator(page);

                const handles =
                    await page.$$('button.action');

                expect(handles).toHaveLength(2);

                try {
                    for (const handle of handles) {

                        const candidates =
                            await refiner.refine(
                                createCapturedElement({
                                    text: 'Continue',
                                    classNames: ['action'],
                                }),
                                handle,
                            );

                        const validated =
                            await validator.validate(
                                candidates,
                                handle,
                            );

                        expect(
                            validated.some(
                                candidate =>
                                    candidate.unique,
                            ),
                        ).toBe(true);
                    }
                } finally {
                    await Promise.all(
                        handles.map(
                            handle => handle.dispose(),
                        ),
                    );
                }
            },
        );


        test(
            'rejects a selector pointing to a different DOM element',
            async ({ page }) => {

                await page.setContent(`
                    <div class="first">
                        <button class="action">
                            Back
                        </button>
                    </div>

                    <div class="second">
                        <button class="action">
                            Back
                        </button>
                    </div>
                `);

                const handles =
                    await page.$$('button.action');

                expect(handles).toHaveLength(2);

                const validator =
                    new LocatorValidator(page);

                const wrongCandidate:
                    LocatorCandidate = {
                    strategy: 'css',
                    value:
                        'div.first > button.action',
                    descriptor:
                        'css=div.first > button.action',
                    unique: false,
                };

                try {
                    const validated =
                        await validator.validate(
                            [wrongCandidate],
                            handles[1],
                        );

                    expect(
                        validated[0].matchCount,
                    ).toBe(1);

                    expect(
                        validated[0].unique,
                    ).toBe(false);
                } finally {
                    await Promise.all(
                        handles.map(
                            handle => handle.dispose(),
                        ),
                    );
                }
            },
        );


        test(
            'preserves existing unique locator candidates',
            async ({ page }) => {

                await page.setContent(`
                    <button data-testid="submit-quote">
                        Submit
                    </button>
                `);

                const builder =
                    new LocatorBuilder();

                const validator =
                    new LocatorValidator(page);

                const handle =
                    await page.$(
                        '[data-testid="submit-quote"]',
                    );

                expect(handle).not.toBeNull();

                if (!handle) {
                    throw new Error(
                        'Expected button handle',
                    );
                }

                try {
                    const candidates =
                        builder.build(
                            createCapturedElement({
                                text: 'Submit',
                                testId: 'submit-quote',
                                classNames: [],
                            }),
                        );

                    const validated =
                        await validator.validate(
                            candidates,
                            handle,
                        );

                    expect(
                        validated.some(
                            candidate =>
                                candidate.unique &&
                                candidate.strategy ===
                                'testid',
                        ),
                    ).toBe(true);
                } finally {
                    await handle.dispose();
                }
            },
        );


        test(
            'does not invent positional selectors for identical siblings',
            async ({ page }) => {

                await page.setContent(`
                    <div class="actions">
                        <button class="action">
                            Back
                        </button>
                        <button class="action">
                            Back
                        </button>
                    </div>
                `);

                const handles =
                    await page.$$('button.action');

                expect(handles).toHaveLength(2);

                const refiner =
                    new AdaptiveLocatorRefiner();

                const validator =
                    new LocatorValidator(page);

                try {
                    const candidates =
                        await refiner.refine(
                            createCapturedElement({
                                classNames: ['action'],
                            }),
                            handles[0],
                        );

                    expect(
                        candidates.some(
                            candidate =>
                                /:nth-|:first-|:last-/.test(
                                    candidate.descriptor,
                                ),
                        ),
                    ).toBe(false);

                    const validated =
                        await validator.validate(
                            candidates,
                            handles[0],
                        );

                    expect(
                        validated.some(
                            candidate =>
                                candidate.unique,
                        ),
                    ).toBe(false);
                } finally {
                    await Promise.all(
                        handles.map(
                            handle => handle.dispose(),
                        ),
                    );
                }
            },
        );
    },
);
