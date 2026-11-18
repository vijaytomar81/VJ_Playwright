
'use strict';

const { execFileSync } = require('node:child_process');
const {
    existsSync,
    readFileSync,
    rmSync,
} = require('node:fs');
const { homedir, platform } = require('node:os');
const { join } = require('node:path');

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

function readState() {
    if (!existsSync(STATE_FILE)) return undefined;

    try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    } catch {
        throw new Error(
            'Edge state file is invalid. Refusing to stop an unknown process.',
        );
    }
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

        if (OS === 'win32') {
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
        }

        throw new Error(`Unsupported platform: ${OS}`);
    } catch {
        return '';
    }
}

function verifyDedicatedProcess(state) {
    if (
        state.platform !== OS ||
        state.profileDirectory !== PROFILE_DIRECTORY ||
        state.port !== 9222
    ) {
        throw new Error(
            'Saved Edge state does not match this machine.',
        );
    }

    if (!isAlive(state.pid)) return false;

    const command = getCommandLine(state.pid);

    const correctProfile = command.includes(
        `--user-data-dir=${PROFILE_DIRECTORY}`,
    );

    const correctExecutable = OS === 'win32'
        ? /msedge\.exe/i.test(command)
        : command.includes('Microsoft Edge');

    if (!correctProfile || !correctExecutable) {
        throw new Error(
            `PID ${state.pid} does not match the dedicated ` +
            'POM Generator Edge process. Refusing to terminate it.',
        );
    }

    return true;
}

function stopProcess(pid) {
    if (OS === 'win32') {
        // Terminate the dedicated Edge process tree.
        execFileSync(
            'taskkill',
            ['/PID', String(pid), '/T', '/F'],
            { stdio: 'pipe' },
        );
        return;
    }

    if (OS === 'darwin') {
        process.kill(pid, 'SIGTERM');
        return;
    }

    throw new Error(`Unsupported platform: ${OS}`);
}

function stop() {
    const state = readState();

    if (!state) {
        console.log('No dedicated Edge state file found.');
        return;
    }

    if (!verifyDedicatedProcess(state)) {
        rmSync(STATE_FILE, { force: true });
        console.log(
            'Dedicated Edge is no longer running. Cleared stale state.',
        );
        return;
    }

    stopProcess(state.pid);

    rmSync(STATE_FILE, { force: true });

    console.log(
        `Stop signal sent to dedicated Edge (PID ${state.pid}).`,
    );
    console.log('Your regular Edge windows were not targeted.');
}

try {
    stop();
} catch (error) {
    console.error(
        error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
}
