import AllureReporter from 'allure-playwright';
import type { Location, TestCase } from '@playwright/test/reporter';

/** Allure must identify generated navigation tests by their spec, not their shared helper. */
function useNavigationSpecLocations(tests: TestCase[]) {
  const originals = new Map<TestCase, Location>();
  for (const test of tests) {
    if (
      !/insurance\/(lv|ferry)\/automatedNavigation\/reachEveryPage\.ts$/.test(
        test.location.file.replaceAll('\\', '/')
      )
    )
      continue;
    let suite = test.parent;
    while (suite && suite.type !== 'file') suite = suite.parent!;
    if (!suite?.location) continue;
    originals.set(test, test.location);
    // Generated targets have no individual declaration line in the spec; link to its start.
    test.location = { file: suite.location.file, line: 1, column: 1 };
  }
  return () => {
    for (const [test, location] of originals) test.location = location;
  };
}

export default class BrandAllureReporter extends AllureReporter {
  override async preprocess(params: Parameters<AllureReporter['preprocess']>[0]) {
    const restore = useNavigationSpecLocations(params.suite.allTests());
    try {
      await super.preprocess(params);
    } finally {
      restore();
    }
  }

  override onTestBegin(test: TestCase) {
    const restore = useNavigationSpecLocations([test]);
    try {
      super.onTestBegin(test);
    } finally {
      // Other reporters and Playwright keep the original source location and tree.
      restore();
    }
  }
}
