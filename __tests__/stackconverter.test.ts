import { StackConverter } from "../src/stackconverter";
import * as fs from "fs";

const TESTING_DIR = "__tests__"
const TESTING_DATA_DIR = TESTING_DIR + "/test-data";

describe("StackConverter tests", () => {
  describe("convert", () => {
    test("test converting an empty stack", async () => {
        expect(async () => {
            const stackConverter = new StackConverter(TESTING_DATA_DIR + "/empty.js.map");
            const initResults = await stackConverter.init();
            // expect(initResults);
            stackConverter.convert("");
        }).toThrow(new SyntaxError('Unexpected end of JSON input'))
    });

    test("read in stack-1 map file and convert stack-1 sample data", async () => {
      const baseFile = "stack-1";
      const stackConverter = new StackConverter(
        "__tests__/test-data/${baseFile}.js.map"
      );
      await stackConverter.init();
      const stackText = fs.readFileSync("__tests__/test-data/${baseFile}.txt", {
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
      const stackConverter = new StackConverter(
        `__tests__/test-data/${baseFile}.js.map`
      );
      await stackConverter.init();
      const stackText = fs.readFileSync(`__tests__/test-data/${baseFile}.txt`, {
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
