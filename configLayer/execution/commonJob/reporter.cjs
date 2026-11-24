const fs = require('node:fs');

class CommonJobReporter {
  onBegin(_config, suite) {
    this.suite = suite;
    this.errors = [];
    fs.mkdirSync('common-job', { recursive: true });
    const tests = suite.allTests().map((test) => ({
      id: test.id,
      project: test.parent.project()?.name || '',
      title: test.titlePath(),
      file: test.location.file
        .replaceAll('\\', '/')
        .replace(process.cwd().replaceAll('\\', '/') + '/', ''),
      line: test.location.line,
      setup: (test.parent.project()?.name || '').endsWith('-setup'),
    }));
    if (process.env.COMMON_JOB_PHASE === 'list') {
      fs.writeFileSync('common-job/inventory.json', JSON.stringify({ tests }, null, 2));
    } else if (fs.existsSync('common-job/inventory.json')) {
      const planned = JSON.parse(fs.readFileSync('common-job/inventory.json', 'utf8'))
        .tests.map((test) => test.id)
        .sort();
      const actual = tests.map((test) => test.id).sort();
      if (JSON.stringify(planned) !== JSON.stringify(actual))
        this.errors.push('Selected test inventory changed between discovery and execution.');
    }
  }

  onError(error) {
    this.errors ??= [];
    this.errors.push(error.message || String(error));
  }

  onEnd(result) {
    if (process.env.COMMON_JOB_PHASE === 'list') return;
    const summary = {
      status: ['passed', 'failed'].includes(result.status) ? 'finished' : result.status,
      runnerStatus: result.status,
      runtimeErrors: this.errors || [],
      selectedTests: 0,
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      setupFailed: false,
      setupTests: 0,
      tests: [],
    };
    for (const test of this.suite?.allTests() || []) {
      const project = test.parent.project()?.name || '';
      const setup = project.endsWith('-setup');
      const outcome = test.outcome();
      const lastStatus = test.results.at(-1)?.status || 'not-run';
      const failed = outcome === 'unexpected';
      summary.tests.push({
        id: test.id,
        project,
        title: test.titlePath(),
        setup,
        outcome,
        lastStatus,
        attempts: test.results.length,
        expectedStatus: test.expectedStatus,
      });
      if (setup) {
        summary.setupTests++;
        summary.setupFailed ||= failed || lastStatus === 'not-run' || lastStatus === 'skipped';
        continue;
      }
      summary.selectedTests++;
      if (failed) summary.failed++;
      else if (outcome === 'flaky') summary.flaky++;
      else if (lastStatus === 'skipped' || lastStatus === 'not-run') summary.skipped++;
      else summary.passed++;
    }
    fs.mkdirSync('common-job', { recursive: true });
    fs.writeFileSync('common-job/results-summary.json', JSON.stringify(summary, null, 2));
  }
}

module.exports = CommonJobReporter;
