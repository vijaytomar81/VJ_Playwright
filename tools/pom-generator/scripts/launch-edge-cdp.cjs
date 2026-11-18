
'use strict';

const { spawn, execFileSync } = require('node:child_process');
const {
    existsSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    rmSync,
} = require('node:fs');
const { homedir, platform, tmpdir } = require('node:os');
const { join } = require('node:path');
const net = require('node:net');

const PORT = 9222;
const HOST = '127.0.0.1';
const OS = platform();

const BASE_DIRECTORY = join(
    homedir(),
    '.pom-generator-v2',
);

const PROFILE_DIRECTORY = join(
    BASE_DIRECTORY,
    'edge-cdp-profile',
);

const STATE_FILE = join(
    BASE_DIRECTORY,
    'edge-cdp-state.json',
);

function findEdge() {
    const candidates = [];

    if (OS === 'darwin') {
        candidates.push(
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            join(
                homedir(),
                'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            ),
        );
    } else if (OS === 'win32') {
        for (const base of [
            process.env.PROGRAMFILES,
            process.env['PROGRAMFILES(X86)'],
            process.env.LOCALAPPDATA,
        ]) {
            if (base) {
                candidates.push(
                    join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                );
            }
        }
    } else {
        throw new Error(
            `Unsupported platform: ${OS}. Use macOS or Windows.`,
        );
    }

    const executable = candidates.find(existsSync);

    if (!executable) {
        throw new Error(
            'Microsoft Edge executable was not found.\n' +
            `Checked:\n${candidates.join('\n')}`,
        );
    }

    return executable;
}

function isAlive(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;

    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

function getCommandLine(pid) {
    try {
        if (OS === 'darwin') {
            return execFileSync(
                'ps',
                ['-p', String(pid), '-o', 'command='],
                { encoding: 'utf8' },
            ).trim();
        }

        const script = [
            '$p = Get-CimInstance Win32_Process',
            `-Filter "ProcessId = ${pid}";`,
            'if ($p) { $p.CommandLine }',
        ].join(' ');

        return execFileSync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', script],
            { encoding: 'utf8' },
        ).trim();
    } catch {
        return '';
    }
}

function isDedicatedProcess(pid) {
    if (!isAlive(pid)) return false;

    const command = getCommandLine(pid);

    return command.includes(
        `--user-data-dir=${PROFILE_DIRECTORY}`,
    ) && (
            OS === 'win32'
                ? /msedge\.exe/i.test(command)
                : command.includes('Microsoft Edge')
        );
}

function readState() {
    try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return undefined;
    }
}

function portIsBusy() {
    return new Promise((resolvePromise, reject) => {
        const server = net.createServer();

        server.once('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                resolvePromise(true);
            } else {
                reject(error);
            }
        });

        server.listen(PORT, HOST, () => {
            server.close(() => resolvePromise(false));
        });
    });
}

function saveState(pid, executable) {
    writeFileSync(
        STATE_FILE,
        JSON.stringify({
            pid,
            executable,
            profileDirectory: PROFILE_DIRECTORY,
            port: PORT,
            platform: OS,
            createdAt: new Date().toISOString(),
        }, null, 2) + '\n',
        { encoding: 'utf8', mode: 0o600 },
    );
}

async function launch() {
    if (!['darwin', 'win32'].includes(OS)) {
        throw new Error(`Unsupported platform: ${OS}`);
    }

    mkdirSync(BASE_DIRECTORY, { recursive: true });

    const previous = readState();

    if (previous && isDedicatedProcess(previous.pid)) {
        console.log(
            `Dedicated Edge is already running (PID ${previous.pid}).`,
        );
        console.log(`CDP: http://${HOST}:${PORT}`);
        return;
    }

    if (await portIsBusy()) {
        throw new Error(
            `Port ${PORT} is already in use.\n` +
            'Stop the existing CDP browser or choose a free port.',
        );
    }

    const executable = findEdge();

    mkdirSync(PROFILE_DIRECTORY, { recursive: true });

    const args = [
        `--remote-debugging-port=${PORT}`,
        `--remote-debugging-address=${HOST}`,
        `--user-data-dir=${PROFILE_DIRECTORY}`,
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
    ];

    const child = spawn(executable, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
    });

    await new Promise((resolvePromise, reject) => {
        child.once('spawn', resolvePromise);
        child.once('error', reject);
    });

    if (!child.pid) {
        throw new Error('Edge launched without a process ID.');
    }

    saveState(child.pid, executable);
    child.unref();

    console.log('Microsoft Edge launched.');
    console.log(`Platform: ${OS}`);
    console.log(`Process ID: ${child.pid}`);
    console.log(`CDP: http://${HOST}:${PORT}`);
    console.log(`Profile: ${PROFILE_DIRECTORY}`);
    console.log('Open your application in the dedicated Edge window.');
}

launch().catch((error) => {
    console.error(
        error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
});
