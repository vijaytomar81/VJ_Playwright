
import {
    lstat, mkdir, readFile, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { GeneratorMode } from '../models/generator.types';

export interface FileWrite {
    /** Path relative to the configured output directory. */
    relativePath: string;
    content: string;
}

export interface SafeWriteOptions {
    outputDirectory: string;
    mode: GeneratorMode;
    dryRun?: boolean;
}

export interface SafeWriteResult {
    writtenFiles: string[];
    unchangedFiles: string[];
    plannedFiles: string[];
    warnings: string[];
}

interface PreparedFile {
    target: string;
    content: string;
    original?: Buffer;
    originalMode?: number;
    staged?: string;
}

const GENERATED_FILE = /^(?:[A-Za-z][A-Za-z0-9_-]*\.(?:page|elements|actions)\.ts|[A-Za-z][A-Za-z0-9_-]*\.pom-generator\.json)$/;

function isMissing(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
        'code' in error && error.code === 'ENOENT';
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function inside(root: string, target: string): boolean {
    const path = relative(root, target);
    return path !== '' && path !== '..' &&
        !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function validatePath(root: string, path: string): string {
    if (!path || isAbsolute(path) || path.includes('\0')) {
        throw new Error(`Invalid generated file path: "${path}".`);
    }

    const target = resolve(root, path);

    if (!inside(root, target)) {
        throw new Error(`Generated file escapes output directory: "${path}".`);
    }

    const parts = relative(root, target).split(sep);
    const fileName = parts.at(-1) ?? '';

    if (
        parts.some((part) => part === 'group-actions') ||
        !GENERATED_FILE.test(fileName)
    ) {
        throw new Error(
            `Refusing to write non-generator-owned file: "${path}".`,
        );
    }

    return target;
}

/**
 * Reject symlinks along an existing path.
 * This prevents writes from following links outside outputDirectory.
 */
async function assertNoSymlinks(
    root: string,
    target: string,
): Promise<void> {
    const rootParent = dirname(root);
    let current = rootParent;

    for (const part of relative(rootParent, target).split(sep)) {
        current = resolve(current, part);

        try {
            const info = await lstat(current);

            if (info.isSymbolicLink()) {
                throw new Error(`Symlink is not allowed: "${current}".`);
            }
            if (current !== target && !info.isDirectory()) {
                throw new Error(`Parent is not a directory: "${current}".`);
            }
            if (current === target && !info.isFile()) {
                throw new Error(`Target is not a regular file: "${current}".`);
            }
        } catch (error) {
            if (isMissing(error)) continue;
            throw error;
        }
    }
}

async function inspectFile(
    root: string,
    target: string,
    content: string,
): Promise<PreparedFile> {
    await assertNoSymlinks(root, target);

    try {
        const [original, details] = await Promise.all([
            readFile(target),
            stat(target),
        ]);

        return {
            target,
            content,
            original,
            originalMode: details.mode & 0o777,
        };
    } catch (error) {
        if (isMissing(error)) return { target, content };
        throw error;
    }
}

function stagedName(target: string): string {
    return `${target}.pom-stage-${randomUUID()}`;
}

async function stageFile(file: PreparedFile): Promise<void> {
    await mkdir(dirname(file.target), { recursive: true });
    const temp = stagedName(file.target);

    await writeFile(temp, file.content, {
        flag: 'wx',
        mode: file.originalMode ?? 0o644,
    });

    file.staged = temp;
}

async function restoreFile(file: PreparedFile): Promise<void> {
    if (file.original === undefined) {
        await rm(file.target, { force: true });
        return;
    }

    const temp = stagedName(file.target);

    try {
        await writeFile(temp, file.original, {
            flag: 'wx',
            mode: file.originalMode ?? 0o644,
        });
        await rename(temp, file.target);
    } finally {
        await rm(temp, { force: true }).catch(() => undefined);
    }
}

async function cleanupStages(
    files: readonly PreparedFile[],
): Promise<void> {
    await Promise.all(
        files.map(async (file) => {
            if (file.staged) {
                await rm(file.staged, { force: true });
            }
        }),
    );
}

/**
 * Validate and prepare every file before committing any changes.
 *
 * CREATE: refuses to replace an existing generated file.
 * UPDATE: replaces only recognized generator-owned files.
 * DRY-RUN: validates paths and existing file state, writes nothing.
 */
export async function writeGeneratedFiles(
    files: readonly FileWrite[],
    options: SafeWriteOptions,
): Promise<SafeWriteResult> {
    const root = resolve(options.outputDirectory);
    const dryRun = options.dryRun === true ||
        options.mode === 'dry-run';

    const seen = new Set<string>();
    const prepared: PreparedFile[] = [];
    const unchangedFiles: string[] = [];
    const warnings: string[] = [];

    // Complete preflight before creating directories or staging files.
    for (const file of files) {
        const target = validatePath(root, file.relativePath);

        if (seen.has(target)) {
            throw new Error(`Duplicate output target: "${target}".`);
        }
        seen.add(target);

        if (typeof file.content !== 'string') {
            throw new Error(`Output content must be text: "${target}".`);
        }

        const entry = await inspectFile(root, target, file.content);

        if (options.mode === 'create' &&
            entry.original !== undefined) {
            throw new Error(
                `CREATE refuses to overwrite existing file: "${target}".`,
            );
        }

        if (
            entry.original !== undefined &&
            entry.original.equals(Buffer.from(file.content, 'utf8'))
        ) {
            unchangedFiles.push(target);
            continue;
        }

        prepared.push(entry);
    }

    const plannedFiles = prepared.map((file) => file.target);

    if (dryRun) {
        return {
            writtenFiles: [],
            unchangedFiles,
            plannedFiles,
            warnings,
        };
    }

    const committed: PreparedFile[] = [];

    try {
        // Stage every changed file before replacing the first target.
        for (const file of prepared) {
            await stageFile(file);
        }

        for (const file of prepared) {
            if (!file.staged) {
                throw new Error(`Missing staged file: "${file.target}".`);
            }

            // Check again immediately before replacing the target.
            await assertNoSymlinks(root, file.target);
            await rename(file.staged, file.target);
            file.staged = undefined;
            committed.push(file);
        }
    } catch (error) {
        const rollbackErrors: string[] = [];

        for (const file of committed.reverse()) {
            try {
                await restoreFile(file);
            } catch (rollbackError) {
                rollbackErrors.push(
                    `${file.target}: ${errorText(rollbackError)}`,
                );
            }
        }

        try {
            await cleanupStages(prepared);
        } catch (cleanupError) {
            rollbackErrors.push(
                `Staging cleanup: ${errorText(cleanupError)}`,
            );
        }

        if (rollbackErrors.length > 0) {
            throw new Error(
                `Write failed: ${errorText(error)}\n` +
                `Rollback incomplete:\n${rollbackErrors.join('\n')}`,
            );
        }

        throw new Error(
            `Write failed; committed files rolled back: ${errorText(error)}`,
        );
    }

    await cleanupStages(prepared);

    return {
        writtenFiles: plannedFiles,
        unchangedFiles,
        plannedFiles,
        warnings,
    };
}
