import {
    test,
    expect,
} from '@playwright/test';

import {
    CliArgumentParser,
} from '../../../tools/pom-generator/cli/cli-argument-parser';


test.describe(
    'CliArgumentParser',
    () => {

        const parser =
            new CliArgumentParser();


        test(
            'should parse all required CREATE arguments',
            async () => {

                const result =
                    await parser.parse([
                        '--connectCdp=ws://localhost:9222/devtools/browser/123',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]);


                expect(result)
                    .toEqual({
                        connectCdp:
                            'ws://localhost:9222/devtools/browser/123',

                        brand:
                            'AZO',

                        channel:
                            'CTM',

                        product:
                            'Motor',

                        pageName:
                            'Policyholder Details',
                    });
            },
        );


        test(
            'should preserve equals characters inside values',
            async () => {

                const result =
                    await parser.parse([
                        '--connectCdp=ws://localhost/path?token=abc=123',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]);


                expect(result.connectCdp)
                    .toBe(
                        'ws://localhost/path?token=abc=123',
                    );
            },
        );


        test(
            'should reject missing CDP argument',
            async () => {

                await expect(
                    parser.parse([
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]),
                ).rejects.toThrow(
                    'Missing required CLI argument: --connectCdp',
                );
            },
        );


        test(
            'should reject missing brand',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp=ws://localhost:9222',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]),
                ).rejects.toThrow(
                    'Missing required CLI argument: --brand',
                );
            },
        );


        test(
            'should reject missing channel',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp=ws://localhost:9222',
                        '--brand=AZO',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]),
                ).rejects.toThrow(
                    'Missing required CLI argument: --channel',
                );
            },
        );


        test(
            'should reject missing product',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp=ws://localhost:9222',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--page-name=Policyholder Details',
                    ]),
                ).rejects.toThrow(
                    'Missing required CLI argument: --product',
                );
            },
        );


        test(
            'should reject missing page name',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp=ws://localhost:9222',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                    ]),
                ).rejects.toThrow(
                    'Missing required CLI argument: --page-name',
                );
            },
        );


        test(
            'should reject empty values',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp=ws://localhost:9222',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=',
                    ]),
                ).rejects.toThrow(
                    'CLI argument must not be empty: --page-name',
                );
            },
        );


        test(
            'should reject invalid argument format',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]),
                ).rejects.toThrow(
                    'CLI arguments must use --name=value format: --connectCdp',
                );
            },
        );


        test(
            'should reject duplicate arguments',
            async () => {

                await expect(
                    parser.parse([
                        '--connectCdp=ws://one',
                        '--connectCdp=ws://two',
                        '--brand=AZO',
                        '--channel=CTM',
                        '--product=Motor',
                        '--page-name=Policyholder Details',
                    ]),
                ).rejects.toThrow(
                    'Duplicate CLI argument: --connectCdp',
                );
            },
        );

    },
);