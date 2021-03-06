import {StackConverter} from "./src/stackconverter";
import * as fs from "fs";


const underlineString = (str: string) => str + "\n" + '-'.repeat(str.length);

(async () => {
    try {
        if (process.argv.length != 4) {
            console.log('usage: t.ts mapfile stackfile');
            process.exit(1);
        }

        const mapfile = process.argv[2];
        const stackFile = process.argv[3];

        const converter = new StackConverter(mapfile);
        const failure = await converter.init();
        if (failure) {
            console.log(`could not initialize stackconverter with file ${mapfile}`);
            process.exit(1);
        }

        const stackString = fs.readFileSync(stackFile, 'utf-8');

        const newStackString = converter.convert(stackString);
        console.log(underlineString('newStackString'));
        console.log(newStackString);
    } catch (e) {
        console.log(`bad things happened e= ${e}`);
    }
})();
