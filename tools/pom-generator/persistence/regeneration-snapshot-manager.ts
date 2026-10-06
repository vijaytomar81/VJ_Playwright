import type {
    GeneratedPage,
} from '../models/page.model';

import {
    OutputPathBuilder,
} from '../writers/output-path-builder';

import {
    MetadataPathBuilder,
} from '../metadata/metadata-path-builder';

import type {
    FileSnapshot,
} from './file-snapshot-manager';

import {
    FileSnapshotManager,
} from './file-snapshot-manager';


export type RegenerationSnapshotMode =
    | 'CREATE'
    | 'UPDATE';


export interface RegenerationSnapshot {
    files:
    readonly FileSnapshot[];
}


export class RegenerationSnapshotManager {

    constructor(
        private readonly outputPathBuilder =
            new OutputPathBuilder(),

        private readonly metadataPathBuilder =
            new MetadataPathBuilder(),

        private readonly fileSnapshotManager =
            new FileSnapshotManager(),
    ) { }


    async capture(
        page: GeneratedPage,
        mode: RegenerationSnapshotMode,
    ): Promise<RegenerationSnapshot> {

        const outputPaths =
            this.outputPathBuilder.build(
                page,
            );


        const metadataFile =
            this.metadataPathBuilder.build(
                page,
            );


        const filePaths =
            mode === 'CREATE'
                ? [
                    outputPaths.elementsFile,
                    outputPaths.pageFile,
                    outputPaths.actionsFile,
                    metadataFile,
                ]
                : [
                    outputPaths.elementsFile,
                    outputPaths.pageFile,
                    metadataFile,
                ];


        const files =
            await this.fileSnapshotManager
                .captureAll(
                    filePaths,
                );


        return {
            files,
        };
    }


    async restore(
        snapshot:
            RegenerationSnapshot,
    ): Promise<void> {

        await this.fileSnapshotManager
            .restoreAll(
                snapshot.files,
            );
    }
}