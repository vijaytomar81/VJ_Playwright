import path from 'node:path';

import type {
    GeneratedPage,
} from '../models/page.model';

import {
    PomGeneratorConfig,
} from '../config/pom-generator.config';


export interface PomOutputPaths {
    pageDirectory: string;

    actionsDirectory: string;

    elementsFile: string;

    pageFile: string;

    actionsFile: string;
}


export class OutputPathBuilder {

    constructor(
        private readonly automationRoot:
            string =
            PomGeneratorConfig.output
                .automationRoot,
    ) { }


    build(
        page: GeneratedPage,
    ): PomOutputPaths {

        const productRoot =
            path.join(
                this.automationRoot,
                page.brand,
                page.channel,
                page.product,
            );


        const pageDirectory =
            path.join(
                productRoot,
                'pages',
                page.pageKey,
            );


        const actionsDirectory =
            path.join(
                productRoot,
                'actions',
            );


        return {
            pageDirectory,

            actionsDirectory,

            elementsFile:
                path.join(
                    pageDirectory,
                    'elements.ts',
                ),

            pageFile:
                path.join(
                    pageDirectory,
                    `${page.pageKey}.page.ts`,
                ),

            actionsFile:
                path.join(
                    actionsDirectory,
                    `${page.pageKey}.actions.ts`,
                ),
        };
    }
}