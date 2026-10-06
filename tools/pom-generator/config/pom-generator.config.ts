import type {
    ElementType,
} from '../models/captured-element.model';

import type {
    LocatorStrategy,
} from '../models/locator.model';

export const PomGeneratorConfig = {

    locatorPriority: [
        'role',
        'label',
        'testid',
        'placeholder',
        'id',
        'name',
        'css',
    ] as const satisfies readonly LocatorStrategy[],

    capture: {
        elementTypes: [
            'input',
            'button',
            'select',
            'textarea',
            'checkbox',
            'radio',
            'link',
        ] as const satisfies readonly ElementType[],

        includeHiddenElements: false,
    },

    regeneration: {

        /**
         * New elements must be reviewed.
         */
        autoAddNew: false,

        /**
         * Changed locators must be reviewed.
         */
        autoUpdateChanged: false,

        /**
         * Missing elements are NEVER automatically deleted.
         */
        autoDeleteMissing: false,

        /**
         * Action files become developer-owned after creation.
         */
        protectActionFiles: true,
    },

    output: {
        automationRoot: 'automationLayer',
        metadataRoot: '.pom-generator/metadata',
    },

} as const;