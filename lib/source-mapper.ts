import * as fs from 'fs/promises';
import { get, set } from 'lodash';
import * as path from 'path';
import { SourceMapConsumer } from 'source-map';
import * as stackTraceParser from 'stacktrace-parser';

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
     * @throws - throws if no sourceMapFilePaths are provided
     */
    constructor(private sourceMapFilePaths: Array<string>) {
        if (!sourceMapFilePaths?.length) {
            throw new Error('Could not create SourceMapper: no source map file paths were provided!');
        }
    }

    /**
     * Convenience method for creating a SourceMapper from a directory containing source map files
     *
     * @param directory - path to directory containing source map files
     * @throws - throws if no source map files exist in dir
     * @returns - promise that resolves to a new SourceMapper
     */
    static async createFromDirectory(directory: string): Promise<SourceMapper> {
        try {
            await fs.lstat(directory);
        } catch(error) {
            throw new Error(`Could not create SourceMapper: ${directory} does not exist or is inaccessible!`);
        }

        const files = await fs.readdir(directory);
        const sourceMapFilePaths = files
            .filter(file => file.endsWith('.map'))
            .map(file => path.join(directory, file));
        return new SourceMapper(sourceMapFilePaths);
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
        const sourceMaps: { [filename: string]: SourceMapConsumer } = {};
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

            const mapFile = this.sourceMapFilePaths.find(mapFilePath => {
                const posix = mapFilePath.includes(`${path.posix.basename(file)}.map`);
                const win32 = mapFilePath.includes(`${path.win32.basename(file)}.map`);
                return posix || win32;
            });

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
                
                let sourceMapConsumer: SourceMapConsumer = get(sourceMaps, mapFile);
                if (!sourceMapConsumer) {
                    const { sourceMap, error } = await SourceMapper.sourceMapFromFile(mapFile);
                    if (!sourceMap || error) {
                        set(sourceMapErrors, file, true);
                        const comment = SourceMapper.errorLoadingSourceMapComment(error);
                        buff.push(SourceMapper.frameLine(methodName, file, lineNumber, column, comment));
                        continue;
                    }
                    sourceMaps[mapFile] = sourceMap;
                    sourceMapConsumer = sourceMap;
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

    private static async sourceMapFromFile(file: string): Promise<{sourceMap?: SourceMapConsumer, error?: string}> {
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
            const sourceMap = await new SourceMapConsumer(parsedSourceMap);
            return { sourceMap };
        } catch(error) {
            return { error: 'could not parse source map' };
        }
    }
}