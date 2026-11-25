const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ExcelJS = require('exceljs');

const entryPoint = path.join(__dirname, 'evidenceFactory.ts');
const tsNode = require.resolve('ts-node/register/transpile-only');
const tsConfig = path.resolve(__dirname, '../../tsconfig.json');

const screenshotName = 'failure-chromium-837c5718d03cf37a-retry-0-repeat-0-worker-1.png';
const startTime = '2026-11-24T10:38:26.789Z';

function createWorkspace(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'evidencefactory-test-'));

    t.after(() => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('evidencefactory-test-'));

        fs.rmSync(directory, { recursive: true, force: true });
    });

    return directory;
}

function writeFile(directory, filename, content) {
    const destination = path.join(directory, filename);

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);

    return destination;
}

function invoke(directory, environment = {}) {
    return spawnSync(process.execPath, ['-r', tsNode, entryPoint], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 60000,
        env: {
            ...process.env,
            TS_NODE_PROJECT: tsConfig,
            CI: 'true',
            ENV: 'test',
            PROJECT: '',
            PRODUCT: '',
            EVIDENCEFACTORY_PROJECT: 'britannia',
            EVIDENCEFACTORY_JSON_FILE: 'results.json',
            EVIDENCEFACTORY_ALLURE_REPORT_DIR: 'allure-report',
            ...environment,
        },
    });
}

function result(status, retry = 0, workerIndex = 0, attachments = []) {
    return {
        status,
        retry,
        workerIndex,
        startTime,
        duration: 1500,
        attachments,
        errors: status === 'failed'
            ? [{ message: 'Synthetic test failure' }]
            : [],
    };
}

function spec(id, title, status, results, annotations = []) {
    return {
        id,
        title,
        tests: [{
            projectId: 'chromium',
            projectName: 'chromium',
            status,
            annotations,
            results,
        }],
    };
}

function createReport(directory) {
    const screenshot = writeFile(
        directory,
        `test-results/native/attachments/${screenshotName}`,
        Buffer.from('synthetic screenshot content'),
    );

    const attachment = {
        name: `full-page-failure:${screenshotName}`,
        contentType: 'image/png',
        path: screenshot,
    };

    const report = {
        suites: [{
            title: 'synthetic.spec.ts',
            suites: [{
                title: 'EvidenceFactory regression',
                specs: [
                    spec('passed-id', 'Passed scenario', 'expected', [
                        result('passed'),
                    ], [
                        { type: 'scenarioId', description: 'PASS001' },
                        { type: 'VRN', description: 'HJ64GZC' },
                        { type: 'browser', description: 'chromium' },
                        { type: 'CardNumber', description: 'SENSITIVE_CARD_VALUE' },
                        { type: 'password', description: 'SENSITIVE_PASSWORD_VALUE' },
                    ]),
                    spec('failed-id', 'Failed scenario', 'unexpected', [
                        result('failed', 0, 1, [attachment]),
                    ], [
                        { type: 'scenarioId', description: 'FAIL001' },
                        { type: 'browser', description: 'chromium' },
                    ]),
                    spec('flaky-id', 'Retried scenario', 'flaky', [
                        result('failed', 0, 2),
                        result('passed', 1, 3),
                    ], [
                        { type: 'scenarioId', description: 'RETRY001' },
                    ]),
                    spec('skipped-id', 'Skipped scenario', 'skipped', [
                        result('skipped'),
                    ], [
                        { type: 'scenarioId', description: 'SKIP001' },
                    ]),
                ],
            }],
        }],
        stats: {
            startTime,
            duration: 6000,
            expected: 1,
            unexpected: 1,
            flaky: 1,
            skipped: 1,
        },
    };

    writeFile(directory, 'results.json', JSON.stringify(report));

    return screenshot;
}

function runDirectories(directory) {
    return fs.readdirSync(path.join(directory, 'test-results'))
        .filter(name => name.startsWith('Britannia-run-'))
        .sort();
}

function assertSuccessful(run) {
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
}

async function readWorkbook(runDirectory) {
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(
        path.join(runDirectory, 'excel-report', 'Britannia-report.xlsx'),
    );

    return workbook;
}

function column(sheet, label) {
    const header = sheet.getRow(1);
    let index = 0;

    header.eachCell((cell, columnNumber) => {
        if (cell.value === label) index = columnNumber;
    });

    assert.ok(index > 0, `Missing column: ${label}`);

    return index;
}

function findRow(sheet, scenarioId) {
    const scenarioColumn = column(sheet, 'Scenario ID');

    for (let index = 2; index <= sheet.rowCount; index++) {
        const row = sheet.getRow(index);

        if (row.getCell(scenarioColumn).value === scenarioId) {
            return row;
        }
    }

    assert.fail(`Missing scenario: ${scenarioId}`);
}

test('generates Excel evidence from nested native Playwright JSON suites', async t => {
    const directory = createWorkspace(t);

    createReport(directory);
    assertSuccessful(invoke(directory));

    const runs = runDirectories(directory);

    assert.equal(runs.length, 1);
    assert.match(
        runs[0],
        /^Britannia-run-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}$/,
    );

    const workbook = await readWorkbook(
        path.join(directory, 'test-results', runs[0]),
    );

    assert.ok(workbook.getWorksheet('Summary'));
    assert.equal(workbook.getWorksheet('All').rowCount, 5);
    assert.equal(workbook.getWorksheet('Passed').rowCount, 3);
    assert.equal(workbook.getWorksheet('Failed').rowCount, 2);
    assert.equal(workbook.getWorksheet('Not Executed').rowCount, 2);

    const passed = workbook.getWorksheet('Passed');
    const passedRow = findRow(passed, 'PASS001');
    const retriedRow = findRow(passed, 'RETRY001');

    assert.equal(passedRow.getCell(column(passed, 'VRN')).value, 'HJ64GZC');
    assert.equal(passedRow.getCell(column(passed, 'Browser')).value, 'chromium');
    assert.equal(Number(retriedRow.getCell(column(passed, 'Retry')).value), 1);
    assert.equal(Number(retriedRow.getCell(column(passed, 'Worker ID')).value), 3);

    findRow(workbook.getWorksheet('Failed'), 'FAIL001');
    findRow(workbook.getWorksheet('Not Executed'), 'SKIP001');
});

