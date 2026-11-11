import { test, expect } from '@playwright/test';
import { Pages } from '../../../pages/Pages';
import { attachValueInTestReport } from '../../../../../reportingLayer/reporterHelper';
import {
  getCurrentTimestamp,
  getInteractionId,
  getPolicyNumber,
  fetchAndAttach,
  selectNextAvailableDate,
  selectDateFromDatepicker,
  fetchRefundPrice,
  fetchCoverPriceAfterAddOns,
  getAllPricesForAnnualPayment,
} from '../../../utils/pageUtils.js';
import { AgentPortalMTAGetAdditionalPremiumPrice } from 'automationLayer/ferry/utils/agentPortalUtils';
import annualOnlyData from '../../../data/Regression_AnnualOnlyTC.json';

test('Reg_TC01_Skoda_Annual-Only_Essentials_Annual_Customer-Portal @Reg_TC_01 @AnnualOnlyRegression', async ({
  page,
}) => {
  const pages = new Pages(page);
  const email = `ferrytestkr+${Date.now()}_Reg_TC_01@gmail.com`;
  const tc = annualOnlyData['Reg_TC01_Skoda_Annual-Only_Essentials_Customer-Portal'];

  const policyStartDate = new Date();
  policyStartDate.setDate(policyStartDate.getDate() + Number(tc.CoverStartDay));

  await fetchAndAttach(getCurrentTimestamp, page, 'NBStartTime');

  await test.step('User skips the login or registration page', async () => {
    await pages.base.goto(process.env.SKODA_ANNUAL_JOURNEY_URL);
    await pages.base.acceptCookies();
  });

  await test.step('User navigates through car details page', async () => {
    await pages.nbJourney.carDetails.financialServicesCustomer(tc.FinancialServiceCustomer);
    await pages.nbJourney.carDetails.searchCar(tc.VRN);
    attachValueInTestReport({ VRN: tc.VRN });
  });

  await test.step('User navigates through car details modification page', async () => {
    await fetchAndAttach(getInteractionId, page, 'InteractionID');
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
  });

  await test.step('User enters his personal details', async () => {
    await pages.nbJourney.personalDetails.enterPersonalDetailsWithValidWorkPlace(
      tc.DriverEmploymentStatus,
      tc.Occupation,
      tc.Industry,
      tc.HaveSecondaryOccupation,
      tc.DriverMaritalStatus,
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
      tc.UnspentCriminalConvictions
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
      tc.AddAnotherDriverToPolicy
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
    await getAllPricesForAnnualPayment(page);
    await pages.nbJourney.quote.selectTier(tc.CoverTier);
    await pages.nbJourney.quote.dontSelectMLEandGHC();
    await pages.nbJourney.quote.clickNextButton();
  });

  await test.step('User lands on quote summary page', async () => {
    await fetchCoverPriceAfterAddOns(page, 'CoverPriceAfterAddOns');
    await pages.nbJourney.quoteSummary.acceptTermsAndConditions();
  });

  await test.step('User enters password and creates account', async () => {
    await pages.nbJourney.createAccount.enterPasswordAndCreateAccount();
  });

  await test.step('User enters verification code and continues', async () => {
    await pages.nbJourney.verifyAccount.verifyUserEmail(email);
  });

  await test.step('User lands on payment page', async () => {
    await pages.common.payment.fillPaymentDetailsForCustomerPortal(
      tc.CardName,
      tc.CardNumber,
      tc.ExpiryMM,
      tc.ExpiryYYYY,
      tc.SecurityCode
    );
    attachValueInTestReport({ CardNumber: tc.CardNumber });
  });

  await test.step('User lands on Dashboard', async () => {
    await pages.dashboard.landing.getStartedButton();
    await pages.dashboard.landing.skipTour();
    await fetchAndAttach(getPolicyNumber, page, 'AnnualCoverPolicyNumber');
  });

  //MTA1 - Customer portal - Change Address - Change PH Address - Refund premium
  await test.step('MTA1 - Start journey and fill change address details', async () => {
    await pages.dashboard.landing.clickAccountDetails();
    await pages.dashboard.mtaChangeAddress.changeAddressMTAJourney('5', 'EX391HZ');
  });

  await test.step('MTA1 - Quote summary page', async () => {
    await fetchAndAttach(getInteractionId, page, 'MTA1InteractionID');
    await fetchAndAttach(fetchRefundPrice, page, 'MTA1RefundPrice');
    await pages.dashboard.mtaChangeAddress.clickNextButton();
  });

  await test.step('MTA1 - Quote summary page and finish journey', async () => {
    await pages.dashboard.mtaChangeAddress.changeAddressMTAJourneyFinalSummaryPage();
    await pages.dashboard.policySummaryPage.popupConfirmation();
  });

  await test.step('MTA1 - Assert that address has been changed', async () => {
    await pages.dashboard.policySummaryPage.clickBackButton();
    await pages.dashboard.landing.clickAccountDetails();
    await expect(pages.dashboard.mtaChangeAddress.inspectInformationPanel()).toContainText(
      '5 SKERN WAY, NORTHAM,'
    );
  });

  await test.step('Navigate to Agent portal and declare new tab', async () => {
    await pages.agentPortal.landing.openAgentPortalAndNavigateToUserPage(email, 'EX391HZ');

    const popup = await page.waitForEvent('popup');
    const userPage = new Pages(popup);

    //MTA2 - Agent Portal - Add Driver - Add One Drivers during NB Policy period - Additional Premium
    await test.step('MTA2 - Start journey and fetch interaction ID', async () => {
      await userPage.agentPortal.customerScreen.clickFirstMTADropdown();
      await userPage.agentPortal.customerScreen.startAddDriverMTAJourney();
      await fetchAndAttach(getInteractionId, popup, 'MTA2InteractionID');
    });

    await test.step('MTA2 - Add additional driver fill licence details page', async () => {
      await userPage.agentPortal.ad1Licence.enterPolicyholderDetailsWithoutDLN(
        'No',
        'Mr',
        'GoergeFirst',
        'LastNameSecond',
        '05',
        '05',
        '1998',
        '27',
        'CO30QY',
        'UK Full',
        '8 or more years',
        'No'
      );
    });

    await test.step('MTA2 - Add additional driver fill personal details page', async () => {
      await userPage.agentPortal.ad1PersonalDetails.enterPersonalDetailsWithoutValidWorkPlace(
        'Retired',
        'No',
        'Married',
        'Child',
        'Yes'
      );
    });

    await test.step('MTA2 - Add additional driver answers claims page', async () => {
      await userPage.agentPortal.ad1Claims.claimsQuestionNo();
    });

    await test.step('MTA2 - Add additional driver dont add another driver', async () => {
      await userPage.agentPortal.addDriver.addAdditionalDriverAgainNo();
    });

    await test.step('MTA2 - Declare main driver for the car', async () => {
      await userPage.agentPortal.addDriverJourneyMainDriver.clickNextButton();
    });

    await test.step('MTA2 - Start date page', async () => {
      const selectedDay2 = await selectNextAvailableDate(popup);
      attachValueInTestReport({ MTA2StartDate: selectedDay2 });
    });

    await test.step('MTA2 - Quote summary page, click next button only', async () => {
      await userPage.agentPortal.addDriverQuoteSummary.clickEmailPreference();
    });

    await test.step('MTA2 - Payment page and fetch premium price', async () => {
      await fetchAndAttach(
        AgentPortalMTAGetAdditionalPremiumPrice,
        popup,
        'MTA2AdditionalPremiumPrice'
      );
      await userPage.agentPortal.replaceCarPayment.clickAddNewCardButton();
      await userPage.agentPortal.replaceCarPayment.agentPortalMTAFillPaymentDetailsCardRegisteredAtSameAddress(
        tc.CardNumber,
        tc.CardExpiryAgentPortal,
        tc.SecurityCode
      );
    });

    await test.step('MTA2 - Payment page and fetch premium price', async () => {
      await userPage.agentPortal.customerScreen.clickSecondMTADropdown();
      await expect(userPage.agentPortal.customerScreen.rootContainer()).toContainText(
        'MTA: Support Add Additional Driver'
      );
    });
  });
});
