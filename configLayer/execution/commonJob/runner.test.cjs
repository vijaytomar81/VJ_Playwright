const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plan, argsFor, envFor, evaluate, targets } = require('./runner.cjs');

const input = {
  TARGET: 'athena-ferry',
  TEST_ENV: 'dev',
  TEST_SUITE: 'tests',
  RUN_MODE: 'List tests',
  WORKERS: '1',
  RETRIES: '0',
  AUTH_MODE: 'default',
  VIDEO_MODE: 'off',
};
const available = () => true;
const make = (changes = {}) => plan({ ...input, ...changes }, available);
const summary = {
  status: 'finished',
  runtimeErrors: [],
  setupFailed: false,
  selectedTests: 2,
  passed: 2,
  failed: 0,
  flaky: 0,
  skipped: 0,
};

test('Athena Ferry derives its profile and defaults to startup skip without portal credentials', () => {
  const p = make();
  assert.equal(p.environment, 'dev');
  assert.equal(p.project, 'ferry');
  assert.equal(p.auth, 'skip');
  assert.equal(p.bindPortal, false);
  assert.equal(p.gmailPrefix, 'ferry-gmail');
});

test('LV current Motor maps to its shared environment folder and existing credentials', () => {
  const p = make({ TARGET: 'athena-allianz-motor', TEST_ENV: 'test' });
  assert.equal(p.environmentFile, 'configLayer/environments/allianzOnline/.env.test');
  assert.equal(p.project, 'allianzOnlineMotor');
  assert.equal(p.gmailPrefix, 'falcon-gmail');
  assert.equal(p.portalCredential, 'allianz-support-portal');
});

test('all proposed Ferry marques map to Ferry, not to individual environment folders', () => {
  for (const brand of ['audi', 'cupra', 'seat', 'skoda', 'vw']) {
    const p = make({ TARGET: `insurance-${brand}` });
    assert.equal(p.environmentFile, 'configLayer/environments/ferry/.env.dev');
    assert.equal(p.bindPortal, true);
    assert.equal(p.auth, '');
  }
});

test('target determines the profile and optional fixed server restrictions are enforced', () => {
  assert.equal(make({ TARGET: 'insurance-allianz', TEST_ENV: 'test' }).profile, 'lv');
  assert.throws(() => make({ COMMON_JOB_PROFILE: 'lv' }), /COMMON_JOB_PROFILE/);
  assert.throws(() => make({ TARGET: 'athena-britannia_Hexa' }), /Hexa/);
});

test('missing environments fail before discovery or execution', () => {
  assert.throws(() => plan(input, () => false), /Missing.*\.env.dev/);
});

test('removed credential overrides cannot change target-derived credentials', () => {
  const p = make({
    TEST_ENV: 'test',
    GMAIL_CREDENTIAL_PREFIX: 'team-gmail',
    PORTAL_CREDENTIAL_ID: 'team-portal',
    AUTH_MODE: 'sapiens',
  });
  assert.equal(p.environment, 'test');
  assert.equal(p.gmailPrefix, 'ferry-gmail');
  assert.equal(p.portalCredential, 'ferry-agent-portal');
  assert.equal(p.bindPortal, true);
});

test('rejects invalid environments, suites, workers, timeouts, modes, and regular expressions', () => {
  for (const changes of [
    { TEST_ENV: '' },
    { TEST_ENV: undefined },
    { TEST_ENV: 'default' },
    { TEST_ENV: 'uat' },
    { TEST_ENV: 'nft' },
    { TEST_SUITE: 'invalid' },
    { TEST_SUITE: 'navigation' },
    { WORKERS: '0' },
    { WORKERS: 'one' },
    { RUN_TIMEOUT_MINUTES: '0' },
    { RUN_TIMEOUT_MINUTES: '1441' },
    { RUN_MODE: 'anything' },
    { TEST_FILTER: '[' },
    { EXCLUDE_FILTER: '(' },
    { VIDEO_MODE: 'invalid' },
    { VIDEO_MODE: 'on-first-retry', RETRIES: '0' },
    { RETRIES: '9' },
  ])
    assert.throws(() => make(changes));
});

test('paths cannot inject options or escape the selection root', () => {
  for (const testPath of ['--config=other', '../outside', '/absolute', 'C:\\outside']) {
    assert.throws(() => make({ TEST_PATH: testPath }), /TEST_PATH/);
  }
});

test('path metacharacters are escaped while title regex remains one literal argument', () => {
  const p = make({
    TEST_PATH: 'tests/DA+Annual/[case].spec.ts',
    TEST_FILTER: 'title $(echo bad);.*',
    EXCLUDE_FILTER: '@Skip',
  });
  const args = argsFor(p, true);
  assert.ok(args.includes('--grep=title $(echo bad);.*'));
  assert.ok(args.includes('--grep-invert=@Skip'));
  assert.ok(!args.some((arg) => arg.startsWith('--shard')));
  assert.equal(args.at(-2), '--');
  assert.equal(args.at(-1), 'tests/DA\\+Annual/\\[case\\]\\.spec\\.ts');
  assert.ok(args.includes('--list'));
  assert.ok(!argsFor(p, false).includes('--list'));
});

