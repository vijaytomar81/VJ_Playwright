
import type {
    Brand,
} from '@framework-config';

import type {
    Channel,
} from '@framework-config';

import type {
    Product,
} from '@framework-config';

import type {
    ElementType,
} from './captured-element.model';

import type {
    GeneratedLocator,
} from './locator.model';

import type {
    ElementFingerprint,
} from '../fingerprint/element-fingerprint';

import type {
    UnresolvedElement,
} from './unresolved-element.model';


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

    /**
     * Successfully resolved elements.
     *
     * Each element must have a validated
     * unique locator.
     */
    elements: readonly GeneratedElement[];

    /**
     * Captured elements for which no safe,
     * unique locator could be generated.
     *
     * Optional for backward compatibility
     * with existing generated page metadata.
     */
    unresolvedElements?: readonly UnresolvedElement[];
}
