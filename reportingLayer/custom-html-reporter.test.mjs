import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import process from 'node:process';
import vm from 'node:vm';
import xlsx from 'xlsx';

test('large diagnostics fit Excel cells while remaining complete in HTML', async () => {
  const source = readFileSync(new URL('./custom-html-reporter.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default CustomHtmlReporter;', 'CustomHtmlReporter;');
  let workbook;
  let html;
  const Reporter = vm.runInNewContext(source, {
    existsSync: () => true,
    mkdirSync: () => {},
    writeFileSync: (_path, body) => {
      html = body;
    },
    writeFile: (book) => {
      // Exercise the actual Excel serializer that rejected the Jenkins error stack.
      xlsx.write(book, { type: 'buffer', bookType: 'xlsx' });
      workbook = book;
    },
    utils: xlsx.utils,
    join,
    process,
    console: { log() {}, error() {} },
  });
  const reporter = new Reporter();
  reporter.onBegin();
  const diagnostic = 'x'.repeat(40000) + 'END OF FULL DIAGNOSTIC';
  await reporter.onTestEnd(
    { title: 'Browser crash' },
    {
      status: 'failed',
      duration: 100,
      error: { stack: diagnostic },
      annotations: [{ type: 'Failure details', description: diagnostic }],
    }
  );
  reporter.onEnd();
  const [row] = xlsx.utils.sheet_to_json(workbook.Sheets['Test Results']);
  assert.equal(row.Error.length, 32767);
  assert.equal(row['Failure details'].length, 32767);
  assert.match(row.Error, /Truncated for Excel/);
  assert.ok(html.includes(diagnostic));
  assert.equal(reporter.results[0].error, diagnostic);
});
