const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { argsFor, envFor } = require('./runner.cjs');

// Real production reporter selection and output settings; only browser-free synthetic tests run.
test('failed execution still writes JUnit, Playwright HTML, Allure and archived-summary inputs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'common-jenkins-reports-'));
  const root = path.resolve(__dirname, '../../..');
  const runDirectory = path.join(dir, 'test-results', 'run-synthetic');
  const commonJobDirectory = path.join(runDirectory, 'common-job');
  const p = {
    framework: 'insurance',
    brand: 'brand',
    config: path.join(dir, 'playwright.config.cjs'),
    workers: '1',
    retries: '0',
    environment: 'unit',
    video: 'off',
    suite: 'tests',
  };
  try {
    fs.mkdirSync(commonJobDirectory, { recursive: true });
    fs.writeFileSync(
      p.config,
      `module.exports = {
                testDir: '.', testMatch: 'scenarios.spec.js',
                projects: [{name:'brand'}], timeout: 10000,
                reporter: [
                    ['list'],
                    ['junit', { outputFile: ${JSON.stringify(path.join(runDirectory, 'junit', 'results.xml'))} }],
                    ['html', { outputFolder: ${JSON.stringify(path.join(runDirectory, 'playwright'))}, open: 'never' }],
                    [${JSON.stringify(require.resolve('allure-playwright'))}, { resultsDir: ${JSON.stringify(path.join(runDirectory, 'allure', 'results'))} }],
                    [${JSON.stringify(path.join(root, 'configLayer/execution/commonJob/reporter.cjs'))}],
                ],
            };`
    );
    fs.writeFileSync(
      path.join(dir, 'scenarios.spec.js'),
      `
            const {test,expect}=require(${JSON.stringify(require.resolve('@playwright/test'))});
            test('pass',()=>{expect(2+2).toBe(4)});
            test('fail',async()=>{
                await test.info().attach('diagnostic',{body:Buffer.from('synthetic failure detail'),contentType:'text/plain'});
                expect(1).toBe(2);
            });
            `
    );
    const invoke = (list) => {
      // Discovery uses the Common Job reporter; execution uses the Playwright config.
      const args = argsFor(p, list).map((arg) => {
        if (!arg.startsWith('--reporter=')) return arg;
        return '--reporter=' + arg
          .slice('--reporter='.length)
          .split(',')
          .map((name) => name.startsWith('./') ? path.resolve(root, name) : name)
          .join(',');
      });
      return spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), ...args], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 90000,
        env: {
          ...envFor(p, process.env, list),
          EVIDENCEFACTORY_COMMON_JOB_DIRECTORY: commonJobDirectory,
        },
      });
    };
    const discovery = invoke(true);
    assert.equal(discovery.status, 0, discovery.stdout + discovery.stderr);
    assert.ok(!fs.existsSync(path.join(runDirectory, 'junit', 'results.xml')));
    const run = invoke(false);
    assert.equal(run.status, 1, run.stdout + run.stderr);
    const xml = fs.readFileSync(path.join(runDirectory, 'junit', 'results.xml'), 'utf8');
    assert.match(xml, /<testcase[^>]*name="pass"/);
    assert.match(xml, /<failure/);
    assert.ok(fs.statSync(path.join(runDirectory, 'playwright', 'index.html')).size > 0);
    const allureDirectory = path.join(runDirectory, 'allure', 'results');
    const allure = fs.readdirSync(allureDirectory);
    const statuses = allure
      .filter((name) => name.endsWith('-result.json'))
      .map(
        (name) => JSON.parse(fs.readFileSync(path.join(allureDirectory, name), 'utf8')).status
      );
    assert.deepEqual(statuses.sort(), ['failed', 'passed']);
    assert.ok(allure.some((name) => name.includes('attachment')));
    const summary = JSON.parse(
      fs.readFileSync(path.join(commonJobDirectory, 'results-summary.json'), 'utf8')
    );
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 1);
    assert.ok(!fs.existsSync(path.join(dir, 'custom-test-reports')));
  } finally {
    // Verify this is the freshly-created test directory before recursive cleanup on Windows too.
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('common-jenkins-reports-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
