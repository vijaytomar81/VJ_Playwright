
import { readFile } from 'node:fs/promises';
import type { PageMetadata } from '../models/generator.types';

import {
    validateMetadata,
} from './metadata-validator';

export {
    validateMetadata,
} from './metadata-validator';

export type {
    MetadataValidationResult,
} from './metadata-validator';

export interface MetadataReadResult {
    metadata?: PageMetadata;
    exists: boolean;
    warnings: string[];
}

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : String(error);
}

function isMissingFile(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
    );
}

/**
 * Parse and validate metadata without modifying it.
 *
 * Invalid metadata must never be silently replaced
 * during CREATE or UPDATE.
 */
export function parseMetadata(source: string): PageMetadata {
    let value: unknown;

    try {
        value = JSON.parse(source);
    } catch (error) {
        throw new Error(
            `Invalid POM metadata JSON: ${errorMessage(error)}`,
        );
    }

    const validation = validateMetadata(value);

    if (!validation.valid) {
        throw new Error(
            'Invalid POM metadata:\n' +
            validation.errors.join('\n'),
        );
    }

    return value as PageMetadata;
}

/**
 * Serialize only valid schema-v2 metadata.
 *
 * Preserve array ordering and stable IDs.
 * Actual disk writes belong to safe-writer.ts.
 */
export function serializeMetadata(
    metadata: PageMetadata,
): string {
    const validation = validateMetadata(metadata);

    if (!validation.valid) {
        throw new Error(
            'Cannot serialize invalid POM metadata:\n' +
            validation.errors.join('\n'),
        );
    }

    return JSON.stringify(metadata, null, 2) + '\n';
}

/**
 * Read metadata from disk.
 *
 * Missing files are allowed for CREATE.
 * Invalid JSON, invalid metadata, and other I/O
 * failures must stop the operation.
 */
export async function readMetadata(
    filePath: string,
): Promise<MetadataReadResult> {
    let source: string;

    try {
        source = await readFile(filePath, 'utf8');
    } catch (error) {
        if (isMissingFile(error)) {
            return {
                exists: false,
                warnings: [],
            };
        }

        throw new Error(
            `Cannot read POM metadata "${filePath}": ` +
            errorMessage(error),
        );
    }

    const metadata = parseMetadata(source);
    const validation = validateMetadata(metadata);

    return {
        exists: true,
        metadata,
        warnings: validation.warnings,
    };
}
