
import {
    readFile,
} from 'node:fs/promises';

import type {
    GeneratedPage,
} from '../models/page.model';

import {
    ElementsTemplate,
} from '../templates/elements.template';

import {
    PageTemplate,
} from '../templates/page.template';

import {
    ActionsTemplate,
} from '../templates/actions.template';

import {
    OutputPathBuilder,
} from './output-path-builder';

import {
    FileWriter,
} from './file-writer';


export interface PomWriteResult {
    elementsFile: string;

    pageFile: string;

    actionsFile: string;

    actionsCreated: boolean;
}


export class PomOutputWriter {

    constructor(
        private readonly pathBuilder =
            new OutputPathBuilder(),

        private readonly fileWriter =
            new FileWriter(),

        private readonly elementsTemplate =
            new ElementsTemplate(),

        private readonly pageTemplate =
            new PageTemplate(),

        private readonly actionsTemplate =
            new ActionsTemplate(),
    ) { }


    async write(
        page: GeneratedPage,
    ): Promise<PomWriteResult> {

        const paths =
            this.pathBuilder.build(
                page,
            );


        const elementsSource =
            this.elementsTemplate.render(
                page,
            );

        const pageSource =
            this.pageTemplate.render(
                page,
            );

        const actionsSource =
            this.actionsTemplate.render(
                page,
            );


        await this.fileWriter.write(
            paths.elementsFile,
            elementsSource,
        );

        await this.fileWriter.write(
            paths.pageFile,
            pageSource,
        );


        const actionsCreated =
            await this.writeActions(
                paths.actionsFile,
                actionsSource,
            );


        return {
            elementsFile:
                paths.elementsFile,

            pageFile:
                paths.pageFile,

            actionsFile:
                paths.actionsFile,

            actionsCreated,
        };
    }


    private async writeActions(
        filePath: string,
        content: string,
    ): Promise<boolean> {

        const created =
            await this.fileWriter.writeIfMissing(
                filePath,
                content,
            );

        if (created) {
            return true;
        }

        const existingContent =
            await readFile(
                filePath,
                'utf8',
            );

        if (
            !existingContent.startsWith(
                '// AUTO-GENERATED ATOMIC ACTIONS',
            )
        ) {
            return false;
        }

        await this.fileWriter.write(
            filePath,
            content,
        );

        return false;
    }
}
