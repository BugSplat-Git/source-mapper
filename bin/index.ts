import { Stats } from "fs";
import * as fs from "fs/promises";
import { StackConverter } from "../lib/stack-converter";

(async () => {
    try {
        if (process.argv.length != 4) {
            helpAndExit();
        }

        const stackFilePath = process.argv[2];
        const sourceMapPath = process.argv[3];

        try {
            await fs.lstat(stackFilePath)
        } catch {
            throw new Error(`Stack file path ${stackFilePath} does not exist`);
        }

        let sourceMapStat: Stats;
        try {
            sourceMapStat = await fs.lstat(sourceMapPath)
        } catch {
            throw new Error(`Source map path ${stackFilePath} does not exist`);
        }

        const converter = sourceMapStat.isDirectory() ? await StackConverter.createFromDirectory(sourceMapPath) : new StackConverter([sourceMapPath]);
        const stackFileContents = await fs.readFile(stackFilePath, 'utf-8');
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


function helpAndExit() {
    const help = `
        @bugsplat/stack-converter contains a command line utility and set of libraries to help you demangle JavaScript stack frames.

        stack-converter command line usage:

            stack-converter "/path/to/stack.txt" [ "/path/to/source-maps-dir" OR "/path/to/stack.js.map" ]' 
        
        ❤️ support@bugsplat.com
    `;

    console.log(help);
    process.exit(1);
}
