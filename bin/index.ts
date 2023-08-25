#! /usr/bin/env node
import * as clipboardy from 'clipboardy';
import { Stats } from 'fs';
import * as fs from 'fs/promises';
import { StackConverter } from '../lib/stack-converter';

const helpAndExit = () => {
    const help = `
        @bugsplat/stack-converter contains a command line utility and set of libraries to help you demangle JavaScript stack frames.

        stack-converter command line usage:

            stack-converter [ [ "/source-map-directory" OR "/source.js.map" ] [ "/stack-trace.txt" ] ]
        
            * Optionally provide either a path to a directory containing source maps or a .map.js file - Defaults to the current directory
            * Optionally provide a path to a .txt file containing a JavaScript Error stack trace - Defaults to the value in the clipboard
        
        ❤️ support@bugsplat.com
    `;

    console.log(help);
    process.exit(1);
};

(async () => {
    try {
        if (
            process.argv.some(arg => arg === '-h')
            || process.argv.some(arg => arg === '/h')
            || process.argv.some(arg => arg === '-help')
            || process.argv.some(arg => arg === '/help')
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
        } catch {
            throw new Error(`Source map path ${sourceMapPath} does not exist`);
        }
        
        let stackFileContents;
        const stackFilePath = process.argv[3];
        if (!stackFilePath) {
            stackFileContents = await clipboardy.read();
        } else {
            try {
                await fs.lstat(stackFilePath);
            } catch {
                throw new Error(`Stack file path ${stackFilePath} does not exist`);
            }
            try {
                stackFileContents = await fs.readFile(stackFilePath, 'utf-8');
            } catch {
                throw new Error(`Could not read contents of ${stackFilePath}`);
            }
        }

        if (!stackFileContents) {
            throw new Error('Stack contents are empty');
        }

        const converter = sourceMapStat.isDirectory() ? await StackConverter.createFromDirectory(sourceMapPath) : new StackConverter([sourceMapPath]);
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
