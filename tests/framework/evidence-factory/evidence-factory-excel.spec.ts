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
 * Four data-driven scenarios.
 *
 * TC-003 simulates a failed first attempt
 * followed by a successful retry.
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
 * Execute scenarios across parallel workers.
 */
test.describe.configure({
  mode: 'parallel',
});

for (const scenario of scenarios) {
  test(
    `${scenario.scenarioId} - ${scenario.scenarioName}`,
    async ({}, testInfo) => {
      /**
       * Read the run ID shared by all workers.
       */
      const { runId } = await getTestRunContext();

      /**
       * Stable logical worker identifier.
       *
       * Playwright may restart worker processes,
       * but parallelIndex identifies the same slot.
       */
      const workerId =
        `worker-${testInfo.parallelIndex}`;

      const resultsDir = './results';

      const factory = new EvidenceFactory<EvidenceData>({
        fields: evidenceFields,
        resultsDir,
        runId,
      });

      const store = new FileEvidenceStore<EvidenceData>({
        resultsDir,
        runId,
        workerId,
      });

      /**
       * Record the first attempt.
       */
      const firstStartTime = new Date();
      const firstEndTime = new Date();

      const firstAttempt: Evidence<EvidenceData> = {
        runId,
        workerId,
        attempt: 1,

        scenarioId: scenario.scenarioId,
        scenarioName: scenario.scenarioName,
        status: scenario.status,

        startTime: firstStartTime.toISOString(),
        endTime: firstEndTime.toISOString(),

        durationMs:
          firstEndTime.getTime() -
          firstStartTime.getTime(),

        data: scenario.data,

        ...(scenario.status === EvidenceStatus.FAILED
          ? {
              error: {
                message: 'Simulated scenario failure',
              },
            }
          : {}),
      };

      await factory.record(firstAttempt, store);

      /**
       * TC-003: Simulate a successful retry.
       *
       * Both attempts use:
       * - The same runId
       * - The same workerId
       * - The same scenarioId
       *
       * Only the attempt number and outcome differ.
       */
      if (scenario.scenarioId === 'TC-003') {
        const retryStartTime = new Date();
        const retryEndTime = new Date();

        const retryAttempt: Evidence<EvidenceData> = {
          runId,
          workerId,
          attempt: 2,

          scenarioId: scenario.scenarioId,
          scenarioName: scenario.scenarioName,

          status: EvidenceStatus.PASSED,

          startTime: retryStartTime.toISOString(),
          endTime: retryEndTime.toISOString(),

          durationMs:
            retryEndTime.getTime() -
            retryStartTime.getTime(),

          data: scenario.data,
        };

        await factory.record(retryAttempt, store);

        /**
         * Verify both attempts were recorded
         * in the same worker JSON array.
         */
        const workerEvidence = await store.getAll();

        const tc003Attempts = workerEvidence
          .filter(
            item => item.scenarioId === 'TC-003',
          )
          .sort(
            (a, b) => a.attempt - b.attempt,
          );

        expect(tc003Attempts).toHaveLength(2);

        expect(tc003Attempts[0].status).toBe(
          EvidenceStatus.FAILED,
        );

        expect(tc003Attempts[1].status).toBe(
          EvidenceStatus.PASSED,
        );
      }

      /**
       * Verify the first attempt was recorded.
       */
      expect(firstAttempt.runId).toBe(runId);
      expect(firstAttempt.workerId).toBe(workerId);
      expect(firstAttempt.scenarioId).toBe(
        scenario.scenarioId,
      );
      expect(firstAttempt.status).toBe(
        scenario.status,
      );
    },
  );
}
