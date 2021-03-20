import * as stackTraceParser from 'stacktrace-parser';
import {SourceMapConsumer} from 'source-map';
import * as fs from "fs";


/**
 * A class for converting stacktraces, mangled by transpiling, back to match the originating files.
 * usage:
 *    const converter = new StackConverter('a-map-file.js.map');
 *    await converter.init();
 *    const mangedStack = '....';
 *    const newStack = converter.convert(managedStack);
 */
export class StackConverter {
    mapFile: string;
    sourceMapConsumer: SourceMapConsumer;
    private initialized: boolean;

    /**
     * Create a StackConverter passing in the name of the mapfile.
     * @param fileName - the path to the mapfile for converting stacks.
     */
    constructor(
        fileName: string
    ) {
        this.mapFile = fileName;
        this.initialized = false;
    }

    /**
     * init - initialize the stack converter given that the mapfile was already set.
     * @return: a string with the error or undefined on success.
     */
    public async init(): Promise<void> {
        if (!this.mapFile) {
            throw new Error('could not initialize StackConverter, mapFile not set');
        }
        const fileData = fs.readFileSync(this.mapFile, {
            encoding: "utf8",
            flag: "r",
        });
        const parsedSourceMap = JSON.parse(fileData);
        this.sourceMapConsumer = await new SourceMapConsumer(parsedSourceMap);

        if (!this.sourceMapConsumer) {
            throw new Error(`cannot init, error loading source map file ${this.mapFile}`);
        }
        this.initialized = true;
        return;
    }

    /**
     * Converts a given stack frame
     * @param stackString
     */
    public convert(stackString: string): string {
        if (!this.initialized) {
            throw new Error('have not initialized, set the mapfile and call init()')
        }
        const stackFrames = stackTraceParser.parse(stackString);
        if (!stackString) {
            // an empty stack is converted to an empty stack.
            return '';
        }
        if (stackFrames.length == 0) {
            return 'no stacks found in input';
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
        return buff.join('\n');
    }
}
