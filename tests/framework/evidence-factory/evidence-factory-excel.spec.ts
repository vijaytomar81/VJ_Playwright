import { test } from '@playwright/test';

import {
  type EvidenceData,
} from '../../../configLayer/schema/evidence/evidence-schema';

import {
  EvidenceFactory,
  EvidenceStatus,
  FileEvidenceStore,
  type Evidence,
} from '../../../evidenceFactory';

const runId = 'evidence-four-workers';
const resultsDir = './results';

const evidenceFactory =
  new EvidenceFactory<EvidenceData>({
    fields: [],
    resultsDir,
    runId,
  });

test.describe.configure({ mode: 'parallel' });

test.describe('Four worker evidence generation', () => {
  const scenarios = [
    {
      id: 'TC-001',
      name: 'Create Policy',
      status: EvidenceStatus.PASSED,
      data: {
        policyNumber: 'POL-10001',
        customerNumber: 'CUS-10001',
        premium: 100.50,
      },
    },
    {
      id: 'TC-002',
      name: 'Create Customer',
      status: EvidenceStatus.PASSED,
      data: {
        policyNumber: 'POL-10002',
        customerNumber: 'CUS-10002',
        premium: 200.75,
      },
    },
    {
      id: 'TC-003',
      name: 'Update Policy',
      status: EvidenceStatus.FAILED,
      data: {
        policyNumber: 'POL-10003',
        customerNumber: 'CUS-10003',
        premium: 300.25,
      },
    },
    {
      id: 'TC-004',
      name: 'Cancel Policy',
      status: EvidenceStatus.NOT_EXECUTED,
      data: {
        policyNumber: 'POL-10004',
        customerNumber: 'CUS-10004',
        premium: 400.00,
      },
    },
  ] satisfies Array<{
    id: string;
    name: string;
    status: EvidenceStatus;
    data: EvidenceData;
  }>;

  for (const scenario of scenarios) {
    test(scenario.name, async ({}, testInfo) => {
      const workerId =
        `worker-${testInfo.workerIndex}`;

      const store =
        new FileEvidenceStore<EvidenceData>({
          resultsDir,
          runId,
          workerId,
        });

      const start = Date.now();

      await new Promise<void>((resolve) =>
        setTimeout(resolve, 500),
      );

      const evidence: Evidence<EvidenceData> = {
        runId,
        workerId,
        attempt: 1,

        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: scenario.status,

        startTime: new Date(start).toISOString(),
        endTime: new Date().toISOString(),
        durationMs: Date.now() - start,

        data: scenario.data,

        ...(scenario.status === EvidenceStatus.FAILED
          ? {
              error: {
                message: 'Simulated policy update failure',
              },
            }
          : {}),
      };

      await evidenceFactory.record(evidence, store);

      console.log(
        `[${workerId}] Evidence saved: ${scenario.id}`,
      );
    });
  }
});
