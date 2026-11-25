const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const targets = {
  'athena-ferry': { profile: 'ferry', project: 'ferry', folder: 'ferry' },
  'athena-allianz-motor': {
    profile: 'lv',
    project: 'allianzOnlineMotor',
    folder: 'allianzOnline',
    brand: 'allianz',
  },
  'athena-allianz-home': {
    profile: 'lv',
    project: 'allianzOnlineHome',
    folder: 'allianzOnline',
    brand: 'allianz',
  },
  'athena-britannia': {
    profile: 'lv',
    project: 'britannia',
    folder: 'britannia',
    brand: 'britannia',
  },
  'insurance-allianz': { profile: 'lv', brand: 'allianz', folder: 'allianzOnline' },
  'insurance-britannia': { profile: 'lv', brand: 'britannia', folder: 'britannia' },
  ...Object.fromEntries(
    ['audi', 'cupra', 'seat', 'skoda', 'vw'].map((brand) => [
      `insurance-${brand}`,
      { profile: 'ferry', brand, folder: 'ferry' },
    ])
  ),
};

function insist(condition, message) {
  if (!condition) throw new Error(message);
}

function plan(input, exists = fs.existsSync) {
  const target = targets[input.TARGET];
  insist(target, 'Select a supported TARGET. Hexa is excluded until its wrapper is corrected.');
  const profile = target.profile;
  if (input.COMMON_JOB_PROFILE)
    insist(
      input.COMMON_JOB_PROFILE === profile,
      'TARGET does not match this server/folder COMMON_JOB_PROFILE.'
    );
  const environment = input.TEST_ENV;
  insist(['dev', 'test'].includes(environment), 'TEST_ENV must be dev or test.');
  const suite = input.TEST_SUITE || 'tests';
  insist(
    ['tests', 'navigation', 'all'].includes(suite),
    'TEST_SUITE must be tests, navigation, or all.'
  );
  insist(
    !target.project || suite !== 'navigation',
    'Athena targets have no automatedNavigation suite; select tests or all.'
  );
  const environmentFile = `configLayer/environments/${target.folder}/.env.${environment}`;
  insist(
    exists(environmentFile),
    `Missing ${environmentFile}; this target/environment is unavailable.`
  );
  insist(['List tests', 'Execute tests'].includes(input.RUN_MODE), 'Select a supported RUN_MODE.');
  const workers = input.WORKERS || '1';
  insist(/^[1-9]\d*%?$/.test(workers), 'WORKERS must be positive: e.g. 1, 4, or 50%.');
  const retries = input.RETRIES || '0';
  insist(['0', '1', '2'].includes(retries), 'RETRIES must be 0, 1, or 2.');
  const video = input.VIDEO_MODE || 'off';
  insist(
    ['off', 'on', 'retain-on-failure', 'on-first-retry'].includes(video),
    'Invalid VIDEO_MODE.'
  );
  insist(video !== 'on-first-retry' || retries !== '0', 'on-first-retry video needs RETRIES >= 1.');
  const timeout = input.RUN_TIMEOUT_MINUTES || '180';
  insist(
    /^\d+$/.test(timeout) && Number(timeout) > 0 && Number(timeout) <= 1440,
    'RUN_TIMEOUT_MINUTES must be 1..1440.'
  );
  const auth = input.AUTH_MODE || 'default';
  insist(
    ['default', 'skip', 'sapiens', 'allianz', 'sapiensKeycloak'].includes(auth),
    'Invalid AUTH_MODE.'
  );
  const testPath = (input.TEST_PATH || '').trim().replaceAll('\\', '/');
  insist(
    !testPath ||
      (!testPath.startsWith('-') &&
        !path.posix.isAbsolute(testPath) &&
        !/^[A-Za-z]:/.test(testPath) &&
        !testPath.split('/').includes('..')),
    'TEST_PATH must be a relative folder/file path without .. or leading options.'
  );
  for (const key of ['TEST_FILTER', 'EXCLUDE_FILTER']) {
    try {
      new RegExp(input[key] || '');
    } catch {
      throw new Error(`${key} must be a valid regular expression.`);
    }
  }
  return {
    target: input.TARGET,
    profile,
    environment,
    environmentFile,
    framework: target.project ? 'athena' : 'insurance',
    config: target.project ? 'playwright.config.ts' : 'playwright.brands.config.ts',
    project: target.project || '',
    brand: target.brand || '',
    mode: input.RUN_MODE,
    workers,
    suite,
    retries,
    video,
    timeout: Number(timeout),
    auth: auth === 'default' ? (target.project ? 'skip' : '') : auth,
    testPath,
    grep: input.TEST_FILTER || '',
    grepInvert: input.EXCLUDE_FILTER || '',
    commit: input.GIT_COMMIT || '',
    job: input.JOB_NAME || '',
    build: input.BUILD_NUMBER || '',
    buildUrl: input.BUILD_URL || '',
    gmailPrefix: profile === 'ferry' ? 'ferry-gmail' : 'falcon-gmail',
    portalCredential: profile === 'ferry' ? 'ferry-agent-portal' : `${target.brand}-support-portal`,
    bindPortal: !target.project || (auth !== 'skip' && auth !== 'default'),
  };
}

