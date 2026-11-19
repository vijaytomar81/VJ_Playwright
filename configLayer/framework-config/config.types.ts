import type { Brand } from './brand.config';
import type { Channel } from './channel.config';
import type { Product } from './product.config';

/**
 * Represents one complete and valid business configuration.
 */
export interface BusinessConfiguration {
    brand: Brand;
    channel: Channel;
    product: Product;
}

/**
 * Used while a configuration is being selected.
 *
 * Example:
 * Brand selected first,
 * then Channel,
 * then Product.
 */
export interface ConfigurationSelection {
    brand: Brand;
    channel?: Channel;
    product?: Product;
}

/**
 * Result returned by configuration validation.
 */
export interface ConfigurationValidationResult {
    valid: boolean;
    message?: string;
}