import path from 'node:path';

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

import {
    ActionMethodMerger,
} from './action-method-merger';


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

        private readonly actionMerger =
            new ActionMethodMerger(),
    ) { }


    async write(
        page: GeneratedPage,
    ): Promise<PomWriteResult> {

        const paths =
            this.pathBuilder.build(page);

        const elementsSource =
            this.elementsTemplate.render(page);

        const pageSource =
            this.pageTemplate.render(
                page,
                this.buildResolverImportPath(
                    paths.pageFile,
                ),
            );

        const generatedActions =
            this.actionsTemplate.render(page);

        const existingActions =
            await this.readExistingActions(
                paths.actionsFile,
            );

        const isGeneratorOwned =
            existingActions?.startsWith(
                '// AUTO-GENERATED ATOMIC ACTIONS',
            ) ?? false;

        const actionsSource =
            isGeneratorOwned
                ? this.actionMerger.merge(
                    existingActions!,
                    generatedActions,
                )
                : generatedActions;

        // Prepare the merged source before writing files.
        await this.fileWriter.write(
            paths.elementsFile,
            elementsSource,
        );

        await this.fileWriter.write(
            paths.pageFile,
            pageSource,
        );

        let actionsCreated = false;

        if (existingActions === undefined) {
            actionsCreated =
                await this.fileWriter.writeIfMissing(
                    paths.actionsFile,
                    actionsSource,
                );
        } else if (isGeneratorOwned) {
            await this.fileWriter.write(
                paths.actionsFile,
                actionsSource,
            );
        }

        // Developer-owned actions files are not modified.
        return {
            elementsFile: paths.elementsFile,
            pageFile: paths.pageFile,
            actionsFile: paths.actionsFile,
            actionsCreated,
        };
    }


    private async readExistingActions(
        filePath: string,
    ): Promise<string | undefined> {

        try {
            return await readFile(
                filePath,
                'utf8',
            );
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                return undefined;
            }

            throw error;
        }
    }


    private buildResolverImportPath(
        pageFile: string,
    ): string {

        const resolverFile =
            path.resolve(
                process.cwd(),
                'tools',
                'pom-generator',
                'runtime',
                'locator-resolver.ts',
            );

        const pageDirectory =
            path.dirname(
                path.resolve(pageFile),
            );

        let relativePath =
            path.relative(
                pageDirectory,
                resolverFile,
            );

        relativePath =
            relativePath
                .replace(/\.ts$/, '')
                .split(path.sep)
                .join('/');

        if (!relativePath.startsWith('.')) {
            relativePath =
                `./${relativePath}`;
        }

        return relativePath;
    }
}
