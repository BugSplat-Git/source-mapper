import * as fs from 'fs/promises';

/**
 * States which source map a stack frame file uses, and the debug ID that source map must carry.
 */
export interface SourceMapManifestEntry {
    /** Path to the source map file */
    map: string;
    /** Debug ID the source map is expected to contain, with or without hyphens, in any letter case */
    debugId: string;
}

/**
 * Maps a stack frame's file, exactly as it appears in the stack (including any query string), to a source map.
 */
export type SourceMapManifest = Record<string, SourceMapManifestEntry>;

const NORMALIZED_DEBUG_ID = /^[0-9a-f]{32}$/;

/**
 * Normalizes a debug ID by lowercasing it and removing hyphens
 *
 * @param debugId - the value to normalize
 * @returns - 32 lowercase hex characters, or undefined if the value is not a valid debug ID
 */
export function normalizeDebugId(debugId: unknown): string | undefined {
    if (typeof debugId !== 'string') {
        return undefined;
    }

    const normalized = debugId.toLowerCase().replace(/-/g, '');
    return NORMALIZED_DEBUG_ID.test(normalized) ? normalized : undefined;
}

/**
 * Reads the debug ID from a parsed source map, preferring the debugId field over debug_id
 *
 * @param parsedSourceMap - the result of parsing the contents of a source map file
 * @returns - the normalized debug ID, or undefined if the source map has no valid debug ID
 */
export function readDebugId(parsedSourceMap: unknown): string | undefined {
    if (!parsedSourceMap || typeof parsedSourceMap !== 'object') {
        return undefined;
    }

    const { debugId, debug_id } = parsedSourceMap as Record<string, unknown>;
    return normalizeDebugId(debugId) ?? normalizeDebugId(debug_id);
}

/**
 * Reads a manifest from a JSON file
 *
 * @param file - path to a JSON file containing a manifest
 * @throws - throws if the file can't be read or doesn't contain a JSON object
 * @returns - promise that resolves to the manifest
 */
export async function readManifestFile(file: string): Promise<SourceMapManifest> {
    let contents: string;
    try {
        contents = await fs.readFile(file, 'utf-8');
    } catch (cause) {
        throw new Error(`Could not read contents of manifest file ${file}`, { cause });
    }

    let manifest: unknown;
    try {
        // Windows tools commonly write a byte order mark that JSON.parse rejects
        manifest = JSON.parse(contents.charCodeAt(0) === 0xFEFF ? contents.slice(1) : contents);
    } catch (cause) {
        throw new Error(`Manifest file ${file} is not valid JSON`, { cause });
    }

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error(`Manifest file ${file} must contain a JSON object`);
    }

    return manifest as SourceMapManifest;
}
