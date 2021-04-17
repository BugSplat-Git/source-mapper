import { StackConverter } from "../src/stackconverter";
import * as fs from "fs";

const underlineString = (str: string) => str + "\n" + '-'.repeat(str.length);

(async () => {
    try {
        if (process.argv.length != 4) {
            console.log('usage: t.ts directory stackfile');
            process.exit(1);
        }

        const sourceMapDir = process.argv[2];
        const stackFile = process.argv[3];

        const converter = await StackConverter.createFromDirectory(sourceMapDir);
        const stackString = fs.readFileSync(stackFile, 'utf-8');
        const result = await converter.convert(stackString);
        console.log(underlineString('newStackString'));
        console.log("error: "  + result.error);
        console.log("stack: \n" + result.stack)
    } catch (e) {
        console.log(`bad things happened e= ${e}`);
    }
})();
