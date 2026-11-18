import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
    GeneratedPage,
} from '../models/page.model';

import {
    MetadataPathBuilder,
} from './metadata-path-builder';


export class MetadataStore {

    constructor(
        private readonly pathBuilder =
            new MetadataPathBuilder(),
    ) { }


    async save(
        page: GeneratedPage,
    ): Promise<string> {

        const filePath =
            this.pathBuilder.build(
                page,
            );


        await this.ensureDirectory(
            filePath,
        );


        await writeFile(
            filePath,
            this.serialize(
                page,
            ),
            {
                encoding:
                    'utf8',
            },
        );


        return filePath;
    }


    async saveIfMissing(
        page: GeneratedPage,
    ): Promise<string | undefined> {

        const filePath =
            this.pathBuilder.build(
                page,
            );


        await this.ensureDirectory(
            filePath,
        );


        try {

            await writeFile(
                filePath,
                this.serialize(
                    page,
                ),
                {
                    encoding:
                        'utf8',

                    flag:
                        'wx',
                },
            );


            return filePath;

        } catch (error) {

            if (
                this.isFileExistsError(
                    error,
                )
            ) {
                return undefined;
            }


            throw error;
        }
    }


    async load(
        page: GeneratedPage,
    ): Promise<GeneratedPage | undefined> {

        const filePath =
            this.pathBuilder.build(
                page,
            );


        try {

            const content =
                await readFile(
                    filePath,
                    'utf8',
                );


            return JSON.parse(
                content,
            ) as GeneratedPage;

        } catch (error) {

            if (
                this.isFileNotFoundError(
                    error,
                )
            ) {
                return undefined;
            }


            throw error;
        }
    }


    private async ensureDirectory(
        filePath: string,
    ): Promise<void> {

        await mkdir(
            path.dirname(
                filePath,
            ),
            {
                recursive: true,
            },
        );
    }


    private serialize(
        page: GeneratedPage,
    ): string {

        return (
            JSON.stringify(
                page,
                null,
                2,
            ) +
            '\n'
        );
    }


    private isFileNotFoundError(
        error: unknown,
    ): boolean {

        return (
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT'
        );
    }


    private isFileExistsError(
        error: unknown,
    ): boolean {

        return (
            error instanceof Error &&
            'code' in error &&
            error.code === 'EEXIST'
        );
    }
}