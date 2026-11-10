
/**
 * EvidenceFactory Excel styling configuration.
 *
 * Customize report appearance here without changing
 * the ExcelJS formatting logic.
 *
 * Colors use #RRGGBB for VS Code Color Picker.
 */

export const EXCEL_STYLE_CONFIG = {
    colors: {
        // Summary worksheet
        summaryTitle: '#1F4E78',
        summaryTitleText: '#FFFFFF',
        summarySection: '#5B7FAF',
        summarySectionText: '#FFFFFF',
        summaryField: '#E5EFF9',
        summaryFieldText: '#202B38',

        // All worksheet
        allHeader: '#4472C4',

        // Passed worksheet and status
        passed: '#70AD47',
        passedLight: '#E2F0D9',
        passedText: '#000000',

        // Failed worksheet and status
        failed: '#BD3038',
        failedLight: '#F3C4C8',
        failedText: '#8D1723',

        // Not Executed worksheet and status
        notExecuted: '#DB790F',
        notExecutedLight: '#FFD998',
        notExecutedText: '#8B4A00',

        // Missing Reporting Fields worksheet
        missingFieldsHeader: '#102846',

        // Summary pass-rate backgrounds
        passRateHigh: '#C7EBCB',
        passRateMedium: '#FFD998',
        passRateLow: '#F3C4C8',
        passRateText: '#102846',

        // Common formatting
        white: '#FFFFFF',
        black: '#202B38',
        border: '#B9C8D7',
    },

    // Pass Rate values are stored from 0 to 100.
    passRateRanges: {
        high: 90,
        medium: 70,
    },

    fonts: {
        name: 'Aptos',
        size: 11,
        titleName: 'Aptos Display',
        titleSize: 16,
        sectionSize: 12,
    },

    /**
     * null = Excel's default row height.
     * Set a number to apply a custom height.
     */
    rowHeights: {
        summaryTitle: 38 as number | null,
        summarySection: null as number | null,
        summaryField: null as number | null,
        evidenceDirectory: null as number | null,
        detailHeader: null as number | null,
        detailData: null as number | null,
    },

    columnWidths: {
        summaryField: 30,
        summaryValue: 105,
        detailMinimum: 16,
        detailMaximum: 55,
    },

    alignment: {
        summaryValue: 'left',
        detailHeader: 'center',
        status: 'center',
    } as const,

    enableTabColors: false,
} as const;
