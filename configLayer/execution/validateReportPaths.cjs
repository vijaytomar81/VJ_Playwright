const fs = require('node:fs');
const path = require('node:path');

const reportPaths = require('./reportPaths.json');

const OUTPUT_KEY = 'evidenceFactoryOutput';

const APPROVED_NATIVE_REPORT_PATHS = Object.freeze({
    json: 'results.json',
    junit: 'results.xml',
    playwrightHtml: 'playwright-report',
    allureResults: 'allure-results',
    allureReport: 'allure-report',
    testResults: 'test-results',
    commonJob: 'common-job',
});

const NATIVE_REPORT_FILE_KEYS = [
    'json',
    'junit',
];

const LEGACY_REPORT_PATHS = {
    customTestReports: 'custom-test-reports',
};

/**
 * Validates the configuration against approved native report locations.
 * The allowlist is a cleanup safety restriction, not a report configuration.
 */
function validateApprovedReportPaths(configuration) {
    if (
        !configuration ||
        typeof configuration !== 'object' ||
        Array.isArray(configuration)
    ) {
        throw new Error(
            'Invalid report path configuration: expected an object.',
        );
    }

    const approvedKeys = [
        ...Object.keys(APPROVED_NATIVE_REPORT_PATHS),
        OUTPUT_KEY,
    ];

    for (const key of approvedKeys) {
        if (!Object.prototype.hasOwnProperty.call(configuration, key)) {
            throw new Error(
                `Invalid report path configuration: missing '${key}'.`,
            );
        }
    }

    for (const key of Object.keys(configuration)) {
        if (!approvedKeys.includes(key)) {
            throw new Error(
                `Invalid report path configuration: unknown '${key}'.`,
            );
        }
    }

    for (const [key, approvedPath] of Object.entries(
        APPROVED_NATIVE_REPORT_PATHS,
    )) {
        if (configuration[key] !== approvedPath) {
            throw new Error(
                `Invalid report path configuration: '${key}' must use ` +
                `the approved native report location '${approvedPath}'.\n` +
                `Configured location: ${configuration[key]}`,
            );
        }
    }
}

/**
 * Resolves existing symbolic links, including those in parent directories.
 */
function resolvePhysicalPath(value) {
    const absolutePath = path.resolve(value);

    try {
        fs.lstatSync(absolutePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }

        const parent = path.dirname(absolutePath);

        if (parent === absolutePath) {
            throw error;
        }

        return path.join(
            resolvePhysicalPath(parent),
            path.basename(absolutePath),
        );
    }

    return fs.realpathSync(absolutePath);
}

/**
 * Normalizes paths for conservative comparison across execution platforms.
 */
function normalizePath(value) {
    return path.resolve(value).toLowerCase();
}

/**
 * Checks whether a path is equal to or contained within another path.
 */
function isSameOrChild(candidate, parent) {
    const difference = path.relative(parent, candidate);

    return difference === '' ||
        (
            difference !== '..' &&
            !difference.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(difference)
        );
}

/**
 * Rejects symbolic links and invalid filesystem types in report paths.
 */
function validateExistingPath(key, value, repositoryRoot) {
    const components = value.split('/');
    let currentPath = repositoryRoot;

    for (let index = 0; index < components.length; index++) {
        currentPath = path.join(currentPath, components[index]);

        let stats;

        try {
            stats = fs.lstatSync(currentPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return;
            }

            throw error;
        }

        if (stats.isSymbolicLink()) {
            throw new Error(
                `Invalid report path configuration: '${key}' must not ` +
                `contain symbolic links: ${currentPath}`,
            );
        }

        const isFinalComponent = index === components.length - 1;
        const expectsFile = isFinalComponent &&
            NATIVE_REPORT_FILE_KEYS.includes(key);

        if (expectsFile ? !stats.isFile() : !stats.isDirectory()) {
            throw new Error(
                `Invalid report path configuration: '${key}' must ` +
                `refer to a ${expectsFile ? 'file' : 'directory'}: ` +
                `${currentPath}`,
            );
        }

        if (expectsFile && stats.nlink > 1) {
            throw new Error(
                `Invalid report path configuration: '${key}' must not ` +
                `refer to a hard-linked file: ${currentPath}`,
            );
        }
    }
}

/**
 * Validates a configured report path.
 */
