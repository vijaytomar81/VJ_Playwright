
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const PORT = 9222;

const PROFILE_DIRECTORY = path.join(
    os.tmpdir(),
    'allianz-edge-cdp',
);

function getProcesses() {
    if (process.platform === 'win32') {
        const output = execFileSync(
            'powershell.exe',
            [
                '-NoProfile',
                '-Command',
                'Get-CimInstance Win32_Process | ' +
                'Where-Object { $_.Name -eq "msedge.exe" } | ' +
                'Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress',
            ],
            { encoding: 'utf8' },
        );

        const parsed = JSON.parse(output || '[]');

        return Array.isArray(parsed)
            ? parsed
            : [parsed];
    }

    if (process.platform === 'darwin') {
        const output = execFileSync(
            'ps',
            ['-axo', 'pid=,command='],
            { encoding: 'utf8' },
        );

        return output
            .split('\n')
            .map(line => {
                const match = line.match(/^\s*(\d+)\s+(.+)$/);

                return match
                    ? {
                        ProcessId: Number(match[1]),
                        CommandLine: match[2],
                    }
                    : null;
            })
            .filter(Boolean);
    }

    throw new Error(
        `Unsupported operating system: ${process.platform}`,
    );
}

function isFrameworkEdgeProcess(processInfo) {
    const commandLine =
        processInfo.CommandLine || '';

    const isEdge =
        process.platform === 'win32'
            ? /msedge\.exe/i.test(commandLine)
            : /Microsoft Edge\.app\/Contents\/MacOS\/Microsoft Edge/.test(
                commandLine,
            );

    return (
        isEdge &&
        commandLine.includes(
            `--remote-debugging-port=${PORT}`,
        ) &&
        commandLine.includes(
            `--user-data-dir=${PROFILE_DIRECTORY}`,
        )
    );
}

function stopEdge() {
    const matchingProcesses =
        getProcesses().filter(
            isFrameworkEdgeProcess,
        );

    if (matchingProcesses.length === 0) {
        console.log(
            'No framework-managed Edge CDP instance was found.',
        );
        return;
    }

    for (const processInfo of matchingProcesses) {
        const pid =
            Number(processInfo.ProcessId);

        if (!Number.isInteger(pid) || pid <= 0) {
            continue;
        }

        console.log(
            `Stopping framework Edge CDP process: ${pid}`,
        );

        if (process.platform === 'win32') {
            execFileSync(
                'taskkill',
                ['/PID', String(pid), '/T', '/F'],
                { stdio: 'inherit' },
            );
        } else {
            process.kill(
                pid,
                'SIGTERM',
            );
        }
    }

    console.log(
        'Edge CDP stop request completed.',
    );
}

try {
    stopEdge();
} catch (error) {
    console.error(
        'Failed to stop Edge CDP:',
        error instanceof Error
            ? error.message
            : String(error),
    );

    process.exitCode = 1;
}
