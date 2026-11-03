import {
    test,
    expect,
} from '../../evidenceFactory/fixtures/evidence.fixture';

import {
    EvidenceData,
} from '../../configLayer/schema/evidence/evidence-schema';

test('TC-RETRY-001: Verify evidence retry handling', async ({
    page,
    evidence,
}, testInfo) => {
    evidence.add({
        [EvidenceData.scenarioId]: 'TC-RETRY-001',
        [EvidenceData.scenarioName]:
            'Verify evidence retry handling',
    });

    await page.goto('https://www.saucedemo.com/');

    /*
     * Fail the first attempt deliberately.
     * Pass the retry.
     */
    expect(
        testInfo.retry,
        'First attempt intentionally fails',
    ).toBeGreaterThan(0);

    await expect(page).toHaveTitle(/Swag Labs/);

    await evidence.screenshot('retry-success');
});