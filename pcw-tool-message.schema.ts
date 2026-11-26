// src/dataLayer/data-definitions/newBusiness/pcw-tool-message.schema.ts

import type { DataSchema } from "../types";

export const pcwToolMessageSchema: DataSchema = {
    sheetName: "PCW_Tool_Template",
    outputFile: "PCWToolMessage.json",
    dataDefinitionGroup: "newBusiness",

    groups: {
        meta: {
            testCaseId: "TestCaseId",
        },

        pcwTool: {
            sequenceNo: "No",
            requestMessage: "Request Message",
            iql: "IQL",
            pcwToolPortal: "PCW Tool Portal",
            paymentMode: "Payment Mode",
            convertToMonthlyCard: "ConvertToMonthlyCard",
        },
    },

    requiredFields: [
        "TestCaseId",
        "Request Message",
        "IQL",
        "PCW Tool Portal",
        "Payment Mode",
    ],

    optionalFields: [
        "No",
        "ConvertToMonthlyCard",
    ],
};