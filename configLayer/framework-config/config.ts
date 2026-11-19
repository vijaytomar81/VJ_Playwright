import {
    ALL_BRANDS,
    BrandHierarchy,
    type Brand,
} from './brand.config';

import type {
    Channel,
} from './channel.config';

import type {
    Product,
} from './product.config';

import type {
    BusinessConfiguration,
    ConfigurationValidationResult,
} from './config.types';

/**
 * Returns all configured brands.
 */
export function getBrands(): readonly Brand[] {
    return ALL_BRANDS;
}

/**
 * Returns the channels configured for a brand.
 */
export function getChannels(
    brand: Brand,
): readonly Channel[] {
    const brandConfig = BrandHierarchy[brand];

    if (!brandConfig) {
        return [];
    }

    return Object.keys(brandConfig) as Channel[];
}

/**
 * Returns the products configured for
 * a Brand + Channel combination.
 */
export function getProducts(
    brand: Brand,
    channel: Channel,
): readonly Product[] {
    const brandConfig = BrandHierarchy[brand];

    if (!brandConfig) {
        return [];
    }

    const products =
        brandConfig[channel as keyof typeof brandConfig];

    if (!products) {
        return [];
    }

    return products as readonly Product[];
}

/**
 * Checks whether the supplied brand exists.
 */
export function isValidBrand(
    brand: string,
): brand is Brand {
    return getBrands().includes(
        brand as Brand,
    );
}

/**
 * Checks whether the channel belongs
 * to the supplied brand.
 */
export function isValidChannel(
    brand: Brand,
    channel: string,
): channel is Channel {
    return getChannels(brand).includes(
        channel as Channel,
    );
}

/**
 * Checks whether the product belongs
 * to the supplied Brand + Channel.
 */
export function isValidProduct(
    brand: Brand,
    channel: Channel,
    product: string,
): product is Product {
    return getProducts(
        brand,
        channel,
    ).includes(
        product as Product,
    );
}

/**
 * Checks a complete Brand → Channel → Product combination.
 */
export function isValidCombination(
    brand: Brand,
    channel: Channel,
    product: Product,
): boolean {
    return getProducts(
        brand,
        channel,
    ).includes(product);
}

/**
 * Validates a complete business configuration.
 */
export function validateConfiguration(
    config: BusinessConfiguration,
): ConfigurationValidationResult {
    if (!isValidBrand(config.brand)) {
        return {
            valid: false,
            message:
                `Unsupported brand: ${config.brand}`,
        };
    }

    if (!isValidChannel(
        config.brand,
        config.channel,
    )) {
        return {
            valid: false,
            message:
                `Channel '${config.channel}' is not configured ` +
                `for brand '${config.brand}'.`,
        };
    }

    if (!isValidProduct(
        config.brand,
        config.channel,
        config.product,
    )) {
        return {
            valid: false,
            message:
                `Product '${config.product}' is not configured ` +
                `for ${config.brand}/${config.channel}.`,
        };
    }

    return {
        valid: true,
    };
}

/**
 * Throws an error when the supplied configuration
 * is not a valid Brand → Channel → Product combination.
 */
export function assertValidConfiguration(
    config: BusinessConfiguration,
): void {
    const result =
        validateConfiguration(config);

    if (!result.valid) {
        throw new Error(
            result.message ??
            'Invalid Brand/Channel/Product configuration.',
        );
    }
}