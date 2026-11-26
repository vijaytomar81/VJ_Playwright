const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const playwright = require('eslint-plugin-playwright');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['node_modules/**', 'test-results/**', 'custom-test-reports/**', '**/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // Lenient on purpose for now: this repo has ~90+ existing spec files written before
      // linting existed. Downgraded to warnings so `eslint` is usable immediately without
      // blocking on a full-repo cleanup; tighten these once the backlog is addressed.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-empty': 'warn',
    },
  },
  {
    files: ['**/tests/**/*.spec.ts', '**/*.spec.ts'],
    plugins: { playwright },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // This repo's tests intentionally chain multiple journeys/assertions per test.
      'playwright/expect-expect': 'off',
      'playwright/no-conditional-in-test': 'off',
    },
  },
  // Architecture: which folder of automationLayer/insurance may import which. The rules are
  // explained in automationLayer/insurance/docs/architecture/Architecture.md ("Layers and rules").
  // Imports go through the aliases @shared / @lv / @ferry, so the rules match on those.
  ...boundary(
    'automationLayer/insurance/shared/**/*.ts',
    ['@lv/**', '@ferry/**'],
    'shared/ is used by every business and must not import one of them'
  ),
  ...boundary(
    'automationLayer/insurance/lv/**/*.ts',
    ['@ferry/**'],
    'lv/ and ferry/ are separate businesses: share through shared/ instead'
  ),
  ...boundary(
    'automationLayer/insurance/ferry/**/*.ts',
    ['@lv/**'],
    'lv/ and ferry/ are separate businesses: share through shared/ instead'
  ),
  // businessDomain describes the business (policies, channels, data): it knows nothing about
  // how a portal is navigated or how tests are written.
  ...boundary(
    'automationLayer/insurance/*/businessDomain/**/*.ts',
    [
      '@*/navigation/**',
      '@*/automatedTests/**',
      '@*/automatedNavigation/**',
      '@shared/framework/**',
      '@shared/data/**',
      'node:fs',
      'fs',
    ],
    'businessDomain must not import navigation, tests or the framework'
  ),
  // navigation (pages, journeys, journeyEntries) is used by tests, never the other way round.
  ...boundary(
    'automationLayer/insurance/*/navigation/**/*.ts',
    ['@*/automatedTests/**', '@*/automatedNavigation/**'],
    'navigation must not import tests'
  ),
  // A page only knows its own screen: journeys and entries call pages, not the other way round.
  // That is the rule below: screen classes may not import anything under automationLayer/insurance.
  ...boundary(
    [
      'automationLayer/athena/**/pages/**/*.ts',
      'automationLayer/ferry/pages/**/*.ts',
      'automationLayer/PCW/**/pages/**/*.ts',
    ],
    ['@shared/**', '@lv/**', '@ferry/**', 'automationLayer/insurance/**'],
    'shared pages must not depend on insurance orchestration or business data'
  ),
  ...boundary(
    'automationLayer/athena/commonPages/**/*.ts',
    ['@shared/**', '@lv/**', '@ferry/**', 'automationLayer/insurance/**'],
    'shared Athena pages must not depend on insurance orchestration or business data'
  ),
  {
    // Standalone Node CommonJS entry points and source-analysis tools.
    files: [
      'configLayer/execution/commonJob/**/*.cjs',
      'configLayer/execution/validateReportPaths.cjs',
      'docs/page-object-analysis/**/*.cjs',
      '.dependency-cruiser.cjs',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettierConfig
);

/** One `no-restricted-imports` rule for the files matching `files`. */
function boundary(files, groups, message) {
  return [
    {
      files: Array.isArray(files) ? files : [files],
      rules: {
        'no-restricted-imports': ['error', { patterns: [{ group: groups, message }] }],
      },
    },
  ];
}
