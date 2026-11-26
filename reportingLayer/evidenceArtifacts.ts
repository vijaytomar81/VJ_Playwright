import {
    existsSync, statSync, mkdirSync, copyFileSync, cpSync,
    realpathSync, lstatSync, constants,
} from 'node:fs';
import { basename, join, resolve, relative, isAbsolute } from 'node:path';

import reportPaths from '../configLayer/execution/reportPaths.json';

const { validateReportPaths } = require('../configLayer/execution/validateReportPaths.cjs');

const DEFAULT_PROJECT_NAME = 'Evidence';

export interface ReportFreshness {
    startedAt: Date;
    includeCommonJob: boolean;
}

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
 * Screens report files against the execution start time.
 * Modification timestamps alone do not establish execution ownership.
 */
function isFreshFile(source: string, startedAt: Date): boolean {
    if (!existsSync(source)) return false;

    const stats = lstatSync(source);

    return stats.isFile() &&
        stats.mtimeMs >= startedAt.getTime();
}

/**
 * Checks optional report eligibility without modifying native reports.
 */
function isEligibleReport(
    source: string,
    freshness: ReportFreshness,
): boolean {
    if (source === resolve(reportPaths.commonJob)) {
        return freshness.includeCommonJob &&
            isFreshFile(
                join(source, 'results-summary.json'),
                freshness.startedAt,
            );
    }

    if (
        source === resolve(reportPaths.playwrightHtml) ||
        source === resolve(reportPaths.allureReport)
    ) {
        return isFreshFile(
            join(source, 'index.html'),
            freshness.startedAt,
        );
    }

    if (source === resolve(reportPaths.junit)) {
        return isFreshFile(source, freshness.startedAt);
    }

    return true;
}

/**
 * Identifies native directories that may contain individual stale artifacts.
 */
function filterReportFiles(source: string): boolean {
    return source === resolve(reportPaths.allureResults) ||
        source === resolve(reportPaths.testResults);
}

/**
 * Copies an existing report without modifying its original location.
 */
function copyReport(
    source: string,
    destination: string,
    startedAt?: Date,
): void {
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
                const stats = lstatSync(entry);

                if (stats.isSymbolicLink()) {
                    throw new Error(
                        `EvidenceFactory: Symbolic link report entry is not supported: ${entry}`,
                    );
                }

                if (startedAt && !stats.isDirectory()) {
                    return stats.isFile() &&
                        stats.mtimeMs >= startedAt.getTime();
                }

                return true;
            },
        });
    } else {
        copyFileSync(source, destination, constants.COPYFILE_EXCL);
    }
}

/**
 * Copies eligible native reports without modifying their original locations.
 * Preserves their existing names and directory structures.
 * Groups native JSON and JUnit XML reports inside native-results.
 */
export function copyReports(
    runDirectory: string,
    jsonFile: string,
    reportSources: readonly string[],
    freshness?: ReportFreshness,
): void {
    const jsonSource = resolve(process.cwd(), jsonFile);

    if (!existsSync(jsonSource) || !statSync(jsonSource).isFile()) {
        throw new Error(
            `EvidenceFactory: Mandatory JSON report not found: ${jsonSource}`,
        );
    }

    if (freshness && !isFreshFile(jsonSource, freshness.startedAt)) {
        throw new Error(
            `EvidenceFactory: Mandatory JSON report is invalid or stale: ${jsonSource}`,
        );
    }

    const nativeResultsDirectory = join(runDirectory, 'native-results');

    mkdirSync(nativeResultsDirectory);

    const jsonFilename = basename(reportPaths.json);
    const destinations = new Set<string>([
        join('native-results', jsonFilename).toLowerCase(),
    ]);

    copyReport(jsonSource, join(nativeResultsDirectory, jsonFilename));

    for (const report of reportSources) {
        const source = resolve(process.cwd(), report);

        if (!existsSync(source)) continue;

        const filename = basename(source);
        const destination = source === resolve(reportPaths.junit)
            ? join(nativeResultsDirectory, filename)
            : join(runDirectory, filename);
        const destinationKey = relative(runDirectory, destination).toLowerCase();

        if (destinations.has(destinationKey)) {
            console.warn(
                `EvidenceFactory: Duplicate report destination: ${destination}`,
            );
            continue;
        }

        destinations.add(destinationKey);

        try {
            if (freshness && !isEligibleReport(source, freshness)) {
                console.warn(
                    `EvidenceFactory: Stale or ineligible report skipped: ${source}`,
                );
                continue;
            }

            copyReport(
                source, destination,
                filterReportFiles(source) ? freshness?.startedAt : undefined,
            );
        } catch (error) {
            console.warn(
                `EvidenceFactory: Unable to copy report: ${source}`,
                error,
            );
        }
    }
}

/**
 * Copies a native Playwright screenshot into the dedicated screenshots directory.
 * Reuses existing screenshot copies and returns a portable Excel hyperlink.
 */
export function resolveScreenshot(
    attachmentPath: string,
    runDirectory: string,
    copiedScreenshots: Map<string, string>,
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

    const screenshotKey = process.platform === 'win32'
        ? resolve(destination).toLowerCase()
        : resolve(destination);

    const existingScreenshot = copiedScreenshots.get(screenshotKey);

    if (existingScreenshot) {
        return existingScreenshot;
    }

    const screenshotsDirectory = join(runDirectory, 'screenshots');
    const prefix = String(copiedScreenshots.size + 1).padStart(3, '0');
    const screenshotFilename = `${prefix}-${basename(screenshot)}`;
    const screenshotDestination = join(screenshotsDirectory, screenshotFilename);

    try {
        mkdirSync(screenshotsDirectory, { recursive: true });

        copyFileSync(
            destination, screenshotDestination, constants.COPYFILE_EXCL,
        );

        const hyperlink = relative(
            runDirectory, screenshotDestination,
        ).replace(/\\/g, '/');

        copiedScreenshots.set(screenshotKey, hyperlink);

        return hyperlink;
    } catch (error) {
        console.warn(
            `EvidenceFactory: Unable to copy screenshot: ${destination}`,
            error,
        );
        return '';
    }
}
