// AUTO-GENERATED FILE.
// Changes may be overwritten by the POM generator.
// pageKey: login
// scannedAt: 2026-11-13T17:56:36.346Z

import type {
    Locator,
    Page,
} from '@playwright/test';

export class LoginPage {

    readonly linkToAllianzHomePageLink: Locator;
    readonly logInLink: Locator;
    readonly donTHaveAPolicyWithUsGetANewQuoteLink: Locator;
    readonly openTrustSealButton: Locator;
    readonly complaintsLink: Locator;
    readonly ourCookiePolicyLink: Locator;
    readonly personalDataRightsLink: Locator;
    readonly manageCookiesButton: Locator;

    constructor(
        page: Page,
    ) {

        this.linkToAllianzHomePageLink =
            page.getByRole(
                "link",
                {
                    name: "Link to Allianz home page",
                    exact: true,
                },
            );

        this.logInLink =
            page.getByRole(
                "link",
                {
                    name: "Log in",
                    exact: true,
                },
            );

        this.donTHaveAPolicyWithUsGetANewQuoteLink =
            page.getByRole(
                "link",
                {
                    name: "Don’t have a policy with us, get a new quote",
                    exact: true,
                },
            );

        this.openTrustSealButton =
            page.getByRole(
                "button",
                {
                    name: "Open Trust Seal",
                    exact: true,
                },
            );

        this.complaintsLink =
            page.getByRole(
                "link",
                {
                    name: "Complaints",
                    exact: true,
                },
            );

        this.ourCookiePolicyLink =
            page.getByRole(
                "link",
                {
                    name: "Our cookie policy",
                    exact: true,
                },
            );

        this.personalDataRightsLink =
            page.getByRole(
                "link",
                {
                    name: "Personal data rights",
                    exact: true,
                },
            );

        this.manageCookiesButton =
            page.getByRole(
                "button",
                {
                    name: "Manage Cookies",
                    exact: true,
                },
            );
    }
}
