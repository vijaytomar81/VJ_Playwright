import type { PlaywrightWorkerOptions } from '@playwright/test';

const videoModes = ['off', 'on', 'retain-on-failure', 'on-first-retry'] as const;
type VideoMode = (typeof videoModes)[number];

/** Retries per failed test, from RETRIES (default 0: a retried purchase can pay twice). */
export function parseRetries(value: string | undefined = process.env.RETRIES): number {
  if (!value?.trim()) {
    return 0;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`RETRIES must be a whole number (0 or more), got "${value}"`);
  }
  return count;
}

/**
 * Video recording, from VIDEO_MODE: off (default), on, retain-on-failure or on-first-retry.
 * Only the test's own page/context is recorded; contexts made with browser.newContext() are not
 * (the agent portal sign-in uses one on purpose, so credentials never end up in a video).
 */
export function videoOption(retries: number): PlaywrightWorkerOptions['video'] {
  const mode = (process.env.VIDEO_MODE?.trim() || 'off') as VideoMode;
  if (!videoModes.includes(mode)) {
    throw new Error(`VIDEO_MODE must be one of ${videoModes.join(', ')}, got "${mode}"`);
  }
  if (mode === 'on-first-retry' && retries < 1) {
    console.warn(
      'VIDEO_MODE=on-first-retry records nothing while RETRIES=0 - set RETRIES=1 or more.'
    );
  }
  // The default video size is 800x450; match the desktop viewport so the text stays readable.
  return { mode, size: { width: 1280, height: 720 } };
}
