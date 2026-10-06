import {
    mkdir,
    writeFile,
} from 'node:fs/promises';

import path from 'node:path';


export class FileWriter {

    async write(
        filePath: string,
        content: string,
    ): Promise<void> {

        await this.ensureDirectory(
            filePath,
        );

        await writeFile(
            filePath,
            content,
            {
                encoding: 'utf8',
            },
        );
    }


    async writeIfMissing(
        filePath: string,
        content: string,
    ): Promise<boolean> {

        await this.ensureDirectory(
            filePath,
        );

        try {
            await writeFile(
                filePath,
                content,
                {
                    encoding: 'utf8',
                    flag: 'wx',
                },
            );

            return true;

        } catch (error) {

            if (
                this.isFileExistsError(
                    error,
                )
            ) {
                return false;
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