import {
  test,
  expect,
} from '@playwright/test';

import {
  StableKeyGenerator,
} from '../../../tools/pom-generator/fingerprint/stable-key-generator';

const generator =
  new StableKeyGenerator();

test.describe(
  'StableKeyGenerator',
  () => {

    test('should generate a stable-key value', () => {
      const key =
        generator.generate();

      expect(key)
        .toBeTruthy();

      expect(key.length)
        .toBeGreaterThan(0);
    });


    test('should generate unique keys for new elements', () => {
      const first =
        generator.generate();

      const second =
        generator.generate();

      expect(first)
        .not.toBe(second);
    });


    test('should generate UUID formatted keys', () => {
      const key =
        generator.generate();

      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

  },
);