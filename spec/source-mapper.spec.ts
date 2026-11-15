import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SourceMapManifest, SourceMapper } from '../lib';

const TESTING_DIR = 'spec';
const TESTING_DATA_DIR = path.join(TESTING_DIR, 'test-data');
const DEBUG_IDS_DIR = path.join(TESTING_DATA_DIR, 'debug-ids');
const NOT_FOUND = '***Error loading source map for frame (source map not found)';

// index-bx3k.js.map files for two different chunks that are both served as index-BX3k.js
const CHECKOUT_FILE = 'https://example.com/assets/index-BX3k.js';
const CHECKOUT_DEBUG_ID = '9f2c1a7e3b4d4c5e8f60112233445566';
const CHECKOUT_MAP = path.join(DEBUG_IDS_DIR, 'by-id', CHECKOUT_DEBUG_ID, 'index-bx3k.js.map');
const CART_FILE = 'https://example.com/admin/assets/index-BX3k.js?v=7';
const CART_DEBUG_ID = '0a1b2c3d4e5f46789abcdef012345678';
const CART_MAP = path.join(DEBUG_IDS_DIR, 'by-id', CART_DEBUG_ID, 'index-bx3k.js.map');
// index-BX3k.js.map without a debug ID
const BY_NAME_DIR = path.join(DEBUG_IDS_DIR, 'by-name');

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

    it('does not throw if no sourceMapFilePaths were provided with a manifest', () => {
      expect(() => new SourceMapper([], {})).not.toThrow();
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

    it('resolves if directory contains no source map files and a manifest was provided', async () => {
      const directory = path.join(TESTING_DATA_DIR, 'dir-exists-no-map-files');
      await expectAsync(SourceMapper.createFromDirectory(directory, {})).toBeResolved();
    });

    it('resolves if directory does not exist and a manifest was provided', async () => {
      await expectAsync(SourceMapper.createFromDirectory('does-not-exist', {})).toBeResolved();
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

  describe('convert matching source maps by file name', () => {
    const mainMap = path.join(TESTING_DATA_DIR, 'angular', 'main.js.map');
    const stack1Map = path.join(TESTING_DATA_DIR, 'stack-1.js.map');
    const mainFrame = (file: string) => `    at new _AppComponent (${file}:15036:22)`;
    const mainFrameConverted = '    at TypeError (projects/my-angular-crasher/src/app/app.component.ts:33:4)';

    it('does not use the source map of a file named in the query string of another file', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const frame = mainFrame('http://127.0.0.1:8080/other.js?next=/v2/main.js');
      const { stack } = await sourceMapper.convert(frame);
      expect(stack).toEqual(`${frame}  ${NOT_FOUND}`);
    });

    it('does not use a source map whose name ends with the name of the source map for the frame', async () => {
      // k-1.js.map is a substring of stack-1.js.map, the same way a.js.map is a substring of data.js.map
      const sourceMapper = new SourceMapper([stack1Map]);
      const frame = '    at e.onButtonClick (http://localhost:8080/k-1.js:1:141012)';
      const { stack } = await sourceMapper.convert(frame);
      expect(stack).toEqual(`${frame}  ${NOT_FOUND}`);
    });

    it('does not use a source map in a directory whose name matches the frame', async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'source-mapper-'));
      try {
        const mapFile = path.join(directory, 'main.js.map', 'other.js.map');
        fs.mkdirSync(path.dirname(mapFile));
        fs.copyFileSync(mainMap, mapFile);
        const sourceMapper = new SourceMapper([mapFile]);
        const frame = mainFrame('http://127.0.0.1:8080/main.js');
        const { stack } = await sourceMapper.convert(frame);
        expect(stack).toEqual(`${frame}  ${NOT_FOUND}`);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it('ignores the query string of a url', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const { stack } = await sourceMapper.convert(mainFrame('http://127.0.0.1:8080/main.js?v=1.2.3&next=/a/b.js'));
      expect(stack).toEqual(mainFrameConverted);
    });

    it('ignores the fragment of a url', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const { stack } = await sourceMapper.convert(mainFrame('http://127.0.0.1:8080/main.js#/route/a.js'));
      expect(stack).toEqual(mainFrameConverted);
    });

    it('ignores the query string and fragment of a url', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const { stack } = await sourceMapper.convert(mainFrame('http://127.0.0.1:8080/main.js?v=1#top'));
      expect(stack).toEqual(mainFrameConverted);
    });

    it('ignores the query string of a file without a url scheme', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const { stack } = await sourceMapper.convert(mainFrame('main.js?v=1'));
      expect(stack).toEqual(mainFrameConverted);
    });

    it('treats # as part of a posix path', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const { stack } = await sourceMapper.convert(mainFrame('/home/bobby/c#/dist/main.js'));
      expect(stack).toEqual(mainFrameConverted);
    });

    it('treats # as part of a win32 path', async () => {
      const sourceMapper = new SourceMapper([mainMap]);
      const { stack } = await sourceMapper.convert(mainFrame('C:\\dev\\c#\\dist\\main.js'));
      expect(stack).toEqual(mainFrameConverted);
    });

    ['mjs', 'cjs'].forEach(extension => {
      it(`matches a .${extension} file to a .${extension}.map file`, async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'source-mapper-'));
        try {
          fs.copyFileSync(mainMap, path.join(directory, `main.${extension}.map`));
          fs.copyFileSync(stack1Map, path.join(directory, 'main.js.map'));
          const sourceMapper = await SourceMapper.createFromDirectory(directory);
          const { stack } = await sourceMapper.convert(mainFrame(`http://127.0.0.1:8080/main.${extension}?v=1`));
          expect(stack).toEqual(mainFrameConverted);
        } finally {
          fs.rmSync(directory, { recursive: true, force: true });
        }
      });
    });
  });

  describe('convert matching source maps by file name without regard to letter case', () => {
    const byNameMap = path.join(BY_NAME_DIR, 'index-BX3k.js.map');
    const frame = `    at fail (${CHECKOUT_FILE}:2:11)`;

    it('uses a source map with a lowercased name for a frame file with a mixed case name', async () => {
      const sourceMapper = new SourceMapper([CHECKOUT_MAP]);
      const { stack } = await sourceMapper.convert(frame);
      expect(stack).toEqual('    at fail (../src/checkout.ts:2:8)');
    });

    it('uses a source map with a lowercased name found by createFromDirectory', async () => {
      const sourceMapper = await SourceMapper.createFromDirectory(path.dirname(CART_MAP));
      const { stack } = await sourceMapper.convert(readStack(path.join(DEBUG_IDS_DIR, 'stack.txt')));
      expect(stack).toEqual([
        'Error: Order failed: 42',
        '    at fail (../src/cart.ts:2:8)',
        '    at run (../src/cart.ts:6:2)',
        '    at fail (../src/cart.ts:2:8)',
        `    at HTMLButtonElement.<anonymous> (https://example.com/assets/vendor-Q9zT.js:1:2345)  ${NOT_FOUND}`
      ].join('\n'));
    });

    it('uses a source map with a mixed case name for a frame file with a lowercased name', async () => {
      const sourceMapper = new SourceMapper([byNameMap]);
      const { stack } = await sourceMapper.convert('    at fail (https://example.com/assets/index-bx3k.js:2:11)');
      expect(stack).toEqual('    at fail (../src/legacy.ts:2:8)');
    });

    it('prefers a source map whose name has the same case as the frame file', async () => {
      const sourceMapper = new SourceMapper([CHECKOUT_MAP, byNameMap, CART_MAP]);
      const { stack } = await sourceMapper.convert(frame);
      expect(stack).toEqual('    at fail (../src/legacy.ts:2:8)');
    });

    it('reports source map not found if more than one source map matches without regard to letter case', async () => {
      const sourceMapper = new SourceMapper([CHECKOUT_MAP, CART_MAP]);
      const { error, stack } = await sourceMapper.convert(frame);
      expect(error).toBeUndefined();
      expect(stack).toEqual(`${frame}  ${NOT_FOUND}`);
    });

    it('uses a source map that is listed more than once', async () => {
      const sourceMapper = new SourceMapper([CHECKOUT_MAP, CHECKOUT_MAP]);
      const { stack } = await sourceMapper.convert(frame);
      expect(stack).toEqual('    at fail (../src/checkout.ts:2:8)');
    });

    it('does not use a source map whose name ends with the name of the source map for the frame', async () => {
      const sourceMapper = new SourceMapper([CHECKOUT_MAP]);
      const otherFrame = '    at fail (https://example.com/assets/BX3k.js:2:11)';
      const { stack } = await sourceMapper.convert(otherFrame);
      expect(stack).toEqual(`${otherFrame}  ${NOT_FOUND}`);
    });
  });

  describe('convert with manifest', () => {
    const stackText = readStack(path.join(DEBUG_IDS_DIR, 'stack.txt'));
    const vendorFrame = `    at HTMLButtonElement.<anonymous> (https://example.com/assets/vendor-Q9zT.js:1:2345)  ${NOT_FOUND}`;
    const convertedWith = (checkout: string, run: string, cart: string) => [
      'Error: Order failed: 42',
      checkout,
      run,
      cart,
      vendorFrame
    ].join('\n');
    const checkoutFrameNotFound = `    at fail (${CHECKOUT_FILE}:2:11)  ${NOT_FOUND}`;
    const runFrameNotFound = `    at run (${CHECKOUT_FILE}:5:5)  ${NOT_FOUND}`;
    const cartFrameNotFound = `    at fail (${CART_FILE}:2:11)  ${NOT_FOUND}`;
    const manifest = (): SourceMapManifest => ({
      [CHECKOUT_FILE]: { map: CHECKOUT_MAP, debugId: CHECKOUT_DEBUG_ID },
      [CART_FILE]: { map: CART_MAP, debugId: CART_DEBUG_ID }
    });

    it('uses the source map the manifest states for each frame file', async () => {
      const sourceMapper = new SourceMapper([], manifest());
      const { error, stack } = await sourceMapper.convert(stackText);
      expect(error).toBeUndefined();
      expect(stack).toEqual(convertedWith(
        '    at fail (../src/checkout.ts:2:8)',
        '    at run (../src/checkout.ts:6:2)',
        '    at fail (../src/cart.ts:2:8)'
      ));
    });

    it('prefers the manifest over a source map with a matching file name', async () => {
      const sourceMapper = await SourceMapper.createFromDirectory(BY_NAME_DIR, manifest());
      const { stack } = await sourceMapper.convert(stackText);
      expect(stack).toEqual(convertedWith(
        '    at fail (../src/checkout.ts:2:8)',
        '    at run (../src/checkout.ts:6:2)',
        '    at fail (../src/cart.ts:2:8)'
      ));
    });

    it('matches frame files that are not in the manifest by file name', async () => {
      const sourceMapper = await SourceMapper.createFromDirectory(BY_NAME_DIR, { [CART_FILE]: manifest()[CART_FILE] });
      const { stack } = await sourceMapper.convert(stackText);
      expect(stack).toEqual(convertedWith(
        '    at fail (../src/legacy.ts:2:8)',
        '    at run (../src/legacy.ts:6:2)',
        '    at fail (../src/cart.ts:2:8)'
      ));
    });

    it('requires the manifest key to equal the frame file exactly', async () => {
      const sourceMapper = new SourceMapper([], { 'https://example.com/admin/assets/index-BX3k.js': manifest()[CART_FILE] });
      const { stack } = await sourceMapper.convert(stackText);
      expect(stack).toEqual(convertedWith(checkoutFrameNotFound, runFrameNotFound, cartFrameNotFound));
    });

    it('accepts hyphenated and uppercase debug IDs in the manifest', async () => {
      const sourceMapper = new SourceMapper([], {
        [CHECKOUT_FILE]: { map: CHECKOUT_MAP, debugId: '9F2C1A7E-3B4D-4C5E-8F60-112233445566' },
        [CART_FILE]: { map: CART_MAP, debugId: '0a1b2c3d-4e5f-4678-9abc-def012345678' }
      });
      const { stack } = await sourceMapper.convert(stackText);
      expect(stack).toEqual(convertedWith(
        '    at fail (../src/checkout.ts:2:8)',
        '    at run (../src/checkout.ts:6:2)',
        '    at fail (../src/cart.ts:2:8)'
      ));
    });

    it('has test data that contains a debug ID as debugId and as debug_id', () => {
      const debugIdOf = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(debugIdOf(CHECKOUT_MAP).debugId).toEqual('9f2c1a7e-3b4d-4c5e-8f60-112233445566');
      expect(debugIdOf(CHECKOUT_MAP).debug_id).toBeUndefined();
      expect(debugIdOf(CART_MAP).debug_id).toEqual('0A1B2C3D-4E5F-4678-9ABC-DEF012345678');
      expect(debugIdOf(CART_MAP).debugId).toBeUndefined();
    });

    describe('when the source map does not contain the debug ID the manifest states', () => {
      const mismatched = (): SourceMapManifest => ({
        [CHECKOUT_FILE]: { map: CART_MAP, debugId: CHECKOUT_DEBUG_ID },
        [CART_FILE]: manifest()[CART_FILE]
      });

      it('falls back to a source map with a matching file name', async () => {
        const sourceMapper = await SourceMapper.createFromDirectory(BY_NAME_DIR, mismatched());
        const { stack } = await sourceMapper.convert(stackText);
        expect(stack).toEqual(convertedWith(
          '    at fail (../src/legacy.ts:2:8)',
          '    at run (../src/legacy.ts:6:2)',
          '    at fail (../src/cart.ts:2:8)'
        ));
      });

      it('reports source map not found if no source map has a matching file name', async () => {
        const sourceMapper = new SourceMapper([], mismatched());
        const { error, stack } = await sourceMapper.convert(stackText);
        expect(error).toBeUndefined();
        expect(stack).toEqual(convertedWith(checkoutFrameNotFound, runFrameNotFound, '    at fail (../src/cart.ts:2:8)'));
      });
    });

    const unusable: Array<[string, () => SourceMapManifest[string]]> = [
      ['the source map has no debug ID', () => ({ map: path.join(BY_NAME_DIR, 'index-BX3k.js.map'), debugId: CHECKOUT_DEBUG_ID })],
      ['the source map does not exist', () => ({ map: path.join(DEBUG_IDS_DIR, 'does-not-exist.js.map'), debugId: CHECKOUT_DEBUG_ID })],
      ['the source map is a directory', () => ({ map: BY_NAME_DIR, debugId: CHECKOUT_DEBUG_ID })],
      ['the source map is empty', () => ({ map: path.join(TESTING_DATA_DIR, 'empty.js.map'), debugId: CHECKOUT_DEBUG_ID })],
      ['the source map can\'t be parsed', () => ({ map: path.join(TESTING_DATA_DIR, 'corrupt.js.map'), debugId: CHECKOUT_DEBUG_ID })],
      ['the manifest entry has no debug ID', () => ({ map: CHECKOUT_MAP } as SourceMapManifest[string])],
      ['the manifest entry has an invalid debug ID', () => ({ map: CHECKOUT_MAP, debugId: '9f2c1a7e' })],
      ['the manifest entry has no source map', () => ({ debugId: CHECKOUT_DEBUG_ID } as SourceMapManifest[string])],
      ['the manifest entry is not an object', () => (CHECKOUT_MAP as unknown as SourceMapManifest[string])],
      ['the manifest entry is null', () => null]
    ];

    unusable.forEach(([description, entry]) => {
      it(`falls back to a source map with a matching file name if ${description}`, async () => {
        const sourceMapper = await SourceMapper.createFromDirectory(BY_NAME_DIR, { [CHECKOUT_FILE]: entry() });
        const { error, stack } = await sourceMapper.convert(stackText);
        expect(error).toBeUndefined();
        expect(stack).toEqual(convertedWith(
          '    at fail (../src/legacy.ts:2:8)',
          '    at run (../src/legacy.ts:6:2)',
          '    at fail (../src/legacy.ts:2:8)'
        ));
      });
    });

    it('verifies the debug ID of a source map that was already loaded for another frame file', async () => {
      const renamedFile = 'https://example.com/assets/renamed.js';
      const sourceMapper = new SourceMapper([CHECKOUT_MAP], { [renamedFile]: { map: CHECKOUT_MAP, debugId: CART_DEBUG_ID } });
      const { stack } = await sourceMapper.convert(`    at fail (https://example.com/index-bx3k.js:2:11)\n    at fail (${renamedFile}:2:11)`);
      expect(stack).toEqual(`    at fail (../src/checkout.ts:2:8)\n    at fail (${renamedFile}:2:11)  ${NOT_FOUND}`);
    });
  });
});

function normalize(value: string): string {
  return value.replaceAll(/\s/g, '');
}