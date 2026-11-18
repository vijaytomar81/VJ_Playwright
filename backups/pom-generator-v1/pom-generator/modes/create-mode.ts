import type {
    GeneratedPage,
} from '../models/page.model';

import type {
    PomWriteResult,
} from '../writers/pom-output-writer';

import {
    PomOutputWriter,
} from '../writers/pom-output-writer';

import {
    MetadataStore,
} from '../metadata/metadata-store';

import {
    RegenerationSnapshotManager,
} from '../persistence/regeneration-snapshot-manager';

import type {
    RegenerationSnapshot,
} from '../persistence/regeneration-snapshot-manager';


export interface CreateResult {
    pom:
    PomWriteResult;

    metadataFile:
    string;
}


export class CreateMode {

    constructor(
        private readonly pomOutputWriter =
            new PomOutputWriter(),

        private readonly metadataStore =
            new MetadataStore(),

        private readonly snapshotManager =
            new RegenerationSnapshotManager(),
    ) { }


    async execute(
        page: GeneratedPage,
    ): Promise<CreateResult> {

        const snapshot =
            await this.snapshotManager.capture(
                page,
                'CREATE',
            );


        const metadataFile =
            await this.metadataStore
                .saveIfMissing(
                    page,
                );


        if (!metadataFile) {
            throw new Error(
                `Cannot CREATE POM because metadata already exists: ` +
                `${page.brand} → ` +
                `${page.channel} → ` +
                `${page.product} → ` +
                `${page.pageKey}`,
            );
        }


        try {

            const pom =
                await this.pomOutputWriter
                    .write(
                        page,
                    );


            return {
                pom,
                metadataFile,
            };

        } catch (error) {

            return this.rollback(
                snapshot,
                error,
            );
        }
    }


    private async rollback(
        snapshot:
            RegenerationSnapshot,

        originalError:
            unknown,
    ): Promise<never> {

        try {

            await this.snapshotManager
                .restore(
                    snapshot,
                );

        } catch (rollbackError) {

            throw new AggregateError(
                [
                    originalError,
                    rollbackError,
                ],
                'CREATE failed and rollback also failed.',
            );
        }


        throw originalError;
    }
}