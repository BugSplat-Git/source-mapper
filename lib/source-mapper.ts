import * as fs from 'fs/promises';
import { set } from 'lodash';
import * as path from 'path';
import { SourceMapConsumer } from 'source-map';
import * as stackTraceParser from 'stacktrace-parser';
import { SourceMapManifest, SourceMapManifestEntry, normalizeDebugId, readDebugId } from './manifest';

type LoadedSourceMap = { consumer: SourceMapConsumer, debugId?: string };

/**
 * A class for converting stacktraces, mangled by transpiling, back to match the originating files.
 * Usage:
 *    const converter = new SourceMapper(['a-sourceMap-file.js.sourceMap']);
 *    const mangledStack = '....';
 *    const newStack = await converter.convert(managedStack);
 */
export class SourceMapper {
    private static readonly INDENT: string = '    ';

    /**
     * Create a SourceMapper by passing an array of paths to source map files
     *
     * @param sourceMapFilePaths - an array of paths to source map files for converting stacks
     * @param manifest - optional object that states which source map each stack frame file uses
     * @throws - throws if no sourceMapFilePaths and no manifest are provided
     */
    constructor(private sourceMapFilePaths: Array<string>, private manifest?: SourceMapManifest) {
        if (!sourceMapFilePaths?.length && !manifest) {
            throw new Error('Could not create SourceMapper: no source map file paths were provided!');
        }

        this.sourceMapFilePaths = sourceMapFilePaths ?? [];
    }

    /**
     * Convenience method for creating a SourceMapper from a directory containing source map files
     *
     * @param directory - path to directory containing source map files
     * @param manifest - optional object that states which source map each stack frame file uses
     * @throws - throws if no manifest is provided and the directory does not exist or contains no source map files
     * @returns - promise that resolves to a new SourceMapper
     */
    static async createFromDirectory(directory: string, manifest?: SourceMapManifest): Promise<SourceMapper> {
        try {
            await fs.lstat(directory);
        } catch(error) {
            if (manifest) {
                return new SourceMapper([], manifest);
            }

            throw new Error(`Could not create SourceMapper: ${directory} does not exist or is inaccessible!`);
        }

        const files = await fs.readdir(directory);
        const sourceMapFilePaths = files
            .filter(file => file.endsWith('.map'))
            .map(file => path.join(directory, file));
        return new SourceMapper(sourceMapFilePaths, manifest);
    }

    /**
     * Converts the file names and line numbers of a stack trace using the corresponding source maps
     *
     * @param stack - a string representation of a stack trace from a Error object
     * @returns - promise that resolves to an object that contains an error or a stack
     */
    async convert(stack: string): Promise<{error?: string, stack?: string}> {
        if (!stack) {
            return { stack: '' };
        }

        const stackFrames = stackTraceParser.parse(stack);
        if (stackFrames.length == 0) {
            return { error: 'No stack frames found in stack input' };
        }

        const buff: string[] = [];
        const sourceMaps = new Map<string, LoadedSourceMap>();
        const mapFiles = new Map<string, string | undefined>();
        const sourceMapErrors: { [filename: string]: boolean } = {};

        const errorLine = SourceMapper.getChromiumErrorLineOrEmpty(stack);
        if (errorLine) {
            buff.push(errorLine);
        }

        for (const frame of stackFrames) {
            const { file, methodName, lineNumber, column } = frame;
            if (file in sourceMapErrors) {
                const comment = SourceMapper.errorLoadingSourceMapComment('previous error');
                buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column, comment));
                continue;
            }

