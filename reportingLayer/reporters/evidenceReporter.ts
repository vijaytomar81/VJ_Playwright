import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
    Reporter,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';

import reportPaths from '../../configLayer/execution/reportPaths.json';
import { generateEvidenceFactory } from '../evidenceFactory';

export default class EvidenceReporter implements Reporter {
    private readonly invocationStartedAt = Date.now();
    private executionStarted = false;

    onTestBegin(_test: TestCase, _result: TestResult): void {
        this.executionStarted = true;
    }

    async onExit(): Promise<void> {
        if (process.env.EVIDENCEFACTORY_AUTO_GENERATE === 'false') {
            return;
        }

        if (!this.executionStarted) {
            return;
        }

        try {
            const jsonFile = resolve(reportPaths.json);

            if (!existsSync(jsonFile)) {
                console.warn(
                    'EvidenceFactory: automatic generation skipped. Native JSON report is missing.',
                );
                return;
            }

            const jsonStats = statSync(jsonFile);

            if (
                !jsonStats.isFile() ||
                jsonStats.mtimeMs < this.invocationStartedAt
            ) {
                console.warn(
                    'EvidenceFactory: automatic generation skipped. Native JSON report is invalid or stale.',
                );
                return;
            }

            await generateEvidenceFactory(this.invocationStartedAt);
        } catch (error) {
            console.error(
                'EvidenceFactory: automatic report generation failed.',
                error,
            );
        }
    }
}
