
import type {
    Page,
} from '@playwright/test';

import type {
    Brand,
} from '../../../configLayer/brand.config';

import {
    BrandHierarchy,
} from '../../../configLayer/brand.config';

import type {
    Channel,
} from '../../../configLayer/channel.config';

import type {
    Product,
} from '../../../configLayer/product.config';

import type {
    GeneratedPage,
} from '../models/page.model';

import {
    DomScanner,
} from '../scanner/dom-scanner';

import {
    PageNameGenerator,
} from '../naming/page-name-generator';

import {
    GeneratedElementAssembler,
} from './generated-element-assembler';


export interface GeneratePageInput {
    brand: Brand;

    channel: Channel;

    product: Product;

    pageName: string;
}


export class GeneratedPageAssembler {

    private readonly scanner:
        DomScanner;

    private readonly elementAssembler:
        GeneratedElementAssembler;


    constructor(
        page: Page,

        private readonly pageNameGenerator =
            new PageNameGenerator(),
    ) {
        this.scanner =
            new DomScanner(page);

        this.elementAssembler =
            new GeneratedElementAssembler(
                page,
            );
    }


    async assemble(
        input: GeneratePageInput,
    ): Promise<GeneratedPage> {

        this.validateHierarchy(
            input.brand,
            input.channel,
            input.product,
        );


        const pageName =
            this.pageNameGenerator.generate(
                input.pageName,
            );


        /*
         * Capture element metadata together with
         * original DOM element references.
         *
         * The handles remain alive until locator
         * validation has completed.
         */
        const scannedElements =
            await this.scanner.scanWithHandles();


        let elements:
            GeneratedPage['elements'];

        let unresolvedElements:
            NonNullable<
                GeneratedPage['unresolvedElements']
            >;


        try {

            /*
             * Assemble all captured elements.
             *
             * Successfully resolved elements and
             * expected locator failures are returned
             * in separate collections.
             *
             * Every successful locator must:
             *
             * 1. Match exactly one DOM element.
             * 2. Match the original scanned element.
             *
             * Unexpected errors still propagate.
             */
            const result =
                await this.elementAssembler
                    .assembleAllWithHandlesAndDiagnostics(
                        scannedElements,
                    );

            elements =
                result.elements;

            unresolvedElements =
                result.unresolvedElements;

        } finally {

            /*
             * Always release original DOM handles.
             *
             * Cleanup occurs whether element
             * assembly succeeds or fails.
             */
            await this.scanner.disposeHandles(
                scannedElements,
            );
        }


        return {
            brand:
                input.brand,

            channel:
                input.channel,

            product:
                input.product,

            pageName:
                pageName.displayName,

            pageKey:
                pageName.fileName,

            scannedAt:
                new Date().toISOString(),

            /*
             * Only successfully resolved elements
             * may be used for POM generation.
             */
            elements,

            /*
             * Captured elements that could not be
             * assigned a safe unique locator.
             *
             * These must be retained for review,
             * not emitted as executable actions.
             */
            unresolvedElements,
        };
    }


    private validateHierarchy(
        brand: Brand,
        channel: Channel,
        product: Product,
    ): void {

        const channels =
            BrandHierarchy[brand];


        const products =
            (
                channels as Partial<
                    Record<
                        Channel,
                        readonly Product[]
                    >
                >
            )[channel];


        if (
            !products ||
            !products.includes(product)
        ) {
            throw new Error(
                `Invalid Brand → Channel → Product combination: ` +
                `${brand} → ${channel} → ${product}`,
            );
        }
    }
}
