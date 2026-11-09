import { test } from '@playwright/test';

export type FieldValue = string | number | boolean | Date | object | null | undefined;

export interface FieldMap {
  [key: string]: FieldValue;
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

    test.info().annotations.push({ type: key, description });
  }
}
