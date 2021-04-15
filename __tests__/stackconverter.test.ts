import * as fs from "fs";
import * as path from "path";
import { StackConverter } from "../src/stackconverter";

const TESTING_DIR = "__tests__";
const TESTING_DATA_DIR = path.join(TESTING_DIR, "test-data");

const readStack = (file: string): string => {
  return fs.readFileSync(file, {
    encoding: "utf8",
    flag: "r",
  });
};

describe("StackConverter tests", () => {
  describe("convert", () => {
    test("empty map file results in JSON parse error", async () => {
      // NOTE: useful syntax, keep for later
      // await expect(async () => {
      //   const emptyJsMapPath = path.join(TESTING_DATA_DIR, "empty.js.map");
      //   const stackConverter = new StackConverter(emptyJsMapPath);
      //   await stackConverter.init();
      // }).rejects.toThrow(/Unexpected token . in JSON at position 0/);

      const emptyJsMapPath = path.join(TESTING_DATA_DIR, "empty.js.map");
      const stackConverter = new StackConverter(emptyJsMapPath);
      const { error } = await stackConverter.init();

      expect(error).toBeDefined();
      expect(error).toMatchInlineSnapshot(
        `"Unexpected token � in JSON at position 0"`
      );
    });

    test("stack to convert, results in empty results but no error", async () => {
      const mapFile = path.join(TESTING_DATA_DIR, "stack-1.js.map");
      const stackConverter = new StackConverter(mapFile);
      {
        const { error } = await stackConverter.init();
        expect(error).not.toBeDefined();
      }

      const { error, stack } = await stackConverter.convert("");
      expect(error).toBeUndefined();
      expect(stack).toMatchInlineSnapshot(`""`);
    });

    test("read in stack-1 map file and convert stack-1 sample data", async () => {
      const baseFile = "stack-1";
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const stackConverter = new StackConverter(mapFilePath);
      await stackConverter.init();
      const stackFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = readStack(stackFilePath);
      const { error, stack } = await stackConverter.convert(stackText);
      expect(error).toBeUndefined();
      expect(stack).toMatchInlineSnapshot(`
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
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const stackConverter = new StackConverter(mapFilePath);
      await stackConverter.init();
      const stackFile = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = readStack(stackFile);
      const { error, stack } = await stackConverter.convert(stackText);
      expect(error).toBeUndefined();
      expect(stackText).toEqual(stackText);
      expect(stack).toMatchInlineSnapshot(`
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

    test("point at a file that doesn't exist, initialize fails", async () => {
      const baseFile = "file-doesnt-exist";
      const mapFilePath = path.join(TESTING_DATA_DIR, baseFile);
      const stackConverter = new StackConverter(mapFilePath);

      const { error } = await stackConverter.init();
      expect(error).toBeDefined();
      expect(error).toMatch(
        /ENOENT: no such file or directory, lstat '.*__tests__[\\|\/]test-data[\\|\/]file-doesnt-exist/
      );
    });

    test("point a directory that doesn't have map files, initialize fails", async () => {
      const baseFile = "dir-exists-no-map-files";
      const mapFilePath = path.join(TESTING_DATA_DIR, baseFile);
      const stackConverter = new StackConverter(mapFilePath);

      const { error } = await stackConverter.init();
      expect(error).toBeDefined();
      expect(error).toMatch(
        /there are no map files in directory __tests__[\\|\/]test-data[\\|\/]dir-exists-no-map-files/
      );
    });

    test("point at directory that does have map files, initialize succeeds", async () => {
      const baseFile = "dir-exists-has-map-files";
      const mapFilePath = path.join(TESTING_DATA_DIR, baseFile);
      const stackConverter = new StackConverter(mapFilePath);

      const { error } = await stackConverter.init();
      expect(error).not.toBeDefined();
    });

    test("given a list of directories containing maps, convert a stack frame", async () => {
      const directory = path.join(TESTING_DATA_DIR, "dir-maps-convert-1");
      const stackFile = path.join(directory, "stack-to-convert.txt");
      const stackText = readStack(stackFile);

      const stackConverter = new StackConverter(directory);
      {
        const { error } = await stackConverter.init();
        expect(error).not.toBeDefined();
      }
      const { error, stack } = await stackConverter.convert(stackText);
      expect(error).toBeUndefined();
      expect(stack).toMatchInlineSnapshot(`
        "    at <unknown> (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:32:16)
            at Generator.next
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)
            at <unknown> (webpack:///node_modules/tslib/tslib.es6.js:70:11)
            at error (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:21:20)
            at handleError (webpack:///src/app/layout/app-layout/services/app-layout-facade/app-layout-facade.service.ts:179:31)
            at Generator.next
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)"
      `);
    });
  });
});
