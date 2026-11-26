
import {
    existsSync, statSync, mkdirSync, copyFileSync, cpSync,
    realpathSync, lstatSync, constants,
} from 'node:fs';
import { basename, join, resolve, relative, isAbsolute } from 'node:path';

import reportPaths from '../configLayer/execution/reportPaths.json';

const { validateReportPaths } = require('../configLayer/execution/validateReportPaths.cjs');

const DEFAULT_PROJECT_NAME = 'Evidence';

function toPascalCase(value: string): string {
    return value.trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
}

/**
 * Generates a timestamp using the execution machine's local time.
 */
function localTimestamp(date: Date): string {
    const pad = (value: number, length = 2): string =>
        String(value).padStart(length, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
        `${pad(date.getDate())}T${pad(date.getHours())}-` +
        `${pad(date.getMinutes())}-${pad(date.getSeconds())}-` +
        `${pad(date.getMilliseconds(), 3)}`;
}

/**
 * Creates a unique EvidenceFactory directory after Playwright has completed.
 */
export function createRunDirectory(
    project: string,
    startedAt: Date = new Date(),
) {
    validateReportPaths();

    const resultsRoot = resolve(process.cwd(), reportPaths.evidenceFactoryOutput);
    const prefix = toPascalCase(project) || DEFAULT_PROJECT_NAME;
    const timestamp = localTimestamp(startedAt);

    mkdirSync(resultsRoot, { recursive: true });

    let counter = 0;

    while (true) {
        const runId = counter === 0
            ? timestamp
            : `${timestamp}-${counter}`;

        const runDirectory = join(resultsRoot, `${prefix}-run-${runId}`);

        try {
            mkdirSync(runDirectory);

            return {
                runId,
                runDirectory,
                outputFile: join(runDirectory, `${basename(runDirectory)}.xlsx`),
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }

            counter++;
        }
    }
}

/**
 * Checks whether a path is equal to or contained within another path.
 */
function isSameOrChild(candidate: string, parent: string): boolean {
    const difference = relative(parent.toLowerCase(), candidate.toLowerCase());

    return difference === '' ||
        (
            difference !== '..' &&
            !difference.startsWith('../') &&
            !difference.startsWith('..\\') &&
            !isAbsolute(difference)
        );
}

/**
 * Copies an existing report without modifying its original location.
 */
function copyReport(source: string, destination: string): void {
    const resultsRoot = realpathSync(
        resolve(process.cwd(), reportPaths.evidenceFactoryOutput),
    );
    const physicalSource = realpathSync(source);

    if (
        isSameOrChild(physicalSource, resultsRoot) ||
        isSameOrChild(resultsRoot, physicalSource)
    ) {
        throw new Error(
            `EvidenceFactory: Report source overlaps EvidenceFactory output: ${source}`,
        );
    }

    if (lstatSync(source).isSymbolicLink()) {
        throw new Error(
            `EvidenceFactory: Symbolic link report source is not supported: ${source}`,
        );
    }

    if (statSync(source).isDirectory()) {
        cpSync(source, destination, {
            recursive: true,
            force: false,
            errorOnExist: true,
            filter: entry => {
                if (lstatSync(entry).isSymbolicLink()) {
                    throw new Error(
                        `EvidenceFactory: Symbolic link report entry is not supported: ${entry}`,
                    );
                }

                return true;
            },
        });
    } else {
        copyFileSync(source, destination, constants.COPYFILE_EXCL);
    }
}

/**
 * Copies reports produced during the current execution.
 * Preserves their existing names and directory structures.
 */
export function copyReports(
    runDirectory: string,
    jsonFile: string,
    reportSources: readonly string[],
): void {
    const jsonSource = resolve(process.cwd(), jsonFile);

    if (!existsSync(jsonSource) || !statSync(jsonSource).isFile()) {
        throw new Error(
            `EvidenceFactory: Mandatory JSON report not found: ${jsonSource}`,
        );
    }

    const jsonFilename = basename(reportPaths.json);
    const destinations = new Set<string>([jsonFilename.toLowerCase()]);

    copyReport(jsonSource, join(runDirectory, jsonFilename));

    for (const report of reportSources) {
        const source = resolve(process.cwd(), report);

        if (!existsSync(source)) continue;

        const filename = basename(source);
        const destination = join(runDirectory, filename);
        const destinationKey = filename.toLowerCase();

        if (destinations.has(destinationKey)) {
            console.warn(
                `EvidenceFactory: Duplicate report destination: ${destination}`,
            );
            continue;
        }

        destinations.add(destinationKey);

        try {
            copyReport(source, destination);
        } catch (error) {
            console.warn(
                `EvidenceFactory: Unable to copy report: ${source}`,
                error,
            );
        }
    }
}

/**
 * Resolves a copied native Playwright screenshot as a portable Excel hyperlink.
 */
export function resolveScreenshot(
    attachmentPath: string,
    runDirectory: string,
): string {
    const source = isAbsolute(attachmentPath)
        ? attachmentPath
        : resolve(process.cwd(), attachmentPath);

    const testResultsDirectory = resolve(process.cwd(), reportPaths.testResults);
    const screenshot = relative(testResultsDirectory, source);

    if (
        !screenshot ||
        screenshot === '..' ||
        screenshot.startsWith('../') ||
        screenshot.startsWith('..\\') ||
        isAbsolute(screenshot)
    ) {
        console.warn(
            `EvidenceFactory: Screenshot outside ${reportPaths.testResults}: ${source}`,
        );
        return '';
    }

    const destination = join(
        runDirectory, basename(testResultsDirectory), screenshot,
    );

    if (!existsSync(destination) || !statSync(destination).isFile()) {
        console.warn(
            `EvidenceFactory: Copied screenshot not found: ${destination}`,
        );
        return '';
    }

    return relative(runDirectory, destination).replace(/\\/g, '/');
}
