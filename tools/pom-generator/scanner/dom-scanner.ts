import type {
    ElementHandle,
    Page,
} from '@playwright/test';

import type {
    CapturedElement,
} from '../models/captured-element.model';

import {
    PomGeneratorConfig,
} from '../config/pom-generator.config';

import {
    ElementMetadataReader,
} from './element-metadata-reader';

import {
    ElementTypeResolver,
} from './element-type-resolver';

export class DomScanner {

    constructor(
        private readonly page: Page,

        private readonly metadataReader =
            new ElementMetadataReader(),

        private readonly typeResolver =
            new ElementTypeResolver(),
    ) { }


    async scan():
        Promise<CapturedElement[]> {

        const handles =
            await this.page.$$(
                [
                    'input',
                    'button',
                    'select',
                    'textarea',
                    'a',
                    '[role="button"]',
                    '[role="link"]',
                    '[role="checkbox"]',
                    '[role="radio"]',
                    '[role="combobox"]',
                ].join(','),
            );

        const capturedElements:
            CapturedElement[] = [];

        try {
            for (const handle of handles) {
                const captured =
                    await this.captureElement(
                        handle,
                    );

                if (captured) {
                    capturedElements.push(
                        captured,
                    );
                }
            }
        } finally {
            await Promise.all(
                handles.map(handle =>
                    handle.dispose(),
                ),
            );
        }

        return capturedElements;
    }


    private async captureElement(
        handle: ElementHandle<HTMLElement | SVGElement>,
    ): Promise<CapturedElement | undefined> {

        const metadata =
            await this.metadataReader.read(
                handle,
            );

        const type =
            this.typeResolver.resolve({
                tagName:
                    metadata.tagName,

                inputType:
                    metadata.inputType,

                role:
                    metadata.role,
            });

        if (!type) {
            return undefined;
        }

        const configuredElementTypes:
            readonly string[] =
            PomGeneratorConfig.capture
                .elementTypes;

        if (
            !configuredElementTypes.includes(type)
        ) {
            return undefined;
        }

        if (
            !PomGeneratorConfig.capture
                .includeHiddenElements &&
            !metadata.visible
        ) {
            return undefined;
        }

        return {
            tagName:
                metadata.tagName,

            type,

            role:
                metadata.role,

            label:
                metadata.label,

            text:
                metadata.text,

            id:
                metadata.id,

            name:
                metadata.name,

            testId:
                metadata.testId,

            placeholder:
                metadata.placeholder,

            ariaLabel:
                metadata.ariaLabel,

            visible:
                metadata.visible,

            context:
                metadata.context,

            /*
             * Locator candidates are deliberately empty.
             *
             * Scanner discovers DOM information.
             * LocatorBuilder owns locator generation.
             */
            locatorCandidates: [],
        };
    }
}