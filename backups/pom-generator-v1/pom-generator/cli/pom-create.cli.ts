import {
    CliArgumentParser,
} from './cli-argument-parser';

import {
    CdpBrowserConnector,
} from '../browser/cdp-browser-connector';

import {
    CreateRunner,
} from '../runners/create-runner';

import {
    isValidBrand,
    isValidChannel,
    isValidProduct,
} from '../../../configLayer/config';

import type {
    BusinessConfiguration,
} from '../../../configLayer/config.types';


async function main(): Promise<void> {

    const parser =
        new CliArgumentParser();


    const args =
        await parser.parse(
            process.argv.slice(2),
        );


    const configuration =
        resolveConfiguration(
            args.brand,
            args.channel,
            args.product,
        );


    const connector =
        new CdpBrowserConnector();


    const connection =
        await connector.connect(
            args.connectCdp,
        );


    try {

        const runner =
            new CreateRunner();


        const result =
            await runner.run(
                connection.page,
                {
                    ...configuration,

                    pageName:
                        args.pageName,
                },
            );


        console.log(
            '\nPOM created successfully.',
        );

        console.log(
            `Elements: ${result.pom.elementsFile}`,
        );

        console.log(
            `Page: ${result.pom.pageFile}`,
        );

        console.log(
            `Actions: ${result.pom.actionsFile}`,
        );

        console.log(
            `Metadata: ${result.metadataFile}`,
        );

    } finally {

        await connection.disconnect();
    }
}


function resolveConfiguration(
    brandValue: string,
    channelValue: string,
    productValue: string,
): BusinessConfiguration {

    if (
        !isValidBrand(
            brandValue,
        )
    ) {
        throw new Error(
            `Unsupported brand: ${brandValue}`,
        );
    }


    if (
        !isValidChannel(
            brandValue,
            channelValue,
        )
    ) {
        throw new Error(
            `Channel '${channelValue}' is not configured ` +
            `for brand '${brandValue}'.`,
        );
    }


    if (
        !isValidProduct(
            brandValue,
            channelValue,
            productValue,
        )
    ) {
        throw new Error(
            `Product '${productValue}' is not configured ` +
            `for ${brandValue}/${channelValue}.`,
        );
    }


    return {
        brand:
            brandValue,

        channel:
            channelValue,

        product:
            productValue,
    };
}


main()
    .catch(
        error => {

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);


            console.error(
                `\nPOM CREATE failed: ${message}`,
            );


            process.exitCode = 1;
        },
    );