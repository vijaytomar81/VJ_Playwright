
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

export interface ScannedElementWithHandle {
    element: CapturedElement;

    /**
     * Original DOM element reference.
     *
     * Used only during locator validation.
     * Must not be persisted in generated metadata.
     */
    handle: ElementHandle<
        HTMLElement | SVGElement
    >;
}

export class DomScanner {

    constructor(
        private readonly page: Page,

        private readonly metadataReader =
            new ElementMetadataReader(),

        private readonly typeResolver =
            new ElementTypeResolver(),
    ) { }


    /**
     * Backward-compatible scanning method.
     *
     * Returns captured metadata and disposes
     * all temporary DOM element handles.
     */
    async scan():
        Promise<CapturedElement[]> {

        const scanned =
            await this.scanWithHandles();

        try {
            return scanned.map(
                item => item.element,
            );
        } finally {
            await this.disposeHandles(
                scanned,
            );
        }
    }


    /**
     * Scan elements while retaining their
     * original DOM references.
     *
     * The caller MUST dispose these handles
     * after locator validation completes.
     */
    async scanWithHandles():
        Promise<ScannedElementWithHandle[]> {

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

        const scanned:
            ScannedElementWithHandle[] = [];

        const retainedHandles =
            new Set<
                ElementHandle<
                    HTMLElement | SVGElement
                >
            >();

        try {
            for (const handle of handles) {
                const captured =
                    await this.captureElement(
                        handle,
                    );

                if (captured) {
                    scanned.push({
                        element: captured,
                        handle,
                    });

                    retainedHandles.add(
                        handle,
                    );
                }
            }

            return scanned;
        } catch (error) {

            /*
             * If scanning fails, release every
             * handle before propagating the error.
             */
            await Promise.all(
                handles.map(handle =>
                    handle.dispose(),
                ),
            );

            throw error;
        } finally {

            /*
             * Dispose unsupported or filtered
             * elements immediately.
             *
             * Supported element handles remain
             * alive for locator validation.
             */
            await Promise.all(
                handles
                    .filter(handle =>
                        !retainedHandles.has(handle),
                    )
                    .map(handle =>
                        handle.dispose(),
                    ),
            );
        }
    }


    /**
     * Release retained DOM references after
     * locator validation completes.
     */
    async disposeHandles(
        scanned:
            readonly ScannedElementWithHandle[],
    ): Promise<void> {

        await Promise.all(
            scanned.map(item =>
                item.handle.dispose(),
            ),
        );
    }


    private async captureElement(
        handle: ElementHandle<
            HTMLElement | SVGElement
        >,
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

            /*
             * CSS classes captured from the DOM.
             */
            classNames:
                metadata.classNames,

            /*
             * Native anchor href information.
             */
            hasHref:
                metadata.hasHref,

            visible:
                metadata.visible,

            context:
                metadata.context,

            /*
             * Diagnostic metadata only.
             */
            title:
                metadata.title,

            outerHTML:
                metadata.outerHTML,

            /*
             * Locator generation belongs
             * exclusively to LocatorBuilder.
             */
            locatorCandidates: [],
        };
    }
}
