import { initializeTestRun } from './test-run-context';

async function main(): Promise<void> {
  const context = await initializeTestRun();

  console.log(`Run ID: ${context.runId}`);
  console.log(`Timestamp: ${context.timestamp}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
