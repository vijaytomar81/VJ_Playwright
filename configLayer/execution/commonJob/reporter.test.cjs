const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { evaluate } = require('./runner.cjs');

// Real reporter lifecycle, with synthetic browser-free scenarios; no insurance tests execute.
test('reporter inventories tests and distinguishes scenario failures from setup failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'common-jenkins-reporter-'));
  try {
    const api = JSON.stringify(require.resolve('@playwright/test'));
    fs.writeFileSync(
      path.join(dir, 'playwright.config.cjs'),
      `module.exports = {
      testDir: '.', testMatch: '*.spec.js', workers: 1, fullyParallel: true,
      projects: [{name:'brand-setup', testMatch:'setup.spec.js'},
        {name:'brand', testMatch:'scenarios.spec.js', dependencies:['brand-setup']}]
    };`
    );
    fs.writeFileSync(
      path.join(dir, 'setup.spec.js'),
      `const {test,expect}=require(${api});
      test('prepare',()=>{expect(process.env.FAIL_SETUP).not.toBe('true')});`
    );
    fs.writeFileSync(
      path.join(dir, 'scenarios.spec.js'),
      `const {test,expect}=require(${api});
      test('pass',()=>{expect(2+2).toBe(4)});
      test('fail',()=>{expect(1).toBe(2)});
      test.skip('skipped',()=>{});`
    );
    const invoke = (phase, failSetup = false, shard = '1/1') =>
      spawnSync(
        process.execPath,
        [
          require.resolve('@playwright/test/cli'),
          'test',
          '-c',
          'playwright.config.cjs',
          '--project=brand',
          `--shard=${shard}`,
          `--reporter=${path.join(__dirname, 'reporter.cjs')}`,
          ...(phase === 'list' ? ['--list'] : []),
        ],
        {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            COMMON_JOB_PHASE: phase,
            FAIL_SETUP: String(failSetup),
          },
        }
      );
    const discovery = invoke('list');
    assert.equal(discovery.status, 0, discovery.stderr + discovery.stdout);
    const inventory = JSON.parse(fs.readFileSync(path.join(dir, 'common-job/inventory.json')));
    assert.equal(inventory.tests.length, 4);
    assert.equal(inventory.tests.filter((t) => t.setup).length, 1);
    assert.ok(!fs.existsSync(path.join(dir, 'common-job/results-summary.json')));
    const execution = invoke('execute');
    assert.equal(execution.status, 1);
    let summary = JSON.parse(fs.readFileSync(path.join(dir, 'common-job/results-summary.json')));
    assert.equal(summary.selectedTests, 3);
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.setupFailed, false);
    assert.equal(evaluate(summary, execution.status), 2);
    const brokenSetup = invoke('execute', true);
    assert.equal(brokenSetup.status, 1);
    summary = JSON.parse(fs.readFileSync(path.join(dir, 'common-job/results-summary.json')));
    assert.equal(summary.setupFailed, true);
    assert.equal(summary.passed, 0);
    assert.equal(summary.skipped, 3);
    assert.equal(evaluate(summary, brokenSetup.status), 1);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(dir, 'common-job/inventory.json'))),
      inventory
    );
    const shardDiscovery = invoke('list', false, '1/2');
    assert.equal(shardDiscovery.status, 0, shardDiscovery.stdout + shardDiscovery.stderr);
    const shardInventory = JSON.parse(fs.readFileSync(path.join(dir, 'common-job/inventory.json')));
    const scenarios = shardInventory.tests.filter((t) => !t.setup);
    assert.ok(scenarios.length > 0 && scenarios.length < 3);
    invoke('execute', false, '1/2');
    summary = JSON.parse(fs.readFileSync(path.join(dir, 'common-job/results-summary.json')));
    assert.equal(summary.selectedTests, scenarios.length);
    assert.deepEqual(summary.runtimeErrors, []);
  } finally {
    // This newly-created test-only directory is never a workspace or a parameter-supplied path.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
