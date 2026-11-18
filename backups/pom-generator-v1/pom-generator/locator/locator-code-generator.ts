export class LocatorCodeGenerator {

    generate(
        descriptor: string,
        pageVariable = 'page',
    ): string {

        if (
            descriptor.startsWith(
                'role=',
            )
        ) {
            return this.generateRole(
                descriptor,
                pageVariable,
            );
        }


        if (
            descriptor.startsWith(
                'label=',
            )
        ) {
            return [
                `${pageVariable}.getByLabel(`,
                `    ${this.quote(
                    this.valueAfter(
                        descriptor,
                        'label=',
                    ),
                )},`,
                '    {',
                '        exact: true,',
                '    },',
                ')',
            ].join('\n');
        }


        if (
            descriptor.startsWith(
                'testid=',
            )
        ) {
            return [
                `${pageVariable}.getByTestId(`,
                `    ${this.quote(
                    this.valueAfter(
                        descriptor,
                        'testid=',
                    ),
                )},`,
                ')',
            ].join('\n');
        }


        if (
            descriptor.startsWith(
                'placeholder=',
            )
        ) {
            return [
                `${pageVariable}.getByPlaceholder(`,
                `    ${this.quote(
                    this.valueAfter(
                        descriptor,
                        'placeholder=',
                    ),
                )},`,
                '    {',
                '        exact: true,',
                '    },',
                ')',
            ].join('\n');
        }


        if (
            descriptor.startsWith(
                'css=',
            )
        ) {
            return [
                `${pageVariable}.locator(`,
                `    ${this.quote(
                    this.valueAfter(
                        descriptor,
                        'css=',
                    ),
                )},`,
                ')',
            ].join('\n');
        }


        throw new Error(
            `Unsupported locator descriptor: ${descriptor}`,
        );
    }


    private generateRole(
        descriptor: string,
        pageVariable: string,
    ): string {

        const match =
            descriptor.match(
                /^role=([^\[]+)\[name="(.*)"\]$/,
            );


        if (!match) {
            throw new Error(
                `Invalid role locator descriptor: ${descriptor}`,
            );
        }


        const [, role, name] =
            match;


        return [
            `${pageVariable}.getByRole(`,
            `    ${this.quote(role)},`,
            '    {',
            `        name: ${this.quote(name)},`,
            '        exact: true,',
            '    },',
            ')',
        ].join('\n');
    }


    private valueAfter(
        descriptor: string,
        prefix: string,
    ): string {

        return descriptor.substring(
            prefix.length,
        );
    }


    private quote(
        value: string,
    ): string {

        return JSON.stringify(value);
    }
}