function argsFor(p, list) {
  const args = [
    'test',
    '-c',
    p.config,
    `--project=${p.framework === 'athena' ? 'chromium' : p.brand}`,
    `--workers=${p.workers}`,
    `--retries=${p.retries}`,
  ];
  if (p.grep) args.push(`--grep=${p.grep}`);
  if (p.grepInvert) args.push(`--grep-invert=${p.grepInvert}`);
  const audit = './configLayer/execution/commonJob/reporter.cjs';
  const allure =
    p.framework === 'insurance' ? './reportingLayer/brand-allure-reporter.ts' : 'allure-playwright';
  args.push(
    `--reporter=${list ? `list,${audit}` : `list,html,junit,${allure},./reportingLayer/custom-html-reporter.js,${audit}`}`
  );
  if (list) args.push('--list');
  // Playwright treats file filters as regexes: escape user paths so +, [, etc. stay literal.
  if (p.testPath) args.push('--', p.testPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return args;
}

function envFor(p, source, list) {
  const env = {
    ...source,
    CI: 'true',
    ENV: p.environment,
    WORKERS: p.workers,
    VIDEO_MODE: p.video,
    RETRIES: p.retries,
    KEEP_BROWSER_OPEN: 'false',
    INCLUDE_DEMOS: 'false',
    TEST_SUITE: p.suite,
    PWDEBUG: '',
    COMMON_JOB_PHASE: list ? 'list' : 'execute',
    PLAYWRIGHT_JUNIT_OUTPUT_FILE: 'results.xml',
    PLAYWRIGHT_HTML_OUTPUT_DIR: 'playwright-report',
    PLAYWRIGHT_HTML_OPEN: 'never',
  };
  // Avoid inheriting a previous target's default-config or authentication settings.
  delete env.PROJECT;
  delete env.AGENT_PORTAL_AUTH;
  delete env.INCLUDE_NAVIGATION;
  if (p.project) env.PROJECT = p.project;
  if (p.auth) env.AGENT_PORTAL_AUTH = p.auth;
  if (p.framework === 'insurance' && source.AGENT_PORTAL_EMAIL) {
    env.SUPPORT_PORTAL_USERNAME = source.AGENT_PORTAL_EMAIL;
    env.SUPPORT_PORTAL_PASSWORD = source.AGENT_PORTAL_PASSWORD;
  }
  return env;
}

function evaluate(summary, exitCode) {
  if (
    !summary ||
    summary.status !== 'finished' ||
    summary.runtimeErrors.length ||
    summary.setupFailed ||
    !summary.selectedTests
  )
    return 1;
  if (summary.failed) return 2;
  if (exitCode !== 0) return 1;
  if (summary.passed + summary.flaky === 0) return 1;
  return summary.skipped || summary.flaky ? 2 : 0;
}

function main(command) {
  if (command === 'prepare') {
    // Only generated outputs, relative to the Jenkins checkout; no parameter controls deletion.
    for (const output of [
      'common-job',
      'results.xml',
      'playwright-report',
      'test-results',
      'allure-results',
      'custom-test-reports',
    ]) {
      fs.rmSync(path.resolve(output), { recursive: true, force: true });
    }
    const p = plan(process.env);
    fs.mkdirSync('common-job');
    fs.writeFileSync('common-job/plan.json', JSON.stringify(p, null, 2));
    console.log(`${p.target} | ${p.environment} | ${p.suite} | ${p.mode}`);
    return 0;
  }
  const p = JSON.parse(fs.readFileSync('common-job/plan.json', 'utf8'));
  if (command === 'list' || command === 'execute') {
    const list = command === 'list';
    const result = spawnSync(
      process.execPath,
      [require.resolve('@playwright/test/cli'), ...argsFor(p, list)],
      {
        env: envFor(p, process.env, list),
        stdio: 'inherit',
      }
    );
    if (result.error) throw result.error;
    const code = result.status ?? 1;
    if (!list) fs.writeFileSync('common-job/exit-code.txt', String(code));
    if (list && code === 0) {
      const inventory = JSON.parse(fs.readFileSync('common-job/inventory.json', 'utf8'));
      insist(
        inventory.tests.some((t) => !t.setup),
        'No scenario tests selected (setup-only or empty selection). Adjust suite/path/filters.'
      );
    }
    return code;
  }
  if (command === 'evaluate') {
    const file = 'common-job/results-summary.json';
    const summary = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    const exitCode = Number(fs.readFileSync('common-job/exit-code.txt', 'utf8'));
    const result = evaluate(summary, exitCode);
    console.log(
      JSON.stringify({ result: ['SUCCESS', 'FAILURE', 'UNSTABLE'][result], ...summary }, null, 2)
    );
    return result;
  }
  throw new Error(`Unknown command ${command}`);
}

module.exports = { targets, plan, argsFor, envFor, evaluate };
if (require.main === module) {
  try {
    process.exitCode = main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
