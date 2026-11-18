
import {
    test,
    expect,
} from '@playwright/test';

import {
    CdpBrowserConnector,
} from '../../../tools/pom-generator/browser/cdp-browser-connector';

import {
    GeneratedPageAssembler,
} from '../../../tools/pom-generator/generators/generated-page-assembler';

test.describe(
    'POM generator — live Edge CDP validation',
    () => {

        test(
            'generates distinct, identity-safe Back button locators',
            async () => {

                const cdpEndpoint =
                    process.env.POM_CDP_ENDPOINT;

                if (!cdpEndpoint) {
                    throw new Error(
                        'POM_CDP_ENDPOINT is required. ' +
                        'Start Edge with remote debugging enabled.',
                    );
                }

                const connector =
                    new CdpBrowserConnector();

                const connection =
                    await connector.connect(
                        cdpEndpoint,
                    );

                try {

                    const page =
                        connection.page;

                    const topBackButton =
                        page.locator(
                            'div.back-link-top > button.btn-back-link',
                        );

                    const dashboardBackButton =
                        page.locator(
                            'a[href="/dashboard"] > button.btn-back-link',
                        );

                    expect(
                        await topBackButton.count(),
                    ).toBe(1);

                    expect(
                        await dashboardBackButton.count(),
                    ).toBe(1);

                    const topHandle =
                        await topBackButton.elementHandle();

                    const dashboardHandle =
                        await dashboardBackButton.elementHandle();

                    expect(topHandle).not.toBeNull();
                    expect(dashboardHandle).not.toBeNull();

                    try {

                        const assembler =
                            new GeneratedPageAssembler(
                                page,
                            );

                        const generatedPage =
                            await assembler.assemble(
                                {
                                    brand: 'AZO',
                                    channel: 'CTM',
                                    product: 'Motor',
                                    pageName: 'Policyholder Details',
                                },
                            );

                        const generatedBackButtons =
                            generatedPage.elements.filter(
                                element =>
                                    element.type === 'button' &&
                                    (
                                        element.fingerprint.text
                                            ?.toLowerCase()
                                            .trim() === 'back'
                                    ),
                            );

                        expect(
                            generatedBackButtons.length,
                        ).toBeGreaterThanOrEqual(2);

                        const topMatches:
                            typeof generatedBackButtons =
                            [];

                        const dashboardMatches:
                            typeof generatedBackButtons =
                            [];

                        for (
                            const element
                            of generatedBackButtons
                        ) {

                            const selector =
                                element.locator.preferred;

                            expect(
                                selector,
                            ).not.toMatch(
                                /:nth-(?:child|of-type)\(|\.nth\(|\.first\(|\.last\(/,
                            );

                            const locator =
                                page.locator(
                                    selector,
                                );

                            expect(
                                await locator.count(),
                            ).toBe(1);

                            const generatedHandle =
                                await locator.elementHandle();

                            expect(
                                generatedHandle,
                            ).not.toBeNull();

                            if (!generatedHandle) {
                                continue;
                            }

                            try {

                                if (
                                    topHandle &&
                                    await generatedHandle.evaluate(
                                        (
                                            node,
                                            original,
                                        ) =>
                                            node === original,
                                        topHandle,
                                    )
                                ) {
                                    topMatches.push(
                                        element,
                                    );
                                }

                                if (
                                    dashboardHandle &&
                                    await generatedHandle.evaluate(
                                        (
                                            node,
                                            original,
                                        ) =>
                                            node === original,
                                        dashboardHandle,
                                    )
                                ) {
                                    dashboardMatches.push(
                                        element,
                                    );
                                }

                            } finally {

                                await generatedHandle.dispose();
                            }
                        }

                        expect(
                            topMatches,
                            'Top Back button must have one generated locator.',
                        ).toHaveLength(1);

                        expect(
                            dashboardMatches,
                            'Dashboard Back button must have one generated locator.',
                        ).toHaveLength(1);

                        expect(
                            topMatches[0].locator.preferred,
                        ).not.toBe(
                            dashboardMatches[0].locator.preferred,
                        );

                        console.log(
                            'Top Back:',
                            topMatches[0].locator.preferred,
                        );

                        console.log(
                            'Dashboard Back:',
                            dashboardMatches[0].locator.preferred,
                        );

                        console.log(
                            'Resolved elements:',
                            generatedPage.elements.length,
                        );

                        console.log(
                            'Unresolved elements:',
                            generatedPage.unresolvedElements?.length ?? 0,
                        );

                    } finally {

                        await topHandle?.dispose();

                        await dashboardHandle?.dispose();
                    }

                } finally {

                    await connection.disconnect();
                }
            },
        );
    },
);
