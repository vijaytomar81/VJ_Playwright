import { Channels } from './channel.config';
import { Products } from './product.config';

/**
 * Brands supported by the automation framework.
 */
export const Brands = {
    AZO: 'AZO',
    BRI: 'BRI',
    FERRY: 'FERRY',
} as const;

export type Brand =
    typeof Brands[keyof typeof Brands];

export const ALL_BRANDS: readonly Brand[] =
    Object.values(Brands);

/**
 * Authoritative Brand → Channel → Product hierarchy.
 *
 * Only combinations configured here are considered valid.
 */
export const BrandHierarchy = {
    [Brands.AZO]: {
        [Channels.DJ]: [
            Products.HOME,
            Products.MOTOR,
        ],

        [Channels.CNF]: [
            Products.HOME,
            Products.MOTOR,
        ],

        [Channels.CTM]: [
            Products.HOME,
            Products.MOTOR,
        ],

        [Channels.GOCO]: [
            Products.HOME,
            Products.MOTOR,
        ],

        [Channels.MSM]: [
            Products.HOME,
            Products.MOTOR,
        ],
    },

    [Brands.BRI]: {
        [Channels.DJ]: [
            Products.MOTOR,
        ],

        [Channels.CNF]: [
            Products.HOME,
        ],

        [Channels.CTM]: [
            Products.HOME,
        ],

        [Channels.GOCO]: [
            Products.HOME,
        ],

        [Channels.MSM]: [
            Products.HOME,
        ],
    },

    [Brands.FERRY]: {
        [Channels.DJ]: [
            Products.HOME,
            Products.MOTOR,
        ],
    },
} as const;