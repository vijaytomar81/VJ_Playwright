import {
    readFile,
    rm,
    writeFile,
    mkdir,
} from 'node:fs/promises';

import path from 'node:path';


export interface FileSnapshot {
    filePath: string;

    existed: boolean;

    content?: string;
}


export class FileSnapshotManager {

    async capture(
        filePath: string,
    ): Promise<FileSnapshot> {

        try {

            const content =
                await readFile(
                    filePath,
                    'utf8',
                );


            return {
                filePath,
                existed: true,
                content,
            };

        } catch (error) {

            if (
                this.isFileNotFoundError(
                    error,
                )
            ) {
                return {
                    filePath,
                    existed: false,
                };
            }


            throw error;
        }
    }


    async captureAll(
        filePaths:
            readonly string[],
    ): Promise<readonly FileSnapshot[]> {

        const snapshots:
            FileSnapshot[] = [];


        for (
            const filePath
            of filePaths
        ) {

            snapshots.push(
                await this.capture(
                    filePath,
                ),
            );
        }


        return snapshots;
    }


    async restore(
        snapshot: FileSnapshot,
    ): Promise<void> {

        if (!snapshot.existed) {

            await rm(
                snapshot.filePath,
                {
                    force: true,
                },
            );

            return;
        }


        await mkdir(
            path.dirname(
                snapshot.filePath,
            ),
            {
                recursive: true,
            },
        );


        await writeFile(
            snapshot.filePath,
            snapshot.content ?? '',
            {
                encoding:
                    'utf8',
            },
        );
    }


    async restoreAll(
        snapshots:
            readonly FileSnapshot[],
    ): Promise<void> {

        for (
            const snapshot
            of snapshots
        ) {

            await this.restore(
                snapshot,
            );
        }
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
}