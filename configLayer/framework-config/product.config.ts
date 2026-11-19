/**
 * Products supported by the automation framework.
 *
 * This file defines products only.
 * Brand → Channel → Product relationships are defined
 * in brand.config.ts.
 */
export const Products = {
    HOME: 'Home',
    MOTOR: 'Motor',
} as const;

export type Product =
    typeof Products[keyof typeof Products];

export const ALL_PRODUCTS: readonly Product[] =
    Object.values(Products);