import { defineConfig, devices, Project } from '@playwright/test';
import { brands, BrandName } from './automationLayer/insurance/allBrands';
import { hasEnvironment } from './automationLayer/insurance/shared/brands/BrandConfig';
import { parseRetries, videoOption } from './configLayer/execution/playwrightArtifacts';
import {
  ACTION_TIMEOUT,
  EXPECT_TIMEOUT,
  NAVIGATION_TIMEOUT,
} from './configLayer/execution/timeouts';

import { initializeEvidenceRun } from './configLayer/evidenceFactory/evidenceRunDirectory';
import { getEvidenceReporterConfig } from './configLayer/evidenceFactory/reporterConfig';

/**
 * Brand-agnostic suite: the same specs under automationLayer/insurance run once per brand,
 * as one Playwright project per brand. A brand only runs the product folders it sells
 * (Britannia: motor; Allianz: motor and home) plus the brand-neutral ones. Specs are in tests/lv
 * (Allianz, Britannia) and tests/ferry (the Ferry brands: audi, cupra, seat, skoda, vw).
 *
 *   npx cross-env ENV=test playwright test -c playwright.brands.config.ts --project=allianz
 *   npx cross-env ENV=test playwright test -c playwright.brands.config.ts --project=britannia --grep @DeploymentSmokeTest
 *
 * The legacy per-brand configs (playwright.config.ts with PROJECT=...) are unaffected.
 */

process.env.ENV ??= 'test';
const env = process.env.ENV;

// Navigation is enabled separately for Jenkins runs.
const isCI = process.env.CI === 'true';
const suite = process.env.TEST_SUITE;
if (suite && !['tests', 'navigation', 'all'].includes(suite)) {
  throw new Error('TEST_SUITE must be tests, navigation, or all');
}
const includeNavigation =
  process.env.INCLUDE_NAVIGATION === 'true' || suite === 'navigation' || suite === 'all';

/** Ferry has one workbook for all five brands, so one setup project converts it for all of them. */
function setupProjectName(name: BrandName): string {
  return brands[name].suite === 'ferry' ? 'ferry-setup' : `${name}-setup`;
}

const setupProjectsAdded = new Set<string>();

function brandProjects(name: BrandName): Project[] {
  const definition = brands[name];
  if (!hasEnvironment(definition, env)) {
    console.warn(
      `Skipping brand "${name}": no .env.${env} in configLayer/environments/${definition.envFolder}`
    );
    return [];
  }

  // Navigation is indexed by application, then product and operation. Preserve each
  // brand's product boundaries. Third-party NB entry lives beside the PCW harness.
  const testMatch =
    definition.suite === 'ferry'
      ? ['ferry/automatedTests/**/*.spec.ts', 'ferry/automatedNavigation/**/*.spec.ts']
      : [
        ...definition.products.flatMap((p) => [
          `lv/automatedTests/${p}/**/*.spec.ts`,
          `lv/automatedNavigation/customerPortal/${p}/**/*.spec.ts`,
          `lv/automatedNavigation/agentPortal/${p}/**/*.spec.ts`,
        ]),
        'lv/automatedTests/agentPortal/**/*.spec.ts',
      ];
  const setupName = setupProjectName(name);
  // The brand project comes before its setup project: the VS Code extension enables only the
  // first project of a config by default. Setup still runs first, as a dependency.
  const projects: Project[] = [
    {
      name,
      testMatch: testMatch.filter(
        (pattern) =>
          !suite ||
          suite === 'all' ||
          pattern.includes(suite === 'navigation' ? '/automatedNavigation/' : '/automatedTests/')
      ),
      dependencies: [setupName],
      use: { ...devices['Desktop Chrome'], brandName: name },
    },
  ];
  if (!setupProjectsAdded.has(setupName)) {
    setupProjectsAdded.add(setupName);
    projects.push({
      name: setupName,
      testMatch: /brand.setup.ts/,
      use: { brandName: name },
    });
  }
  return projects;
}

/** Env values are strings; Playwright wants a number or a percentage string ("50%"). */
function parseWorkers(value: string | undefined): number | string {
  if (!value) {
    return 1;
  }
  if (/^\d+%$/.test(value)) {
    return value;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      `WORKERS must be a positive whole number or a percentage like 50%, got "${value}"`
    );
  }
  return count;
}

const retries = parseRetries();

/*
 * Initialize EvidenceFactory for every invocation, including
 * Common Job discovery. The runner supplies the existing run ID.
 */
const paths = initializeEvidenceRun();

/*
 * Discovery collects inventory only.
 * Execution enables the EvidenceFactory reporters.
 */
const discoveryOnly =
  process.env.EVIDENCEFACTORY_DISCOVERY_ONLY === 'true';

const reporter = discoveryOnly
  ? [['list']]
  : getEvidenceReporterConfig({
    paths,
    product: 'Insurance',
    useBrandAllureReporter: true,
  });

export default defineConfig({
  testDir: './automationLayer/insurance',
  testIgnore: isCI ? (includeNavigation ? [] : ['**/automatedNavigation/**']) : [],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 0 unless RETRIES is set: a retried purchase could pay twice. Needed for VIDEO_MODE=on-first-retry.
  retries,
  // Parallel workers: WORKERS=4 or WORKERS=50% (of CPU cores); the --workers CLI flag overrides
  // it. Defaults to 1 because the test env is slow and every test pays with the same card.
  workers: parseWorkers(process.env.WORKERS),
  reporter: reporter as ReturnType<typeof getEvidenceReporterConfig>,
  outputDir: paths.artifactsDirectory,
  // Per-test timeout comes from the shared fixtures (10 min, as in Selenium).
  expect: { timeout: EXPECT_TIMEOUT },
  use: {
    ignoreHTTPSErrors: env === 'localhost',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // VIDEO_MODE: off (default), on, retain-on-failure, on-first-retry. See docs/Reporting.md.
    video: videoOption(retries),
    actionTimeout: ACTION_TIMEOUT,
    navigationTimeout: NAVIGATION_TIMEOUT,
    headless: process.env.CI === 'true',
  },
  projects: (Object.keys(brands) as BrandName[]).flatMap(brandProjects),
});
