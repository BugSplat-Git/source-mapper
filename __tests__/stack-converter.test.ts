import * as fs from 'fs';
import * as path from 'path';
import { StackConverter } from '../lib/stack-converter';

const TESTING_DIR = '__tests__';
const TESTING_DATA_DIR = path.join(TESTING_DIR, 'test-data');

const readStack = (file: string): string => {
  return fs.readFileSync(file, {
    encoding: 'utf8',
    flag: 'r',
  });
};

describe('StackConverter', () => {
  describe('constructor', () => {
    test('throws if no sourceMapFilePaths were provided', () => {
      expect(() => new StackConverter([])).toThrow(/Could not create StackConverter: no source map file paths were provided!/);
    });
  });

  describe('createFromDirectory', () => {
    test('throws if no sourceMapFilePaths were provided', async () => {
      await expect(
        async () => {
          const baseFile = 'dir-exists-no-map-files';
          const mapFilePath = path.join(TESTING_DATA_DIR, baseFile);
          await StackConverter.createFromDirectory(mapFilePath);
        }
      ).rejects.toThrow(/Could not create StackConverter: no source map file paths were provided!/);
    });

    test('throws if directory does not exist at provided path', async () => {
      await expect(
        async () => {
          await StackConverter.createFromDirectory('does-not-exist');
        }
      ).rejects.toThrow(/Could not create StackConverter: does-not-exist does not exist or is inaccessible/);
    });
  });
  
  describe('convert', () => {
    test('empty stack results in empty results but no error', async () => {
      const mapFile = path.join(TESTING_DATA_DIR, 'stack-1.js.map');
      const stackConverter = new StackConverter([mapFile]);
      const { error, stack } = await stackConverter.convert('');
      expect(error).toBeUndefined();
      expect(stack).toMatchInlineSnapshot('""');
    });

    test('source map file that does not exist results stack frame with error message', async () => {
      const missingJsFileName = 'does-not-exist.js';
      const missingJsMapFileName = `${missingJsFileName}.map`;
      const missingJsMapPath = path.join(TESTING_DATA_DIR, missingJsMapFileName);
      const stackConverter = new StackConverter([missingJsMapPath]);
      const { error, stack } = await stackConverter.convert(`    at hello (${missingJsFileName}:1:1337)`);
      expect(error).toBeFalsy();
      expect(stack).toMatch(new RegExp(`Error loading source map for frame \\(file .*${missingJsMapFileName} does not exist or is inaccessible\\)`));
    });

    test('empty source map file results stack frame with error message', async () => {
      const emptyJsFileName = 'empty.js';
      const emptyJsMapFileName = `${emptyJsFileName}.map`;
      const emptyJsMapPath = path.join(TESTING_DATA_DIR, emptyJsMapFileName);
      const stackConverter = new StackConverter([emptyJsMapPath]);
      const { error, stack } = await stackConverter.convert(`    at hello (${emptyJsFileName}:1:1337)`);
      expect(error).toBeFalsy();
      expect(stack).toMatch(new RegExp(`Error loading source map for frame \\(file .*${emptyJsMapFileName} was empty\\)`));
    });

    test('source map file that can\'t be parsed results stack frame with error message', async () => {
      const stackFrameFileName = 'corrupt.js';
      const emptyJsMapPath = path.join(TESTING_DATA_DIR, `${stackFrameFileName}.map`);
      const stackConverter = new StackConverter([emptyJsMapPath]);
      const { error, stack } = await stackConverter.convert(`    at hello (${stackFrameFileName}:1:1337)`);
      expect(error).toBeFalsy();
      expect(stack).toMatch(/Error loading source map for frame \(could not parse source map\)/);
    });

    test('read in stack-1 map file and convert stack-1 sample data', async () => {
      const baseFile = 'stack-1';
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const stackConverter = new StackConverter([mapFilePath]);
      const stackFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = readStack(stackFilePath);
      const { error, stack } = await stackConverter.convert(stackText);
      expect(error).toBeUndefined();
      expect(stack).toMatchInlineSnapshot(`
        "Error: Crush your bugs!
            at e.onButtonClick (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at Fo (dummy.ts:2:31)
            at i (dummy.ts:2:31)
            at HTMLButtonElement.<anonymous> (dummy.ts:2:31)
            at e.invokeTask (dummy.ts:2:31)
            at Object.onInvokeTask (dummy.ts:2:31)
            at e.invokeTask (dummy.ts:2:31)
            at t.runTask (dummy.ts:2:31)
            at t.invokeTask [as invoke] (dummy.ts:2:31)"
      `);
    });

    test('read in stack trace containing frames from multiple files missing source maps converts stack with errors',  async () => {
      const stackAndSourceMapDir = path.join(TESTING_DATA_DIR, 'dir-multiple-source-map-files');
      const stackConverter = new StackConverter([
        path.join(stackAndSourceMapDir, 'main-es2015.cd6a577558c44d1be6da.js.map'),
        path.join(stackAndSourceMapDir, 'polyfills-es2015.2846539e99aef31c99d5.js.map')
      ]);
      const stackFile = path.join(stackAndSourceMapDir, 'stack-to-convert.txt');
      const stackText = readStack(stackFile);
      const { error, stack } = await stackConverter.convert(stackText);
      expect(error).toBeUndefined();
      expect(stackText).toEqual(stackText);
      expect(stack).toMatchInlineSnapshot(`
        "Error: Http failure response for https://app.bugsplat.com/api/subscription.php?database=AutoDb_04102021_95345: 502 OK
            at t.<anonymous> (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:32:16)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)
            at s (webpack:///node_modules/tslib/tslib.es6.js:70:11)
            at error (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:21:20)
            at e.<anonymous> (https://app.bugsplat.com/v2/26-es2015.25866671d60dd4058a4f.js:1:3715)  ***Error loading source map for frame (source map not found)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)"
      `);
    });

    test('read in stack trace containing frames from multiple files and convert without errors', async () => {
      const stackAndSourceMapDir = path.join(TESTING_DATA_DIR, 'dir-multiple-source-map-files');
      const stackConverter = await StackConverter.createFromDirectory(stackAndSourceMapDir);
      const stackFile = path.join(stackAndSourceMapDir, 'stack-to-convert.txt');
      const stackText = readStack(stackFile);
      const { error, stack } = await stackConverter.convert(stackText);
      expect(error).toBeUndefined();
      expect(stackText).toEqual(stackText);
      expect(stack).toMatchInlineSnapshot(`
        "Error: Http failure response for https://app.bugsplat.com/api/subscription.php?database=AutoDb_04102021_95345: 502 OK
            at t.<anonymous> (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:32:16)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)
            at s (webpack:///node_modules/tslib/tslib.es6.js:70:11)
            at error (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:21:20)
            at handleError (webpack:///src/app/layout/app-layout/services/app-layout-facade/app-layout-facade.service.ts:179:31)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)"
      `);
    });
  });
});
