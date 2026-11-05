import fs from 'node:fs/promises';
import path from 'node:path';

export interface TestRunContext {
  runId: string;
  timestamp: string;
}

const resultsDir = './results';

const contextFile = path.join(
  resultsDir,
  '.current-test-run.json',
);

/**
 * Creates a new test run.
 *
 * Call this once before starting the Playwright workers.
 *
 * Timestamp format: YYYYMMDD_HHMMSS (UTC).
 */
export async function initializeTestRun(): Promise<TestRunContext> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .slice(0, 15);

  const context: TestRunContext = {
    runId: `test-run_${timestamp}`,
    timestamp,
  };

  await fs.mkdir(resultsDir, {
    recursive: true,
  });

  await fs.writeFile(
    contextFile,
    JSON.stringify(context, null, 2),
    'utf8',
  );

  return context;
}

/**
 * Reads the run context shared by all Playwright workers
 * and the report-generation test.
 */
export async function getTestRunContext(): Promise<TestRunContext> {
  const content = await fs.readFile(
    contextFile,
    'utf8',
  );

  const context = JSON.parse(content) as TestRunContext;

  if (
    !context.runId ||
    !context.timestamp ||
    context.runId !== `test-run_${context.timestamp}`
  ) {
    throw new Error('Invalid test-run context.');
  }

  return context;
}
