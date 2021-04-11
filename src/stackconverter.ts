import * as stackTraceParser from 'stacktrace-parser';
import {SourceMapConsumer} from 'source-map';
import * as fs from "fs/promises";
import {StackFrame} from "stacktrace-parser";
import {get, set} from 'lodash';
import * as path from "path";

/**
 * A class for converting stacktraces, mangled by transpiling, back to match the originating files.
 * usage:
 *    const converter = new StackConverter('a-sourceMap-file.js.sourceMap');
 *    await converter.init();
 *    const mangedStack = '....';
 *    const newStack = converter.convert(managedStack);
 */
export class StackConverter {
    readonly fileName: string;
    private sourceMapConsumer: SourceMapConsumer;
    private initialized: boolean;
    private fromDirectory: boolean;

    /**
     * Create a StackConverter passing in the name of the mapfile.
     * @param fileName - the path to the mapfile for converting stacks.
     */
    constructor(
        fileName: string
    ) {
        this.fileName = fileName;
        this.initialized = false;
    }

    /**
     * init - initialize the stack converter given that the mapfile was already set.
     * @return: a string with the error or undefined on success.
     */
    public async init(): Promise<{ error?: string }> {
        try {
            const stat = await fs.lstat(this.fileName);
            if (!stat) {
                return {error: `file "${this.fileName}" does not exist`};
            }
            this.fromDirectory = stat.isDirectory()
            if (this.fromDirectory) {
                return await this.initFromDirectory();
            }
            return await this.initFromFile();
        } catch (err) {
            return {error: err.message}
        }
    }

    private static async sourceMapFromFile(file: string): Promise<{sourceMap?: SourceMapConsumer, error?: string}> {
        if (!file) {
            return {error: 'could not initialize StackConverter, fileName not set'};
        }
        // if the file doesn't exist, return error string
        const stat = await fs.lstat(file);
        if (!stat) {
            return {error: `file "${file}" does not exist`}
        }

        const fileData = await fs.readFile(file, {
            encoding: "utf8",
            flag: "r",
        });
        const parsedSourceMap = JSON.parse(fileData);
        const sourceMap = await new SourceMapConsumer(parsedSourceMap)
        return {sourceMap};
    }

    private async initFromFile(): Promise<{ error?: string }> {
        const { sourceMap, error } = await StackConverter.sourceMapFromFile(this.fileName);
        if (error) {
            return {error};
        }
        this.sourceMapConsumer = sourceMap;

        if (!this.sourceMapConsumer) {
            return {error: `cannot init, error loading source map file ${this.fileName}`};
        }
        this.initialized = true;
        return {}
    }

    private async mapFilesInDir(): Promise<boolean> {
        try {
            const files = await fs.readdir(this.fileName);
            return files.some(f => f.endsWith('.map'));
        } catch (err) {
            return false;
        }
    }

    private async initFromDirectory(): Promise<{ error?: string }> {
        // confirm that there are sourceMap files in directory
        if (!await this.mapFilesInDir()) {
            return {error: `there are no map files in directory ${this.fileName}`};
        }
        this.initialized = true;
        return {};
    }

    static INDENT = '    ';

    /**
     * Converts a given stack frame
     * @param stackString
     */
    public async convert(stackString: string): Promise<{error?: string, stack?: string}>
    {
        if (!this.initialized) {
            return {error: 'have not initialized, call init() first'};
        }
        const stackFrames = stackTraceParser.parse(stackString);
        if (!stackString) {
            // an empty stack is converted to an empty stack.
            return {stack: ''};
        }
        if (stackFrames.length == 0) {
            return {error: 'no stacks found in input'};
        }

        if (this.fromDirectory) {
            return await this.convertFromDirectory(stackFrames);
        }

        const INDENT = '    ';
        const buff: string[] = [];
        stackFrames.forEach(({methodName, lineNumber, column}) => {
            const funcName = methodName || '';
            try {
                if (!lineNumber || (lineNumber < 1)) {
                    buff.push(`${INDENT}at ${funcName}`);
                } else {
                    const origPos = this.sourceMapConsumer.originalPositionFor({line: lineNumber, column})
                    if (origPos && origPos.line != null) {
                        const origName = origPos.name || '<unknown>';
                        buff.push(`${INDENT}at ${origName} (${origPos.source}:${origPos.line}:${origPos.column})`)
                    }
                }
            } catch (err) {
                buff.push(`${INDENT}**could not convert frame**, err = ${err}`);
            }
        });
        return {stack: buff.join('\n')};
    }

    private static frameLine(methodName: string, file: string, line: number, column: number, comment?: string): string {
        const meth = methodName || '<unknown>';
        return `${StackConverter.INDENT}at ${meth} (${file}:${line}:${column})` + (comment ? '  ***' + comment : '');
    }

    private async convertFromDirectory(stackFrames: StackFrame[]): Promise<{ error?: string, stack?: string }> {
        const buff: string[] = [];
        const sourceMaps: { [filename: string]: SourceMapConsumer } = {};
        const sourceMapErrors: { [filename: string]: boolean } = {};

        for (const frame of stackFrames) {
            const {file, methodName, lineNumber, column} = frame;
            const mapFile = path.join(this.fileName, path.basename(file) + '.map');
            if (mapFile in sourceMapErrors) {
                // skip loading maps for files that failed
                buff.push(StackConverter.frameLine(methodName, file, lineNumber, column, `error loading source map (previous error)`));
                continue;
            }
            const funcName = methodName || '';
            try {
                if (!lineNumber || (lineNumber < 1)) {
                    buff.push(`${StackConverter.INDENT}at ${funcName}`)
                } else {
                    let sm: SourceMapConsumer = get(sourceMaps, mapFile);
                    if (!sm) {
                        const { sourceMap, error } = await StackConverter.sourceMapFromFile(mapFile);
                        if (!sourceMap || error) {
                            // could not load so don't convert frame
                            set(sourceMapErrors, file, true);
                            buff.push(StackConverter.frameLine(methodName, file, lineNumber, column))
                            continue;
                        }
                        sourceMaps[mapFile] = sourceMap;
                        sm = sourceMap;
                    }
                    const origPos = sm.originalPositionFor({line: lineNumber, column});
                    if (!origPos || !origPos.line) {
                        buff.push(StackConverter.frameLine(methodName, file, lineNumber, column, 'could not convert'))
                    } else {
                        buff.push(StackConverter.frameLine(origPos.name, origPos.source, origPos.line, origPos.column))
                    }
                }
            } catch (err) {
                buff.push(StackConverter.frameLine(methodName, file, lineNumber, column, `could not convert, err = ${err}`));
            }
        }
        return {stack: buff.join('\n')};
    }
}
