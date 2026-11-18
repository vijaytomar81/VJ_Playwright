
import {
    test,
    expect,
} from '@playwright/test';

import {
    ActionMethodMerger,
} from '../../../tools/pom-generator/writers/action-method-merger';


test.describe(
    'ActionMethodMerger',
    () => {

        const merger =
            new ActionMethodMerger();


        const wrapActions = (
            methods: string,
        ): string => `
export class TestActions {
    constructor(
        private readonly page: any,
    ) {}

    ${methods}
}
`;


        test(
            'preserves engineer-renamed action methods',
            () => {

                const existing = wrapActions(`
                    async navigateBack() {
                        await this.page.backButton.click();
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);


                const result =
                    merger.merge(
                        existing,
                        generated,
                    );


                expect(result).toContain(
                    'async navigateBack()',
                );

                expect(result).not.toContain(
                    'async clickBackButton()',
                );
            },
        );


        test(
            'preserves engineer-edited method bodies',
            () => {

                const existing = wrapActions(`
                    async navigateBack() {
                        console.log('Engineer customization');
                        await this.page.backButton.click();
                        await this.page.waitForLoadState();
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);


                const result =
                    merger.merge(
                        existing,
                        generated,
                    );


                expect(result).toContain(
                    "console.log('Engineer customization')",
                );

                expect(result).toContain(
                    'await this.page.waitForLoadState()',
                );

                expect(result).toContain(
                    'async navigateBack()',
                );
            },
        );


        test(
            'adds genuinely new generated actions',
            () => {

                const existing = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async clickSubmitButton() {
                        await this.page.submitButton.click();
                    }
                `);


                const result =
                    merger.merge(
                        existing,
                        generated,
                    );


                expect(result).toContain(
                    'async clickBackButton()',
                );

                expect(result).toContain(
                    'async clickSubmitButton()',
                );
            },
        );


        test(
            'retains existing actions absent from latest scan',
            () => {

                const existing = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async clickOldButton() {
                        await this.page.oldButton.click();
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);


                const result =
                    merger.merge(
                        existing,
                        generated,
                    );


                expect(result).toContain(
                    'async clickOldButton()',
                );

                expect(result).toContain(
                    'async clickBackButton()',
                );
            },
        );


        test(
            'retains custom methods without recognized action identity',
            () => {

                const existing = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async customHelper() {
                        console.log('Custom helper');
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);


                const result =
                    merger.merge(
                        existing,
                        generated,
                    );


                expect(result).toContain(
                    'async customHelper()',
                );

                expect(result).toContain(
                    "console.log('Custom helper')",
                );
            },
        );


        test(
            'rejects duplicate action method names',
            () => {

                const existing = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async clickBackButton() {
                        await this.page.submitButton.click();
                    }
                `);


                expect(
                    () => merger.merge(
                        existing,
                        generated,
                    ),
                ).toThrow();
            },
        );


        test(
            'rejects ambiguous existing action identities',
            () => {

                const existing = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async navigateBack() {
                        await this.page.backButton.click();
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }
                `);


                expect(
                    () => merger.merge(
                        existing,
                        generated,
                    ),
                ).toThrow(
                    'Ambiguous existing action',
                );
            },
        );


        test(
            'rejects collisions with retained custom methods',
            () => {

                const existing = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async clickSubmitButton() {
                        console.log('Custom implementation');
                    }
                `);

                const generated = wrapActions(`
                    async clickBackButton() {
                        await this.page.backButton.click();
                    }

                    async clickSubmitButton() {
                        await this.page.submitButton.click();
                    }
                `);


                expect(
                    () => merger.merge(
                        existing,
                        generated,
                    ),
                ).toThrow(
                    'Action method collision',
                );
            },
        );
    },
);
