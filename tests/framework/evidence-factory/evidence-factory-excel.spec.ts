import { test, expect } from '@playwright/test';

import {
  EvidenceFactory,
  EvidenceStatus,
  FileEvidenceStore,
  type Evidence,
} from '../../../evidenceFactory';

import {
  evidenceFields,
  type EvidenceData,
} from '../../../configLayer/schema/evidence/evidence-schema';

import {
  getTestRunContext,
} from './test-run-context';

/**
 * Test scenarios executed by parallel Playwright workers.
 *
 * Each scenario records its own raw evidence.
 * The final Excel report is generated separately.
 */
const scenarios = [
  {
    scenarioId: 'TC-001',
    scenarioName: 'Create Policy',
    status: EvidenceStatus.PASSED,
    data: {
      policyNumber: 'POL-1001',
      customerNumber: 'CUS-1001',
      premium: 150.50,
    },
  },
  {
    scenarioId: 'TC-002',
    scenarioName: 'Update Policy',
    status: EvidenceStatus.PASSED,
    data: {
      policyNumber: 'POL-1002',
      customerNumber: 'CUS-1002',
      premium: 200.75,
    },
  },
  {
    scenarioId: 'TC-003',
    scenarioName: 'Cancel Policy',
    status: EvidenceStatus.FAILED,
    data: {
      policyNumber: 'POL-1003',
      customerNumber: 'CUS-1003',
    },
  },
  {
    scenarioId: 'TC-004',
    scenarioName: 'Renew Policy',
    status: EvidenceStatus.NOT_EXECUTED,
    data: {},
  },
];

/**
 * All four scenarios can execute in parallel.
 */
test.describe.configure({
  mode: 'parallel',
});

for (const scenario of scenarios) {
  test(
    `${scenario.scenarioId} - ${scenario.scenarioName}`,
    async ({}, testInfo) => {
      /**
       * Read the shared execution context.
       *
       * All workers receive the same runId.
       */
      const { runId } = await getTestRunContext();

      /**
       * Worker ID comes from Playwright.
       *
       * In production, executionFactory will
       * supply this identifier.
       */
      const workerId = `worker-${testInfo.workerIndex}`;

      const resultsDir = './results';

      /**
       * Initialize EvidenceFactory.
       */
      const factory = new EvidenceFactory<EvidenceData>({
        fields: evidenceFields,
        resultsDir,
        runId,
      });

      /**
       * Each worker writes evidence into its own folder.
       */
      const store = new FileEvidenceStore<EvidenceData>({
        resultsDir,
        runId,
        workerId,
      });

      const startTime = new Date();

      /**
       * Simulate scenario execution.
       */
      const endTime = new Date();

      /**
       * Prepare evidence for the scenario.
       */
      const evidence: Evidence<EvidenceData> = {
        runId,
        workerId,
        attempt: 1,

        scenarioId: scenario.scenarioId,
        scenarioName: scenario.scenarioName,
        status: scenario.status,

        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),

        durationMs:
          endTime.getTime() - startTime.getTime(),

        data: scenario.data,

        ...(scenario.status === EvidenceStatus.FAILED
          ? {
              error: {
                message: 'Simulated scenario failure',
              },
            }
          : {}),
      };

      /**
       * Store raw evidence.
       */
      await factory.record(evidence, store);

      /**
       * Verify the evidence was recorded.
       */
      expect(evidence.runId).toBe(runId);
      expect(evidence.workerId).toBe(workerId);
      expect(evidence.scenarioId).toBe(scenario.scenarioId);
      expect(evidence.status).toBe(scenario.status);
    },
  );
}