test('discovery and execution use the same project and filters', () => {
  const p = make({ TARGET: 'insurance-audi', TEST_FILTER: '@Smoke' });
  const clean = (args) => args.filter((a) => a !== '--list' && !a.startsWith('--reporter='));
  assert.deepEqual(clean(argsFor(p, true)), clean(argsFor(p, false)));
  assert.ok(argsFor(p, false).includes('--project=audi'));
  assert.ok(argsFor(make(), false).includes('--project=chromium'));
  assert.ok(argsFor(p, false).some((arg) => arg.includes('brand-allure-reporter.ts')));
  assert.ok(argsFor(make(), false).some((arg) => arg.includes(',allure-playwright,')));
  assert.ok(!argsFor(p, true).some((arg) => arg.includes('allure')));
});

test('runner clears inherited framework/auth settings and forces CI browser behavior', () => {
  const env = envFor(
    make({ TARGET: 'insurance-audi' }),
    {
      PROJECT: 'wrong',
      AGENT_PORTAL_AUTH: 'allianz',
      KEEP_BROWSER_OPEN: 'true',
      PWDEBUG: '1',
      INCLUDE_DEMOS: 'true',
      INCLUDE_NAVIGATION: 'true',
      TEST_SUITE: 'all',
      AGENT_PORTAL_EMAIL: 'synthetic-user',
      AGENT_PORTAL_PASSWORD: 'synthetic-password',
    },
    true
  );
  assert.equal(env.PROJECT, undefined);
  assert.equal(env.AGENT_PORTAL_AUTH, undefined);
  assert.equal(env.CI, 'true');
  assert.equal(env.KEEP_BROWSER_OPEN, 'false');
  assert.equal(env.PWDEBUG, '');
  assert.equal(env.INCLUDE_DEMOS, 'false');
  assert.equal(env.TEST_SUITE, 'tests');
  assert.equal(env.INCLUDE_NAVIGATION, undefined);
  assert.equal(
    envFor(make({ TARGET: 'insurance-audi', TEST_SUITE: 'navigation' }), {}, false).TEST_SUITE,
    'navigation'
  );
  assert.equal(env.SUPPORT_PORTAL_USERNAME, 'synthetic-user');
  assert.equal(env.SUPPORT_PORTAL_PASSWORD, 'synthetic-password');
  assert.equal(env.COMMON_JOB_PHASE, 'list');
});

test('parameter plan records choices but never copies secrets', () => {
  const p = make({
    GMAIL_CLIENT_SECRET: 'do-not-record',
    AGENT_PORTAL_PASSWORD: 'do-not-record',
    CAMPAIGN_NAME: 'baseline',
  });
  assert.equal(p.campaign, undefined);
  assert.equal(p.shard, undefined);
  assert.ok(!JSON.stringify(p).includes('do-not-record'));
  assert.equal(Object.keys(targets).length, 11);
});

test('result evaluation distinguishes clean runs, test failures, and incomplete runs', () => {
  assert.equal(evaluate(summary, 0), 0);
  assert.equal(evaluate({ ...summary, failed: 1, passed: 1 }, 1), 2);
  assert.equal(evaluate({ ...summary, flaky: 1, passed: 1 }, 0), 2);
  assert.equal(evaluate({ ...summary, skipped: 1, passed: 1 }, 0), 2);
  assert.equal(evaluate({ ...summary, setupFailed: true }, 1), 1);
  assert.equal(evaluate({ ...summary, runtimeErrors: ['Setup error'] }, 1), 1);
  assert.equal(evaluate({ ...summary, selectedTests: 0 }, 0), 1);
  assert.equal(evaluate({ ...summary, passed: 0, skipped: 2 }, 0), 1);
  assert.equal(evaluate({ ...summary, status: 'timedout' }, 1), 1);
  assert.equal(evaluate(summary, 1), 1);
  assert.equal(evaluate(null, 1), 1);
});

test('testing API credentials are optional for planning and remain runtime-only when supplied', () => {
  for (const options of [
    {},
    { TARGET: 'insurance-allianz', TEST_ENV: 'test' },
    { TARGET: 'insurance-britannia', TEST_ENV: 'test' },
  ]) {
    const p = make(options);
    assert.equal(envFor(p, {}, false).TESTING_API_KEY, undefined);
    const secrets = {
      TESTING_API_KEY: 'synthetic-api-key',
      TESTING_API_USER: 'synthetic-api-user',
      TESTING_API_PASSWORD: 'synthetic-api-password',
    };
    const prepared = make({ ...options, ...secrets });
    const runtime = envFor(prepared, secrets, false);
    for (const [key, value] of Object.entries(secrets)) {
      assert.equal(runtime[key], value);
      assert.ok(!JSON.stringify(prepared).includes(value));
    }
  }
});