test('copies failure screenshots and generates portable Excel hyperlinks', async t => {
    const directory = createWorkspace(t);
    const originalScreenshot = createReport(directory);

    assertSuccessful(invoke(directory));

    const runDirectory = path.join(directory, 'test-results', runDirectories(directory)[0]);
    const workbook = await readWorkbook(runDirectory);
    const failed = workbook.getWorksheet('Failed');
    const row = findRow(failed, 'FAIL001');

    const screenshot = row.getCell(column(failed, 'Screenshot')).value;

    assert.ok(screenshot);
    assert.equal(screenshot.text, 'View Screenshot');
    assert.equal(screenshot.hyperlink, `../artifacts/screenshots/${screenshotName}`);

    const copiedScreenshot = path.resolve(
        runDirectory,
        'excel-report',
        screenshot.hyperlink,
    );

    assert.ok(fs.existsSync(originalScreenshot));
    assert.ok(fs.existsSync(copiedScreenshot));

    assert.deepEqual(
        fs.readFileSync(copiedScreenshot),
        fs.readFileSync(originalScreenshot),
    );
});

test('copies native reports without modifying or removing their original files', t => {
    const directory = createWorkspace(t);

    createReport(directory);

    const reports = [
        ['playwright-report/index.html', 'playwright/index.html'],
        ['playwright-report/data/attachment.txt', 'playwright/data/attachment.txt'],
        ['results.xml', 'junit/results.xml'],
        ['allure-results/test-result.json', 'allure/results/test-result.json'],
        ['allure-report/index.html', 'allure/report/index.html'],
        ['common-job/results-summary.json', 'common-job/results-summary.json'],
    ];

    for (const [source] of reports) {
        writeFile(directory, source, `Synthetic report: ${source}`);
    }

    assertSuccessful(invoke(directory));

    const runDirectory = path.join(directory, 'test-results', runDirectories(directory)[0]);

    for (const [source, destination] of reports) {
        assert.ok(fs.existsSync(path.join(directory, source)));
        assert.ok(fs.existsSync(path.join(runDirectory, destination)));

        assert.deepEqual(
            fs.readFileSync(path.join(directory, source)),
            fs.readFileSync(path.join(runDirectory, destination)),
        );
    }

    assert.ok(!fs.existsSync(path.join(runDirectory, 'custom-test-reports')));
});

test('excludes sensitive annotation values from Excel and does not archive raw JSON', async t => {
    const directory = createWorkspace(t);

    createReport(directory);
    assertSuccessful(invoke(directory));

    const runDirectory = path.join(directory, 'test-results', runDirectories(directory)[0]);
    const workbook = await readWorkbook(runDirectory);

    workbook.eachSheet(sheet => {
        sheet.eachRow(row => {
            row.eachCell(cell => {
                const value = JSON.stringify(cell.value) ?? '';

                assert.ok(!value.includes('SENSITIVE_CARD_VALUE'));
                assert.ok(!value.includes('SENSITIVE_PASSWORD_VALUE'));
            });
        });
    });

    assert.ok(fs.existsSync(path.join(directory, 'results.json')));
    assert.ok(!fs.existsSync(path.join(runDirectory, 'results.json')));
    assert.ok(!fs.existsSync(path.join(runDirectory, 'json')));
});

test('repeated generation does not overwrite an existing evidence run', t => {
    const directory = createWorkspace(t);

    createReport(directory);
    assertSuccessful(invoke(directory));

    const firstRun = runDirectories(directory)[0];
    const firstReport = path.join(
        directory, 'test-results', firstRun, 'excel-report', 'Britannia-report.xlsx',
    );

    const originalContent = fs.readFileSync(firstReport);

    assertSuccessful(invoke(directory));

    const runs = runDirectories(directory);

    assert.equal(runs.length, 2);
    assert.ok(runs.includes(firstRun));
    assert.ok(runs.includes(`${firstRun}-1`));
    assert.deepEqual(fs.readFileSync(firstReport), originalContent);
});

test('does not collect Allure HTML without an explicitly supplied source', t => {
    const directory = createWorkspace(t);

    createReport(directory);
    writeFile(directory, 'allure-report/index.html', 'Previous execution report');

    assertSuccessful(invoke(directory, {
        EVIDENCEFACTORY_ALLURE_REPORT_DIR: '',
    }));

    const runDirectory = path.join(directory, 'test-results', runDirectories(directory)[0]);

    assert.ok(!fs.existsSync(path.join(runDirectory, 'allure/report')));
    assert.ok(fs.existsSync(path.join(directory, 'allure-report/index.html')));
});

test('fails when the native Playwright JSON report is missing', t => {
    const directory = createWorkspace(t);
    const run = invoke(directory);

    assert.ifError(run.error);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /JSON report not found/);
    assert.ok(!fs.existsSync(path.join(directory, 'test-results')));
});

test('fails when the native Playwright JSON report is invalid', t => {
    const directory = createWorkspace(t);

    writeFile(directory, 'results.json', JSON.stringify({ suites: [] }));

    const run = invoke(directory);

    assert.ifError(run.error);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Invalid Playwright JSON report/);
    assert.ok(!fs.existsSync(path.join(directory, 'test-results')));
});