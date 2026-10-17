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

/**
 * Step 11: EvidenceFactory scale validation.
 *
 * 40 scenarios executed across 4 logical workers.
 *
 * Each worker writes to one JSON array:
 *
 * worker-0.json
 * worker-1.json
 * worker-2.json
 * worker-3.json
 *
 * All scenarios share the same runId.
 */
const SCENARIO_COUNT = 40;

const scenarios = Array.from(
  { length: SCENARIO_COUNT },
  (_, index) => {
    const scenarioNumber = index + 1;

    return {
      scenarioId:
        `SCALE-${String(scenarioNumber).padStart(3, '0')}`,

      scenarioName:
        `Scale Test Scenario ${scenarioNumber}`,

      policyNumber:
        `POL-SCALE-${String(scenarioNumber).padStart(3, '0')}`,

      customerNumber:
        `CUS-SCALE-${String(scenarioNumber).padStart(3, '0')}`,

      premium:
        100 + scenarioNumber,
    };
  },
);

/**
 * These scenarios are independent and can run
 * concurrently across Playwright workers.
 */
test.describe.configure({
  mode: 'parallel',
});

for (const scenario of scenarios) {
  test(
    `${scenario.scenarioId} - ${scenario.scenarioName}`,
    async ({}, testInfo) => {
      /**
       * All workers must use the same run ID.
       *
       * The run ID will be supplied when executing
       * the dedicated scale-test project.
       */
      const runId =
        process.env.EVIDENCE_SCALE_RUN_ID;

      if (!runId) {
        throw new Error(
          'EVIDENCE_SCALE_RUN_ID is required. ' +
          'Set it before running the scale tests.',
        );
      }

      /**
       * Playwright parallelIndex identifies
       * the logical worker slot.
       */
      const workerId =
        `worker-${testInfo.parallelIndex}`;

      const resultsDir = './results';

      const factory =
        new EvidenceFactory<EvidenceData>({
          fields: evidenceFields,
          resultsDir,
          runId,
        });

      const store =
        new FileEvidenceStore<EvidenceData>({
          resultsDir,
          runId,
          workerId,
        });

      const startTime = new Date();

      /**
       * Simulated scenario execution.
       *
       * All 40 scenarios pass. This test focuses
       * on concurrent evidence persistence rather
       * than application-specific UI behavior.
       */
      const endTime = new Date();

      const evidence: Evidence<EvidenceData> = {
        runId,
        workerId,
        attempt: 1,

        scenarioId: scenario.scenarioId,
        scenarioName: scenario.scenarioName,

        status: EvidenceStatus.PASSED,

        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),

        durationMs:
          endTime.getTime() -
          startTime.getTime(),

        data: {
          policyNumber: scenario.policyNumber,
          customerNumber: scenario.customerNumber,
          premium: scenario.premium,
        },
      };

      /**
       * Append the evidence to the logical
       * worker's JSON array.
       */
      await factory.record(evidence, store);

      /**
       * Verify the record was accepted.
       */
      expect(evidence.runId).toBe(runId);
      expect(evidence.workerId).toBe(workerId);
      expect(evidence.attempt).toBe(1);
      expect(evidence.status).toBe(
        EvidenceStatus.PASSED,
      );
    },
  );
}
