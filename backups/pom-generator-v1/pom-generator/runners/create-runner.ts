import type {
    Page,
} from '@playwright/test';

import type {
    GeneratePageInput,
} from '../generators/generated-page-assembler';

import {
    GeneratedPageAssembler,
} from '../generators/generated-page-assembler';

import type {
    CreateResult,
} from '../modes/create-mode';

import {
    CreateMode,
} from '../modes/create-mode';


export class CreateRunner {

    constructor(
        private readonly createMode =
            new CreateMode(),
    ) { }


    async run(
        page: Page,
        input: GeneratePageInput,
    ): Promise<CreateResult> {

        const generatedPageAssembler =
            new GeneratedPageAssembler(
                page,
            );


        const generatedPage =
            await generatedPageAssembler
                .assemble(
                    input,
                );


        return this.createMode.execute(
            generatedPage,
        );
    }
}