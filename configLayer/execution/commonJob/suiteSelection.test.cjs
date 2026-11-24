const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { plan, envFor, targets } = require('./runner.cjs');

test('Jenkins form exposes the streamlined parameters and target names', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../JenkinsfileCommonTests'),
    'utf8'
  );
  const parameters = [...source.matchAll(/(?:choice|booleanParam|string)\(name: '([^']+)'/g)].map(
    (match) => match[1]
  );
  assert.deepEqual(parameters, [
    'TEST_SUITE',
    'TARGET',
    'TEST_ENV',
    'RUN_MODE',
    'TEST_PATH',
    'TEST_FILTER',
    'EXCLUDE_FILTER',
    'WORKERS',
    'RETRIES',
    'AUTH_MODE',
    'VIDEO_MODE',
    'RUN_TIMEOUT_MINUTES',
    'PUBLISH_HTML_REPORT',
    'GENERATE_ALLURE_REPORT',
    'RECIPIENT_EMAILS',
  ]);
  assert.match(source, /name: 'TEST_SUITE', choices: \['tests', 'navigation', 'all'\]/);
  assert.match(source, /name: 'TEST_ENV', choices: \['dev', 'test'\]/);
  assert.match(source, /name: 'GENERATE_ALLURE_REPORT', defaultValue: true/);
  for (const target of Object.keys(targets)) assert.ok(source.includes(`'${target}'`));
  assert.ok(!source.includes('params.TESTING_API_'));
  assert.match(source, /testingApi\.call \{/);
});

test('real Insurance discovery selects only the requested folders and all is their union', () => {
  const root = path.resolve(__dirname, '../../..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'common-job-suite-'));
  const inventories = {};
  try {
    for (const suite of ['tests', 'navigation', 'all']) {
      const output = path.join(dir, `${suite}.json`);
      const p = plan({
        TARGET: 'insurance-audi',
        TEST_ENV: 'test',
        RUN_MODE: 'List tests',
        TEST_SUITE: suite,
      });
      const env = envFor(
        p,
        {
          ...process.env,
          INCLUDE_NAVIGATION: 'true',
          PLAYWRIGHT_JSON_OUTPUT_FILE: output,
        },
        true
      );
      const result = spawnSync(
        process.execPath,
        [
          require.resolve('@playwright/test/cli'),
          'test',
          '-c',
          'playwright.brands.config.ts',
          '--list',
          '--reporter=json',
          '--project=allianz',
          '--project=britannia',
          '--project=audi',
        ],
        { cwd: root, encoding: 'utf8', timeout: 90_000, env }
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.deepEqual(report.errors, []);
      const selected = new Set();
      const projects = new Set();
      const setups = new Set();
      function collect(node, file = node.file) {
        for (const spec of node.specs ?? []) {
          for (const entry of spec.tests) {
            if (entry.projectName.endsWith('-setup')) {
              setups.add(entry.projectName);
              continue;
            }
            projects.add(entry.projectName);
            if (suite !== 'all')
              assert.ok(
                file.includes(suite === 'tests' ? '/automatedTests/' : '/automatedNavigation/'),
                file
              );
            selected.add(`${entry.projectName}:${file}:${spec.title}`);
          }
        }
        for (const child of node.suites ?? []) collect(child, file);
      }
      report.suites.forEach((node) => collect(node));
      assert.deepEqual([...projects].sort(), ['allianz', 'audi', 'britannia']);
      assert.deepEqual([...setups].sort(), ['allianz-setup', 'britannia-setup', 'ferry-setup']);
      inventories[suite] = selected;
    }
    assert.deepEqual(
      [...inventories.all].sort(),
      [...new Set([...inventories.tests, ...inventories.navigation])].sort()
    );
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('common-job-suite-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
