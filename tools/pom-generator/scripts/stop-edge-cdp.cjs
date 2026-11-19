
'use strict';

const { execFileSync } = require('node:child_process');
const {
    existsSync,
    readFileSync,
    rmSync,
} = require('node:fs');
const { homedir, platform } = require('node:os');
const { join } = require('node:path');
const http = require('node:http');
const net = require('node:net');

const OS = platform();
const HOST = '127.0.0.1';
const PORT = 9222;
const ENDPOINT = `http://${HOST}:${PORT}`;

const BASE_DIRECTORY = join(homedir(), '.pom-generator-v2');
const PROFILE_DIRECTORY = join(BASE_DIRECTORY, 'edge-cdp-profile');
const STATE_FILE = join(BASE_DIRECTORY, 'edge-cdp-state.json');

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
        state.port !== PORT
    ) {
        throw new Error(
            'Saved Edge state does not match this machine.',
        );
    }

    if (!isAlive(state.pid)) return false;

    const command = getCommandLine(state.pid);
    const normalized = command.replace(/"/g, '').toLowerCase();

    const correctProfile = normalized.includes(
        `--user-data-dir=${PROFILE_DIRECTORY.toLowerCase()}`,
    );

    const correctExecutable = OS === 'win32'
        ? /msedge\.exe/i.test(command)
        : command.includes('Microsoft Edge');

    if (!correctProfile || !correctExecutable) {
        throw new Error(
            `PID ${state.pid} does not match the dedicated ` +
            'POM Generator Edge process. Refusing to close it.',
        );
    }

    return true;
}

function getCDPInfo() {
    return new Promise((resolve, reject) => {
        const request = http.get(
            `${ENDPOINT}/json/version`,
            { timeout: 2000 },
            (response) => {
                let body = '';

                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    body += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        reject(new Error(
                            `CDP returned HTTP ${response.statusCode}`,
                        ));
                        return;
                    }

                    try {
                        const info = JSON.parse(body);

                        if (!info.webSocketDebuggerUrl) {
                            throw new Error(
                                'CDP response has no WebSocket URL.',
                            );
                        }

                        resolve(info);
                    } catch (error) {
                        reject(error);
                    }
                });
            },
        );

        request.on('timeout', () => {
            request.destroy(new Error('CDP request timed out'));
        });

        request.on('error', reject);
    });
}

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

async function closeThroughCDP(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('CDP WebSocket connection timed out.'));
        }, 5000);

        socket.addEventListener('open', () => {
            clearTimeout(timeout);
            resolve();
        }, { once: true });

        socket.addEventListener('error', () => {
            clearTimeout(timeout);
            reject(new Error('CDP WebSocket connection failed.'));
        }, { once: true });
    });

    socket.send(JSON.stringify({
        id: 1,
        method: 'Browser.close',
    }));

    await sleep(1000);

    if (socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
}

async function waitForExit(pid) {
    for (let attempt = 0; attempt < 10; attempt++) {
        if (!isAlive(pid)) return true;
        await sleep(500);
    }

    return !isAlive(pid);
}

function portIsBusy() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();

        server.once('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                reject(error);
            }
        });

        server.listen(PORT, HOST, () => {
            server.close(() => resolve(false));
        });
    });
}

async function stop() {
    if (!['win32', 'darwin'].includes(OS)) {
        throw new Error(`Unsupported platform: ${OS}`);
    }

    const state = readState();

    if (!state) {
        console.log('No dedicated Edge state file found.');
        return;
    }

    if (!verifyDedicatedProcess(state)) {
        rmSync(STATE_FILE, { force: true });
        console.log(
            'Dedicated Edge process is no longer running. ' +
            'Cleared stale state.',
        );
        return;
    }

    let info;

    try {
        info = await getCDPInfo();
    } catch (error) {
        throw new Error(
            'Dedicated Edge is running, but CDP is unavailable.\n' +
            'Refusing to terminate any browser process.\n' +
            `Reason: ${error.message}`,
        );
    }

    console.log(`Closing dedicated Edge CDP (PID ${state.pid})...`);

    await closeThroughCDP(info.webSocketDebuggerUrl);

    const exited = await waitForExit(state.pid);
    const portBusy = await portIsBusy();

    if (!exited || portBusy) {
        throw new Error(
            'CDP close was requested, but shutdown could not ' +
            'be fully verified.\n' +
            'State file preserved. No process was force-terminated.',
        );
    }

    rmSync(STATE_FILE, { force: true });

    console.log('Dedicated Edge CDP browser closed successfully.');
    console.log('Your regular Edge windows were not targeted.');
}

stop().catch((error) => {
    console.error(
        error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
});
