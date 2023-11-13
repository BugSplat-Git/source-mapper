#! /usr/bin/env node
import clipboard from 'clipboardy';
import { Stats } from 'fs';
import * as fs from 'fs/promises';
import { SourceMapper } from '../lib/source-mapper';

const helpAndExit = () => {
    const help = `
        @bugsplat/source-mapper contains a command line utility and set of libraries to help you demangle JavaScript stack frames.

        source-mapper command line usage:

            source-mapper [ [ "/source-map-directory" OR "/source.js.map" ] [ "/stack-trace.txt" ] ]
        
            * Optionally provide either a path to a directory containing source maps or a .map.js file - Defaults to the current directory
            * Optionally provide a path to a .txt file containing a JavaScript Error stack trace - Defaults to the value in the clipboard
        
        ❤️ support@bugsplat.com
    `;

    console.log(help);
    process.exit(0);
};

(async () => {
    try {
        if (
            process.argv.some(arg => arg === '-h')
            || process.argv.some(arg => arg === '/h')
            || process.argv.some(arg => arg === '-help')
            || process.argv.some(arg => arg === '/help')
            || process.argv.some(arg => arg === '--help')
        ) {
            helpAndExit();
        }

        let sourceMapPath = process.argv[2];
        if (!sourceMapPath) {
            sourceMapPath = '.';
        }

        let sourceMapStat: Stats;
        try {
            sourceMapStat = await fs.lstat(sourceMapPath);
        } catch (cause) {
            throw new Error(`Source map path ${sourceMapPath} does not exist`, { cause });
        }
        
        let stackFileContents;
        const stackFilePath = process.argv[3];
        if (!stackFilePath) {
            stackFileContents = await clipboard.read();
        } else {
            try {
                await fs.lstat(stackFilePath);
            } catch (cause) {
                throw new Error(`Stack file path ${stackFilePath} does not exist`, { cause });
            }
            try {
                stackFileContents = await fs.readFile(stackFilePath, 'utf-8');
            } catch (cause) {
                throw new Error(`Could not read contents of ${stackFilePath}`, { cause });
            }
        }

        if (!stackFileContents) {
            throw new Error('Stack contents are empty');
        }

        const converter = sourceMapStat.isDirectory() ? await SourceMapper.createFromDirectory(sourceMapPath) : new SourceMapper([sourceMapPath]);
        const { error, stack } = await converter.convert(stackFileContents);
        if (error) {
            throw new Error(error);
        }
        console.log(stack);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
