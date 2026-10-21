import {
  test,
  expect,
} from '../../evidenceFactory/fixtures/evidence.fixture';

import {
  EvidenceData,
} from '../../configLayer/schema/evidence/evidence-schema';

test('TC-001: Verify successful login and evidence reporting', async ({
  page,
  evidence,
}) => {
  await page.goto('https://www.saucedemo.com/');

  await page.locator('[data-test="username"]').fill('standard_user');

  await page.locator('[data-test="password"]').fill('secret_sauce');

  await page.locator('[data-test="login-button"]').click();

  await expect(page).toHaveURL(/inventory\.html/);

  await expect(
    page.locator('[data-test="title"]'),
  ).toHaveText('Products');

  evidence.add({
    [EvidenceData.scenarioId]: 'TC-001',
    [EvidenceData.scenarioName]:
      'Verify successful login and evidence reporting',
  });

  await evidence.screenshot('TC-001-successful-login');
});
