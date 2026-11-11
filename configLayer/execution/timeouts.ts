/**
 * The suite's timeouts, in one place. The Playwright configs use these as the global defaults, and
 * a step that needs longer than the default states how many times longer, so it stays tied to the
 * global value:
 *
 *   await locator.waitFor({ state: 'visible', timeout: 2 * ACTION_TIMEOUT });
 *
 * Do not pass a timeout that is shorter than or equal to the global one: leave it out. Only a call
 * that checks whether an optional element appears (and carries on without it) sets a short one.
 */

/** Click, fill, waitFor and the other locator actions. */
export const ACTION_TIMEOUT = 30_000;

/** goto, waitForURL and the other navigations. */
export const NAVIGATION_TIMEOUT = 2 * ACTION_TIMEOUT;

/** expect(...) assertions (Playwright's own default is 5 seconds). */
export const EXPECT_TIMEOUT = 15_000;
