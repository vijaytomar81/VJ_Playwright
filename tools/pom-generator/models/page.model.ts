import type {
    Brand,
} from '../../../configLayer/brand.config';

import type {
    Channel,
} from '../../../configLayer/channel.config';

import type {
    Product,
} from '../../../configLayer/product.config';

import type {
    ElementType,
} from './captured-element.model';

import type {
    GeneratedLocator,
} from './locator.model';

import type {
    ElementFingerprint,
} from '../fingerprint/element-fingerprint';

export interface GeneratedElement {
    name: string;

    type: ElementType;

    locator: GeneratedLocator;

    stableKey: string;

    fingerprint: ElementFingerprint;
}

export interface GeneratedPage {
    brand: Brand;

    channel: Channel;

    product: Product;

    pageName: string;

    pageKey: string;

    scannedAt: string;

    elements: readonly GeneratedElement[];
}