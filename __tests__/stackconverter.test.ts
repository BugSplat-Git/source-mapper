import * as fs from "fs";
import * as path from "path";
import { StackConverter } from "../src/stackconverter";

const TESTING_DIR = "__tests__"
const TESTING_DATA_DIR = path.join(TESTING_DIR, "test-data");

describe("StackConverter tests", () => {
  describe("convert", () => {
    test("converting empty stack string should result in empty string", async () => {
        await expect(async() => {
          const emptyJsMapPath = path.join(TESTING_DATA_DIR, "empty.js.map");
          const stackConverter = new StackConverter(emptyJsMapPath);
          await stackConverter.init();
        })
          .rejects
          .toThrow(/Unexpected token . in JSON at position 0/)
    });

    test("read in stack-1 map file and convert stack-1 sample data", async () => {
      const baseFile = "stack-1";
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const stackConverter = await new StackConverter(mapFilePath);
      await stackConverter.init();
      const stackFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = fs.readFileSync(stackFilePath, {
        encoding: "utf8",
        flag: "r",
      });
      const convertedStack = stackConverter.convert(stackText);
      expect(stackText).toEqual(stackText);
      expect(convertedStack).toMatchInlineSnapshot(`
        "    at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)"
      `);
    });

    test("read in stack-2 map file and convert to stack-2 sample data", async () => {
      const baseFile = "stack-2";
      const mapFilePath =  path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const stackConverter = new StackConverter(mapFilePath);
      await stackConverter.init();
      const stackFile = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = fs.readFileSync(stackFile, {
        encoding: "utf8",
        flag: "r",
      });
      const convertedStack = stackConverter.convert(stackText);
      expect(stackText).toEqual(stackText);
      expect(convertedStack).toMatchInlineSnapshot(`
        "    at <unknown> (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:32:16)
            at Generator.next
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at titleTpl (webpack:///node_modules/@ng-bootstrap/ng-bootstrap/__ivy_ngcc__/fesm2015/ng-bootstrap.js:7581:13)
            at <unknown> (webpack:///node_modules/tslib/tslib.es6.js:70:11)
            at error (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:21:20)
            at markForCheck (webpack:///node_modules/@ng-bootstrap/ng-bootstrap/__ivy_ngcc__/fesm2015/ng-bootstrap.js:1351:17)
            at <unknown> (webpack:///node_modules/@ng-bootstrap/ng-bootstrap/__ivy_ngcc__/fesm2015/ng-bootstrap.js:679:54)
            at selector (webpack:///node_modules/rxjs/_esm2015/internal/operators/catchError.js:27:30)
            at error (webpack:///node_modules/rxjs/_esm2015/internal/innerSubscribe.js:45:25)"
      `);
    });
  });
});
