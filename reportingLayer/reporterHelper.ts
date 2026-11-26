import { test } from '@playwright/test';
import { parameter } from 'allure-js-commons';

export type FieldValue = string | number | boolean | Date | object | null | undefined;

export interface FieldMap {
  [key: string]: FieldValue;
}

/**
 * Records a value on the running test in both reports.
 *
 * Playwright's HTML report shows `testInfo.annotations`, but allure-playwright reads them only when
 * the test starts, so annotations pushed while it runs never reach Allure. This pushes the
 * annotation and also adds an Allure parameter, shown in the test's Parameters section. Use it
 * instead of `test.info().annotations.push(...)`; annotations given in the test declaration (such as
 * seleniumSource) already reach both reports and need nothing.
 *
 * A parameter rather than `logStep`: Allure nests a step logged outside a Playwright step under
 * whichever step runs next. `excluded` keeps values that differ per run (the email) out of the
 * test's history id, so its Allure history stays one line.
 */
export function annotate(type: string, description: string): void {
  test.info().annotations.push({ type, description });
  void parameter(type, description, { excluded: true });
}

export function attachValueInTestReport(fields: FieldMap): void {
  for (const [key, value] of Object.entries(fields)) {
    let description: string;

    if (value === null || value === undefined) {
      description = '';
    } else if (value instanceof Date) {
      description = value.toISOString();
    } else if (typeof value === 'object') {
      try {
        description = JSON.stringify(value);
      } catch {
        description = '[object Object]';
      }
    } else {
      description = String(value);
    }

    annotate(key, description);
  }
}
