#! /usr/bin/env node
import clipboard from 'clipboardy';
import { Stats, readFileSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { readManifestFile } from '../lib/manifest';
import { SourceMapper } from '../lib/source-mapper';

const helpAndExit = () => {
    const help = `
        @bugsplat/source-mapper contains a command line utility and set of libraries to help you demangle JavaScript stack frames.

        source-mapper command line usage:

            source-mapper [ [ "/source-map-directory" OR "/source.js.map" ] [ "/stack-trace.txt" ] [ "/manifest.json" ] ]
            source-mapper --version
        
            * Optionally provide either a path to a directory containing source maps or a .map.js file - Defaults to the current directory
            * Optionally provide a path to a .txt file containing a JavaScript Error stack trace - Defaults to the value in the clipboard
            * Optionally provide a path to a .json file that states which source map each stack frame file uses - Stack frame files that aren't listed are matched to source maps by file name. When this file is provided the source map directory can be empty or missing
            * Use --version to print the version of source-mapper
        
        ❤️ support@bugsplat.com
    `;

    console.log(help);
    process.exit(0);
};

const versionAndExit = () => {
    console.log(packageVersion());
    process.exit(0);
};

const packageVersion = (): string => {
    const packageJsonPaths = [
        // From dist/bin/index.js. A two argument path.join(__dirname, ...) is what makes pkg bundle package.json into the executables.
        path.join(__dirname, '../../package.json'),
        // From bin/index.ts
        path.join(__dirname, '..', 'package.json')
    ];

    for (const packageJsonPath of packageJsonPaths) {
        try {
            const { name, version } = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            if (name === '@bugsplat/source-mapper' && version) {
                return version;
            }
        } catch {
            continue;
        }
    }

    throw new Error('Could not determine the version of source-mapper');
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

        if (process.argv.some(arg => arg === '--version')) {
            versionAndExit();
        }

        const manifestFilePath = process.argv[4];
        const manifest = manifestFilePath ? await readManifestFile(manifestFilePath) : undefined;

        let sourceMapPath = process.argv[2];
        if (!sourceMapPath) {
            sourceMapPath = '.';
        }

        let sourceMapStat: Stats | undefined;
        try {
            sourceMapStat = await fs.lstat(sourceMapPath);
        } catch (cause) {
            if (!manifest) {
                throw new Error(`Source map path ${sourceMapPath} does not exist`, { cause });
            }
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

        let converter: SourceMapper;
        if (!sourceMapStat) {
            converter = new SourceMapper([], manifest);
        } else if (sourceMapStat.isDirectory()) {
            converter = await SourceMapper.createFromDirectory(sourceMapPath, manifest);
        } else {
            converter = new SourceMapper([sourceMapPath], manifest);
        }

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
