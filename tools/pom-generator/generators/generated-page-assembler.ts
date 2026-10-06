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


        const capturedElements =
            await this.scanner.scan();


        const elements =
            await this.elementAssembler
                .assembleAll(
                    capturedElements,
                );


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

            elements,
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