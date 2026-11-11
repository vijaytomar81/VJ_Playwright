import { test } from '@playwright/test';
import { Pages } from 'automationLayer/athena/carInsurance/britannia/pages/Pages';
import britanniaDJData from '../../../data/Britannia_NB.json';
import {
  fetchAndAttach,
  getCurrentTimestamp,
  getPolicyNumber,
  getInteractionId,
  fetchCoverPriceAfterAddOns,
  selectDateFromDatepicker,
  getAllOptionalExtraPrice,
  getAllCoverPricesForAnnualPayment,
} from '../../../utils/pageUtils.js';
import { attachValueInTestReport } from 'reportingLayer/reporterHelper';

test('TC1_BRI_DJ_PRE_NB001 @Britannia_Premier @Bri_Premier_Annual @Bri_Annual', async ({
  page,
}) => {
  const pages = new Pages(page);
  const email = `bri.test.team+${Date.now()}@gmail.com`;
  const tc = britanniaDJData['BRI_DJ_PRE_NB001'];
  const policyStartDate = new Date();
  policyStartDate.setDate(policyStartDate.getDate() + Number(tc.CoverStartDay));

  await fetchAndAttach(getCurrentTimestamp, page, 'NBStartTime');

  await test.step('User skips the login page', async () => {
    await pages.base.goto(process.env.CUSTOMER_PORTAL_ANNUAL_MOTOR_JOURNEY_URL);
    await pages.base.acceptCookies();
  });

  await test.step('User navigates through car details page', async () => {
    await pages.nbJourney.carDetails.searchCar(tc.VRN);
    attachValueInTestReport({ VRN: tc.VRN });
    await fetchAndAttach(getInteractionId, page, 'InteractionID');
  });

  await test.step('User navigates through car details modification page', async () => {
    await pages.nbJourney.carDetailsModification.modificationDetails(
      tc.AboveDetailsCorrect,
      tc.DoesCarHaveModifications
    );
  });

  await test.step('User navigates through driving licence details page', async () => {
    await pages.nbJourney.drivingLicence.enterPolicyholderDetailsWithoutDLN(
      tc.HaveDrivingLicenceHandy,
      tc.Title,
      tc.Firstname,
      tc.Lastname,
      tc.DOBDay,
      tc.DOBMonth,
      tc.DOBYear,
      tc.HouseNo,
      tc.Postcode,
      tc.LicenceType,
      tc.LicenceHeldYears,
      tc.HaveMotoringConvictions
    );
    await pages.nbJourney.drivingLicence.clickNextButton();
  });

  await test.step('User enters his personal details', async () => {
    await pages.nbJourney.personalDetails.enterPersonalDetailsIfUserIsStudent(
      tc.EmploymentStatus,
      tc.Occupation,
      tc.HaveSecondaryOccupation,
      tc.MaritalStatus,
      email,
      tc.Phone,
      tc.DoYouOwnYourHome,
      tc.UKRresidentForMoreThan3Years
    );
    attachValueInTestReport({ Email: email });
  });

  await test.step('User enters his claims and conviction details', async () => {
    await pages.nbJourney.claimsAndConvictions.claimsQuestion(tc.HadClaimsAnswer);
    await pages.nbJourney.claimsAndConvictions.unspentConvictionsQuestion(
      tc.HaveNonMotoringConviction
    );
  });

  await test.step('User enters his NCD details', async () => {
    await pages.nbJourney.ncdDetails.ncdYearsQuestion(tc.NCDYears);
    await pages.nbJourney.ncdDetails.earnedNCDQuestion(tc.HowWasNCDEarned);
    await pages.nbJourney.ncdDetails.selectProtectedNcd(tc.WantToProtectNCD);
    await pages.nbJourney.ncdDetails.clickNextButton();
  });

  await test.step('User enters add additional driver page', async () => {
    await pages.nbJourney.addAdditionalDriver.addAdditionalDriverQuestion(
      tc.AD1AddAnotherDriverToPolicy
    );
  });

  await test.step('User enters details in car usage page', async () => {
    await pages.nbJourney.carUsage.enterCarUsageDetails(
      tc.RegKeeper,
      tc.LegalOwner,
      tc.Mileage,
      tc.IsVehicleStoredAtHomeAddress,
      tc.CarStoredPlace,
      tc.NoOfCarsAtHome,
      tc.CarUsageType
    );
  });

  await test.step('User lands on start date page', async () => {
    const selectedDate = await selectDateFromDatepicker(page, policyStartDate);
    attachValueInTestReport({ AnnualCoverStartDate: selectedDate });
  });

  await test.step('User lands on quote page', async () => {
    await getAllCoverPricesForAnnualPayment(page);
    await pages.common.yourQuote.selectBritanniaPremierCover();
    await pages.common.yourQuote.selectBreakDownCover(tc.breakDownOption);
    await pages.common.yourQuote.selectVoluntaryExcessAmount(tc.VoluntaryExcess);
    await getAllOptionalExtraPrice(page);
    await pages.common.yourQuote.clickNextButton();
  });

  await test.step('User lands on quote summary page', async () => {
    await fetchCoverPriceAfterAddOns(page, 'CoverPriceAfterAddOns');
    await pages.common.quoteSummary.acceptTermsAndConditions();
  });

  await test.step('User enters password and creates account', async () => {
    await pages.base.acceptCookies();
    await pages.globalPages.createAccount.enterPasswordAndCreateAccount();
  });

  await test.step('User enters verification code and continues', async () => {
    await pages.nbJourney.verifyAccount.verifyUserEmail(email);
  });

  await test.step('User lands on payment page', async () => {
    await pages.globalPages.payment.fillPaymentDetailsForCustomerPortal(
      tc.CardName,
      tc.CardNumber,
      tc.ExpiryMM,
      tc.ExpiryYYYY,
      tc.SecurityCode
    );
    attachValueInTestReport({ CardNumber: tc.CardNumber });
  });

  await test.step('User lands on Dashboard', async () => {
    await pages.common.dashBoard.getStartedButton();
    await pages.common.dashBoard.skipTour();
    await fetchAndAttach(getPolicyNumber, page, 'AnnualCoverPolicyNumber');
  });
});
