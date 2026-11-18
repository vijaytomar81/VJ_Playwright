import path from 'node:path';

import type {
    GeneratedPage,
} from '../models/page.model';

import {
    PomGeneratorConfig,
} from '../config/pom-generator.config';


export class MetadataPathBuilder {

    constructor(
        private readonly metadataRoot:
            string =
            PomGeneratorConfig.output
                .metadataRoot,
    ) { }


    build(
        page: GeneratedPage,
    ): string {

        return path.join(
            this.metadataRoot,
            page.brand,
            page.channel,
            page.product,
            `${page.pageKey}.json`,
        );
    }
}