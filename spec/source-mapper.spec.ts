import * as fs from 'fs';
import * as path from 'path';
import { SourceMapper } from '../lib/source-mapper';

const TESTING_DIR = 'spec';
const TESTING_DATA_DIR = path.join(TESTING_DIR, 'test-data');

const readStack = (file: string): string => {
  return fs.readFileSync(file, {
    encoding: 'utf8',
    flag: 'r',
  });
};

describe('SourceMapper', () => {
  describe('constructor', () => {
    it('throws if no sourceMapFilePaths were provided', () => {
      expect(() => new SourceMapper([])).toThrowError(/Could not create SourceMapper: no source map file paths were provided!/);
    });
  });

  describe('createFromDirectory', () => {
    it('throws if no sourceMapFilePaths were provided', async () => {
      const baseFile = 'dir-exists-no-map-files';
      const mapFilePath = path.join(TESTING_DATA_DIR, baseFile);
      const promise = SourceMapper.createFromDirectory(mapFilePath);
      await expectAsync(promise).toBeRejectedWithError(/Could not create SourceMapper: no source map file paths were provided!/);
    });

    it('throws if directory does not exist at provided path', async () => {
      await expectAsync(SourceMapper.createFromDirectory('does-not-exist')).toBeRejectedWithError(/Could not create SourceMapper: does-not-exist does not exist or is inaccessible/);
    });
  });
  
  describe('convert', () => {
    it('empty stack results in empty results but no error', async () => {
      const mapFile = path.join(TESTING_DATA_DIR, 'stack-1.js.map');
      const sourceMapper = new SourceMapper([mapFile]);
      const { error, stack } = await sourceMapper.convert('');
      expect(error).toBeUndefined();
      expect(stack).toEqual('');
    });

    it('source map file that does not exist results stack frame with error message', async () => {
      const missingJsFileName = 'does-not-exist.js';
      const missingJsMapFileName = `${missingJsFileName}.map`;
      const missingJsMapPath = path.join(TESTING_DATA_DIR, missingJsMapFileName);
      const sourceMapper = new SourceMapper([missingJsMapPath]);
      const { error, stack } = await sourceMapper.convert(`    at hello (${missingJsFileName}:1:1337)`);
      expect(error).toBeFalsy();
      expect(stack).toMatch(new RegExp(`Error loading source map for frame \\(file .*${missingJsMapFileName} does not exist or is inaccessible\\)`));
    });

    it('empty source map file results stack frame with error message', async () => {
      const emptyJsFileName = 'empty.js';
      const emptyJsMapFileName = `${emptyJsFileName}.map`;
      const emptyJsMapPath = path.join(TESTING_DATA_DIR, emptyJsMapFileName);
      const sourceMapper = new SourceMapper([emptyJsMapPath]);
      const { error, stack } = await sourceMapper.convert(`    at hello (${emptyJsFileName}:1:1337)`);
      expect(error).toBeFalsy();
      expect(stack).toMatch(new RegExp(`Error loading source map for frame \\(file .*${emptyJsMapFileName} was empty\\)`));
    });

    it('source map file that can\'t be parsed results stack frame with error message', async () => {
      const stackFrameFileName = 'corrupt.js';
      const emptyJsMapPath = path.join(TESTING_DATA_DIR, `${stackFrameFileName}.map`);
      const sourceMapper = new SourceMapper([emptyJsMapPath]);
      const { error, stack } = await sourceMapper.convert(`    at hello (${stackFrameFileName}:1:1337)`);
      expect(error).toBeFalsy();
      expect(stack).toMatch(/Error loading source map for frame \(could not parse source map\)/);
    });

    it('read in stack-1 map file and convert stack-1 sample data', async () => {
      const baseFile = 'stack-1';
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const sourceMapper = new SourceMapper([mapFilePath]);
      const stackFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = readStack(stackFilePath);
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(normalize(stack!)).toEqual(
        normalize(
          `Error: Crush your bugs!
            at e.onButtonClick (dummy.ts:2:31)
            at <unknown> (dummy.ts:2:31)
            at Fo (dummy.ts:2:31)
            at i (dummy.ts:2:31)
            at HTMLButtonElement.<anonymous> (dummy.ts:2:31)
            at e.invokeTask (dummy.ts:2:31)
            at Object.onInvokeTask (dummy.ts:2:31)
            at e.invokeTask (dummy.ts:2:31)
            at t.runTask (dummy.ts:2:31)
            at t.invokeTask [as invoke] (dummy.ts:2:31)`
        )
      );
    });

    it('should convert stack using file specified by win32 path', async () => {
      const baseFile = 'crasher';
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const sourceMapper = new SourceMapper([mapFilePath]);
      const stackFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = readStack(stackFilePath);
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(normalize(stack!)).toContain(
        normalize(
          `Error: BugSplat!
            at crash (../../src/crasher.ts:27:10)
            at sampleStackFrame2 (../../src/crasher.ts:23:4)
            at sampleStackFrame1 (../../src/crasher.ts:19:4)
            at sampleStackFrame0 (../../src/crasher.ts:15:4)
            at generateStackFramesAndCrash (../../src/crasher.ts:11:4)
            at uncaughtException (../../src/crasher.ts:3:4)`
        )
      );
    });

    it('should include exception message in stack', async () => {
      const baseFile = 'stack-2';
      const mapFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.js.map`);
      const sourceMapper = new SourceMapper([mapFilePath]);
      const stackFilePath = path.join(TESTING_DATA_DIR, `${baseFile}.txt`);
      const stackText = readStack(stackFilePath);
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(normalize(stack!)).toEqual(
        normalize(
          `TypeError: Bug.Splat is not a function
            at TypeError (webpack:///projects/my-angular-crasher/src/app/app.component.ts:33:4)`
        )
      );
    });

    it('should map callstack from angular app created by esbuild', async () => {
      const angularDir = path.join(TESTING_DATA_DIR, 'angular');
      const symbols = ['main.js.map', 'polyfills.js.map'];
      const mapFilePaths = symbols.map(file => path.join(angularDir, file));
      const sourceMapper = new SourceMapper(mapFilePaths);
      const stackFilePath = path.join(angularDir, 'angular.txt');
      const stackText = readStack(stackFilePath);
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(normalize(stack!)).toEqual(
        normalize(
          `TypeError: Bug.Splat is not a function
            at TypeError (projects/my-angular-crasher/src/app/app.component.ts:33:4)
            at NodeInjectorFactory.AppComponent_Factory [as factory] (http://127.0.0.1:8080/main.js:15082:12)  ***Could not convert stack frame (original position not found)
            at getNodeInjectable (node_modules/@angular/core/fesm2022/core.mjs:4257:37)
            at createRootComponent (node_modules/@angular/core/fesm2022/core.mjs:15300:30)
            at ComponentFactory.create (node_modules/@angular/core/fesm2022/core.mjs:15167:18)
            at _ApplicationRef.bootstrap (node_modules/@angular/core/fesm2022/core.mjs:31879:39)
            at <unknown> (node_modules/@angular/core/fesm2022/core.mjs:31577:59)
            at Array.forEach (<anonymous>)
            at _PlatformRef._moduleDoBootstrap (node_modules/@angular/core/fesm2022/core.mjs:31577:39)
            at <unknown> (node_modules/@angular/core/fesm2022/core.mjs:31548:17)`
        )
      );
    });

    it('read in stack trace containing frames from multiple files missing source maps converts stack with errors',  async () => {
      const stackAndSourceMapDir = path.join(TESTING_DATA_DIR, 'dir-multiple-source-map-files');
      const sourceMapper = new SourceMapper([
        path.join(stackAndSourceMapDir, 'main-es2015.cd6a577558c44d1be6da.js.map'),
        path.join(stackAndSourceMapDir, 'polyfills-es2015.2846539e99aef31c99d5.js.map')
      ]);
      const stackFile = path.join(stackAndSourceMapDir, 'stack-to-convert.txt');
      const stackText = readStack(stackFile);
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(stackText).toEqual(stackText);
      expect(normalize(stack!)).toEqual(
        normalize(
          `Error: Http failure response for https://app.bugsplat.com/api/subscription.php?database=AutoDb_04102021_95345: 502 OK
            at t.<anonymous> (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:32:16)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)
            at s (webpack:///node_modules/tslib/tslib.es6.js:70:11)
            at error (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:21:20)
            at e.<anonymous> (https://app.bugsplat.com/v2/26-es2015.25866671d60dd4058a4f.js:1:3715)  ***Error loading source map for frame (source map not found)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)`
        )
      );
    });

    it('read in stack trace containing frames from multiple files and convert without errors', async () => {
      const stackAndSourceMapDir = path.join(TESTING_DATA_DIR, 'dir-multiple-source-map-files');
      const sourceMapper = await SourceMapper.createFromDirectory(stackAndSourceMapDir);
      const stackFile = path.join(stackAndSourceMapDir, 'stack-to-convert.txt');
      const stackText = readStack(stackFile);
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(stackText).toEqual(stackText);
      expect(normalize(stack!)).toEqual(
        normalize(
          `Error: Http failure response for https://app.bugsplat.com/api/subscription.php?database=AutoDb_04102021_95345: 502 OK
            at t.<anonymous> (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:32:16)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)
            at s (webpack:///node_modules/tslib/tslib.es6.js:70:11)
            at error (webpack:///src/app/common/services/bugsplat-custom-error-handler/bugsplat-custom-error-handler.ts:21:20)
            at handleError (webpack:///src/app/layout/app-layout/services/app-layout-facade/app-layout-facade.service.ts:179:31)
            at Generator.next (<anonymous>)
            at next (webpack:///node_modules/tslib/tslib.es6.js:74:70)
            at executor (webpack:///node_modules/zone.js/dist/zone-evergreen.js:960:32)`
          )
        );
    });
  });
});

function normalize(value: string): string {
  return value.replaceAll(/\s/g, '');
}