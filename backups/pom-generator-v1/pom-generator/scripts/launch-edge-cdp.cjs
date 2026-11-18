
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 9222;

const profileDirectory = path.join(
    os.tmpdir(),
    'allianz-edge-cdp',
);

function findEdgeExecutable() {
    if (process.env.EDGE_PATH) {
        if (!fs.existsSync(process.env.EDGE_PATH)) {
            throw new Error(
                `EDGE_PATH does not exist: ${process.env.EDGE_PATH}`,
            );
        }

        return process.env.EDGE_PATH;
    }

    if (process.platform === 'darwin') {
        const candidates = [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            path.join(
                os.homedir(),
                'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            ),
        ];

        return candidates.find(fs.existsSync);
    }

    if (process.platform === 'win32') {
        const candidates = [
            path.join(
                process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
                'Microsoft',
                'Edge',
                'Application',
                'msedge.exe',
            ),
            path.join(
                process.env.PROGRAMFILES || 'C:\\Program Files',
                'Microsoft',
                'Edge',
                'Application',
                'msedge.exe',
            ),
            path.join(
                process.env.LOCALAPPDATA || '',
                'Microsoft',
                'Edge',
                'Application',
                'msedge.exe',
            ),
        ];

        return candidates.find(fs.existsSync);
    }

    throw new Error(
        `Unsupported operating system: ${process.platform}`,
    );
}

function main() {
    const executable = findEdgeExecutable();

    if (!executable) {
        throw new Error(
            'Microsoft Edge executable was not found. ' +
            'Set EDGE_PATH to its full executable path.',
        );
    }

    fs.mkdirSync(profileDirectory, {
        recursive: true,
    });

    const args = [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${profileDirectory}`,
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
    ];

    console.log('Launching Microsoft Edge CDP...');
    console.log(`Platform: ${process.platform}`);
    console.log(`Port: ${PORT}`);
    console.log(`Profile: ${profileDirectory}`);

    const child = spawn(
        executable,
        args,
        {
            detached: true,
            stdio: 'ignore',
        },
    );

    child.once('error', error => {
        console.error(
            `Failed to launch Edge: ${error.message}`,
        );
        process.exitCode = 1;
    });

    child.once('spawn', () => {
        child.unref();

        console.log(
            'Edge launch requested successfully.',
        );
        console.log(
            `CDP endpoint: http://localhost:${PORT}`,
        );
        console.log(
            'Navigate to your application before running the POM scan.',
        );
    });
}

try {
    main();
} catch (error) {
    console.error(
        error instanceof Error
            ? error.message
            : String(error),
    );

    process.exitCode = 1;
}