function resolveReportPath(key, value, repositoryRoot) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(
            `Invalid report path configuration: '${key}' must not be empty.`,
        );
    }

    if (value !== value.trim() || value.includes('\\')) {
        throw new Error(
            `Invalid report path configuration: '${key}' must use ` +
            `forward slashes and must not contain surrounding whitespace.`,
        );
    }

    const configuredPath = value;

    if (
        path.posix.isAbsolute(configuredPath) ||
        path.win32.isAbsolute(configuredPath) ||
        /^[a-zA-Z]:/.test(configuredPath)
    ) {
        throw new Error(
            `Invalid report path configuration: '${key}' must be relative.`,
        );
    }

    if (configuredPath.split('/').includes('..')) {
        throw new Error(
            `Invalid report path configuration: '${key}' must not ` +
            `contain parent directory traversal: ${value}`,
        );
    }

    for (const component of configuredPath.split('/')) {
        if (
            !component ||
            component === '.' ||
            /[<>:"|?*]/.test(component) ||
            Array.from(component).some((character) => character.charCodeAt(0) < 32) ||
            /[. ]$/.test(component) ||
            /^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(component)
        ) {
            throw new Error(
                `Invalid report path configuration: '${key}' contains ` +
                `an unsupported path component: ${component}`,
            );
        }
    }

    const absolutePath = path.resolve(repositoryRoot, configuredPath);
    const normalizedRoot = normalizePath(repositoryRoot);
    const normalizedPath = normalizePath(absolutePath);

    if (
        normalizedPath === normalizedRoot ||
        !isSameOrChild(normalizedPath, normalizedRoot)
    ) {
        throw new Error(
            `Invalid report path configuration: '${key}' must remain ` +
            `inside the repository: ${value}`,
        );
    }

    validateExistingPath(key, configuredPath, repositoryRoot);

    const physicalRoot = normalizePath(
        resolvePhysicalPath(repositoryRoot),
    );

    let physicalPath;

    try {
        physicalPath = normalizePath(
            resolvePhysicalPath(absolutePath),
        );
    } catch (error) {
        throw new Error(
            `Invalid report path configuration: '${key}' cannot be ` +
            `resolved safely: ${value}\n${error.message}`,
            { cause: error },
        );
    }

    if (
        physicalPath === physicalRoot ||
        !isSameOrChild(physicalPath, physicalRoot)
    ) {
        throw new Error(
            `Invalid report path configuration: '${key}' resolves ` +
            `outside the repository: ${value}`,
        );
    }

    return {
        configured: normalizedPath,
        physical: physicalPath,
    };
}

/**
 * Checks whether two report paths overlap.
 */
function pathsConflict(first, second) {
    return (
        isSameOrChild(first.configured, second.configured) ||
        isSameOrChild(second.configured, first.configured) ||
        isSameOrChild(first.physical, second.physical) ||
        isSameOrChild(second.physical, first.physical)
    );
}

/**
 * Ensures EvidenceFactory output is independent of native report paths.
 * Must run before report cleanup or test execution.
 */
function validateReportPaths(
    configuration = reportPaths,
    repositoryRoot = path.resolve(__dirname, '../..'),
) {
    validateApprovedReportPaths(configuration);

    const physicalRoot = resolvePhysicalPath(repositoryRoot);

    const workingDirectory = resolvePhysicalPath(process.cwd());

    if (path.relative(physicalRoot, workingDirectory) !== '') {
        throw new Error(
            `Report path validation must run from the repository root.\n` +
            `Repository root: ${repositoryRoot}\n` +
            `Working directory: ${process.cwd()}`,
        );
    }

    const output = resolveReportPath(
        OUTPUT_KEY,
        configuration[OUTPUT_KEY],
        repositoryRoot,
    );

    const protectedPaths = {
        ...configuration,
        ...LEGACY_REPORT_PATHS,
    };

    const nativePaths = [];

    for (const [key, value] of Object.entries(protectedPaths)) {
        if (key === OUTPUT_KEY) continue;

        const native = resolveReportPath(
            key,
            value,
            repositoryRoot,
        );

        if (pathsConflict(output, native)) {
            throw new Error(
                `Invalid report path configuration: ` +
                `'${OUTPUT_KEY}' conflicts with '${key}'.\n` +
                `EvidenceFactory output: ${configuration[OUTPUT_KEY]}\n` +
                `Native report path: ${value}\n` +
                `EvidenceFactory output must be independent of ` +
                `all native report locations.`,
            );
        }

        for (const previous of nativePaths) {
            if (pathsConflict(native, previous.resolved)) {
                throw new Error(
                    `Invalid report path configuration: ` +
                    `'${key}' conflicts with '${previous.key}'.\n` +
                    `Report path: ${value}\n` +
                    `Conflicting report path: ${previous.value}`,
                );
            }
        }

        nativePaths.push({
            key,
            value,
            resolved: native,
        });
    }
}

module.exports = { validateReportPaths };

if (require.main === module) {
    try {
        validateReportPaths();
        console.log('Report path configuration validated successfully.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
