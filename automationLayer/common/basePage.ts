import { errors, Page } from '@playwright/test';
import { ACTION_TIMEOUT } from 'configLayer/execution/timeouts';

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }
  setPage(page: Page): void {
    this.page = page;
  }

  async goto(url: string) {
    await this.page.goto(url);
  }

  async acceptCookies() {
    const acceptButton = this.page.getByRole('button', { name: 'Accept All', exact: true });
    try {
      await acceptButton.waitFor({ state: 'visible', timeout: 7000 });
    } catch (error) {
      // Only an absent optional banner is expected. Browser/locator failures must surface.
      if (!(error instanceof errors.TimeoutError)) throw error;
      return;
    }
    try {
      await acceptButton.click();
    } catch (error) {
      // Consent can finish asynchronously after the banner was observed. A vanished
      // button is safe only when its blocking overlay has also gone.
      if (
        error instanceof errors.TimeoutError &&
        !(await acceptButton.isVisible()) &&
        !(await this.page.locator('.onetrust-pc-dark-filter:visible').first().isVisible())
      )
        return;
      throw error;
    }
  }

  async clickNextButton() {
    await this.waitForOverlayToDisappear();
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async clickGetAQuoteButton() {
    await this.page.getByRole('button', { name: 'Get a quote', exact: true }).click();
  }

  async clickSubmitButton() {
    await this.page.getByRole('button', { name: 'Submit' }).click();
  }

  async clickAllDoneButton() {
    await this.page.getByRole('button', { name: 'All done' }).click();
  }

  async popupConfirmation() {
    const understand = this.page.getByRole('button', { name: 'Ok, I understand' });
    await understand.waitFor({ state: 'visible' });
    await understand.click({ force: true });
  }

  async getStartedButton() {
    const button = this.page.getByRole('button', { name: 'Get started' });
    await button.waitFor({ state: 'visible', timeout: 50000 });
    await button.click();
  }

  async clickBackButton() {
    await this.page.getByRole('button', { name: 'Back' }).first().click();
  }

  async clickSaveAndConfirmButton() {
    await this.page.getByRole('button', { name: 'Save and confirm' }).click();
  }

  async clickSaveButton() {
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async upgradeTierPopUpNoThanks() {
    await this.page.getByRole('dialog').getByRole('button', { name: 'No, thanks' }).click();
  }

  async changeVoluntaryExcess(newValue: string) {
    await this.page.locator('#carExcess').selectOption(newValue);
  }

  async termsAndConditionsCheckbox() {
    await this.page.locator('label').filter({ hasText: 'I confirm the cover I’ve' }).click();
  }

  async selectTier(tierName: string) {
    const tier = this.page
      .locator('.tier-name', { hasText: new RegExp(`^${tierName.trim()}$`) })
      .first();

    await tier.waitFor({ state: 'visible' });
    await tier.click();
  }

  async clickBackToCustomerButtonAgentPortal() {
    await this.page.getByRole('link', { name: 'Back to customer', exact: true }).click();
  }

  async clickPayButtonAgentPortal() {
    await this.page.locator('button.btn.btn-primary.btn-next', { hasText: /^Pay/ }).click();
  }

  async agentPortalPayWithSameCard() {
    await this.page.getByRole('button', { name: /Pay with/i }).click();
  }

  async customerPageAgentPortal() {
    await this.page.getByRole('button', { name: 'Customer page' }).click();
  }

  async waitForElementToBeVisibleInAgentPortalCustomerPage() {
    await this.page
      .locator('#copyUserID')
      .waitFor({ state: 'visible', timeout: 3 * ACTION_TIMEOUT });
  }

  async clickNoThanksButtonHome() {
    const button = this.page.getByRole('button', { name: 'No, thanks' });
    const isVisible = await button
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (isVisible) {
      await button.click();
    }
  }

  async clickOkIUnderstandHome() {
    const button = this.page.getByRole('button', { name: 'Ok, I understand' });
    const isVisible = await button
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (isVisible) {
      await button.click();
    }
  }

  rootContainer() {
    return this.page.locator('#root');
  }

  inspectInformationPanel() {
    return this.page.locator('.plugin.plugin-panel');
  }

  //TODO: this method should be moved to and appropriate class which represents basePage for Lv project
  async waitForOverlayToDisappear(): Promise<void> {
    const overlay = this.page.locator('.overlay').nth(1);
    try {
      //Overlay may not be instantly shown as the page loads, so we need to wait sometime to be sure that it won't appear
      await overlay.waitFor({
        state: 'visible',
        timeout: 1500,
      });
    } catch {
      //If overlay is not shown
      return;
    }
    //If overlay is shown, wait for it to disappear
    await overlay.waitFor({
      state: 'hidden',
      timeout: 30000,
    });
  }
}
