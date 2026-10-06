/**
 * Channels supported by the automation framework.
 *
 * This file defines channels only.
 * Brand → Channel relationships are defined
 * in brand.config.ts.
 */
export const Channels = {
    CTM: 'CTM',
    CNF: 'CNF',
    MSM: 'MSM',
    GOCO: 'GoCo',
    DJ: 'DJ',
} as const;

export type Channel =
    typeof Channels[keyof typeof Channels];

export const ALL_CHANNELS: readonly Channel[] =
    Object.values(Channels);