            if (!lineNumber && !column) {
                // handle case where <anonymous> is returned as file with no lineNumber or column
                buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column));
                continue;
            }

            if (!mapFiles.has(file)) {
                mapFiles.set(file, await this.findMapFile(file, sourceMaps));
            }
            const mapFile = mapFiles.get(file);

            if (!mapFile) {
                set(sourceMapErrors, file, true);
                const comment = SourceMapper.errorLoadingSourceMapComment('source map not found');
                buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column, comment));
                continue;
            }

            try {
                if (!lineNumber || (lineNumber < 1)) {
                    const funcName = methodName || '';
                    buff.push(`${SourceMapper.INDENT}at ${funcName}`);
                    continue;
                }
                
                let sourceMapConsumer = sourceMaps.get(mapFile)?.consumer;
                if (!sourceMapConsumer) {
                    const { sourceMap, error } = await SourceMapper.sourceMapFromFile(mapFile);
                    if (!sourceMap || error) {
                        set(sourceMapErrors, file, true);
                        const comment = SourceMapper.errorLoadingSourceMapComment(error);
                        buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column, comment));
                        continue;
                    }
                    sourceMaps.set(mapFile, sourceMap);
                    sourceMapConsumer = sourceMap.consumer;
                }

                const originalPosition = sourceMapConsumer.originalPositionFor({ line: lineNumber, column });
                if (!originalPosition || !originalPosition.line) {
                    const comment = SourceMapper.couldNotConvertStackFrameComment('original position not found');
                    buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column, comment));
                    continue;
                }
                const name = originalPosition.name || methodName;
                buff.push(SourceMapper.frameLine(name, originalPosition.source, originalPosition.line, originalPosition.column));
            } catch (error) {
                const comment = SourceMapper.couldNotConvertStackFrameComment((error as Error).message);
                buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column, comment));
            }
        }
        return { stack: buff.join('\n') };
    }

    private async findMapFile(file: string, sourceMaps: Map<string, LoadedSourceMap>): Promise<string | undefined> {
        const entry = this.manifestEntryFor(file);
        if (entry && await SourceMapper.manifestEntryIsValid(entry, sourceMaps)) {
            return entry.map;
        }

        return this.findMapFileByName(file);
    }

    private manifestEntryFor(file: string): SourceMapManifestEntry | undefined {
        if (!this.manifest || !Object.prototype.hasOwnProperty.call(this.manifest, file)) {
            return undefined;
        }

        const entry = this.manifest[file];
        if (!entry || typeof entry.map !== 'string' || !entry.map || !normalizeDebugId(entry.debugId)) {
            return undefined;
        }

        return entry;
    }

    private findMapFileByName(file: string): string | undefined {
        const mapFileNames = SourceMapper.mapFileNamesFor(file);
        return this.sourceMapFilePaths.find(mapFilePath => mapFileNames.includes(path.basename(mapFilePath)));
    }

    // A manifest entry is valid when its source map can be loaded and contains the debug ID the entry states
    private static async manifestEntryIsValid(entry: SourceMapManifestEntry, sourceMaps: Map<string, LoadedSourceMap>): Promise<boolean> {
        const debugId = normalizeDebugId(entry.debugId);
        const loaded = sourceMaps.get(entry.map);
        if (loaded) {
            return loaded.debugId === debugId;
        }

        try {
            const { sourceMap } = await SourceMapper.sourceMapFromFile(entry.map, debugId);
            if (!sourceMap) {
                return false;
            }

            sourceMaps.set(entry.map, sourceMap);
            return true;
        } catch {
            return false;
        }
    }

    // The names a source map for the frame's file can have: the file's base name, without query string and fragment, followed by .map
    private static mapFileNamesFor(file: string): Array<string> {
        const filePath = SourceMapper.stripQueryAndFragment(file);
        const baseNames = [path.posix.basename(filePath), path.win32.basename(filePath)];
        return baseNames.filter(baseName => !!baseName).map(baseName => `${baseName}.map`);
    }

    // In a URL both ? and # end the path. In a file system path # is an ordinary character (C:\dev\c#\app.js), so only ? ends the path.
    private static stripQueryAndFragment(file: string): string {
        const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(file);
        const end = file.search(isUrl ? /[?#]/ : /\?/);
        return end === -1 ? file : file.substring(0, end);
    }

    private static couldNotConvertStackFrameComment(comment: string): string {
        return `Could not convert stack frame (${comment})`;
    }

    private static errorLoadingSourceMapComment(comment: string): string {
        return `Error loading source map for frame (${comment})`;
    }

    private static frameLine(methodName: string, file: string, line: number, column: number, comment?: string): string {
        const method = methodName || '<unknown>';
        if (!line && !column) {
            return `${SourceMapper.INDENT}at ${method} (${file})` + (comment ? '  ***' + comment : '');
        }

        return `${SourceMapper.INDENT}at ${method} (${file}:${line}:${column})` + (comment ? '  ***' + comment : '');
    }

    private static getChromiumErrorLineOrEmpty(stack: string): string {
        const parts = stack.split('\n');
        if (parts[0].match('Error:')) {
            return parts[0];
        }

        return '';
    }

    private static async sourceMapFromFile(file: string, expectedDebugId?: string): Promise<{sourceMap?: LoadedSourceMap, error?: string}> {
        if (!file) {
            return { error: 'file name was empty' };
        }

        try {
            await fs.lstat(file);
        } catch (error) {
            return { error: `file ${file} does not exist or is inaccessible` };
        }

        const fileData = await fs.readFile(file, { encoding: 'utf8', flag: 'r' });
        if (!fileData) {
            return { error: `file ${file} was empty` };
        }

        try {
            const parsedSourceMap = JSON.parse(fileData);
            const debugId = readDebugId(parsedSourceMap);
            if (expectedDebugId && debugId !== expectedDebugId) {
                return { error: `file ${file} does not contain debug id ${expectedDebugId}` };
            }

            const consumer = await new SourceMapConsumer(parsedSourceMap);
            return { sourceMap: { consumer, debugId } };
        } catch(error) {
            return { error: 'could not parse source map' };
        }
    }
}