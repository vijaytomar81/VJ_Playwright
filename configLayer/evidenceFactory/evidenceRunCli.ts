import { initializeEvidenceRun } from './evidenceRunDirectory';

function main(): void {
    const command = process.argv[2];

    if (command !== 'initialize' && command !== 'paths') {
        throw new Error(
            `Unknown EvidenceFactory command: ${command}`,
        );
    }

    if (
        command === 'paths' &&
        !process.env.EVIDENCEFACTORY_RUN_ID
    ) {
        throw new Error(
            'EVIDENCEFACTORY_RUN_ID is required to retrieve existing run paths.',
        );
    }

    const paths = initializeEvidenceRun();

    console.log(JSON.stringify(paths));
}

main();
