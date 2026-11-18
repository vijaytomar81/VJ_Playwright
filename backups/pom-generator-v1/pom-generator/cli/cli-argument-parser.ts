export interface CliArguments {
    connectCdp:
    string;

    brand:
    string;

    channel:
    string;

    product:
    string;

    pageName:
    string;
}


export class CliArgumentParser {

    async parse(
        args: readonly string[],
    ): Promise<CliArguments> {

        const values =
            this.parseValues(
                args,
            );


        return {
            connectCdp:
                this.required(
                    values,
                    'connectCdp',
                ),

            brand:
                this.required(
                    values,
                    'brand',
                ),

            channel:
                this.required(
                    values,
                    'channel',
                ),

            product:
                this.required(
                    values,
                    'product',
                ),

            pageName:
                this.required(
                    values,
                    'page-name',
                ),
        };
    }


    private parseValues(
        args: readonly string[],
    ): Map<string, string> {

        const values =
            new Map<string, string>();


        for (const argument of args) {

            if (
                !argument.startsWith(
                    '--',
                )
            ) {
                throw new Error(
                    `Invalid CLI argument: ${argument}`,
                );
            }


            const separatorIndex =
                argument.indexOf(
                    '=',
                );


            if (separatorIndex < 3) {
                throw new Error(
                    `CLI arguments must use --name=value format: ${argument}`,
                );
            }


            const name =
                argument.slice(
                    2,
                    separatorIndex,
                );

            const value =
                argument.slice(
                    separatorIndex + 1,
                ).trim();


            if (!value) {
                throw new Error(
                    `CLI argument must not be empty: --${name}`,
                );
            }


            if (values.has(name)) {
                throw new Error(
                    `Duplicate CLI argument: --${name}`,
                );
            }


            values.set(
                name,
                value,
            );
        }


        return values;
    }


    private required(
        values: ReadonlyMap<string, string>,
        name: string,
    ): string {

        const value =
            values.get(
                name,
            );


        if (!value) {
            throw new Error(
                `Missing required CLI argument: --${name}`,
            );
        }


        return value;
    }
}