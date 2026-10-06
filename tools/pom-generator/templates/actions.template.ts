import type {
    GeneratedPage,
} from '../models/page.model';

import {
    PageNameGenerator,
} from '../naming/page-name-generator';


export class ActionsTemplate {

    constructor(
        private readonly pageNameGenerator =
            new PageNameGenerator(),
    ) { }


    render(
        page: GeneratedPage,
    ): string {

        const pageName =
            this.pageNameGenerator.generate(
                page.pageName,
            );


        return [
            `import {`,
            `    ${pageName.className}Page,`,
            `} from '../pages/${pageName.fileName}/${pageName.fileName}.page';`,
            '',
            `export class ${pageName.className}Actions {`,
            '',
            '    constructor(',
            `        private readonly page: ${pageName.className}Page,`,
            '    ) { }',
            '',
            '}',
            '',
        ].join('\n');
    }
}