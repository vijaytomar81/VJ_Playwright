import {
    StringUtils,
} from '../../../utils/string/string.utils';

export interface GeneratedPageName {
    displayName: string;
    fileName: string;
    className: string;
}

export class PageNameGenerator {

    generate(
        pageName: string,
    ): GeneratedPageName {
        const trimmedPageName =
            pageName.trim();

        if (!trimmedPageName) {
            throw new Error(
                'Page name cannot be empty.',
            );
        }

        return {
            displayName: trimmedPageName,

            fileName:
                StringUtils.toKebabCase(
                    trimmedPageName,
                ),

            className:
                StringUtils.toPascalCase(
                    trimmedPageName,
                ),
        };
    }
}