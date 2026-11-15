import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DEBUG_IDS_DIR = path.resolve('spec', 'test-data', 'debug-ids');
const BY_NAME_DIR = path.join(DEBUG_IDS_DIR, 'by-name');
const STACK_FILE = path.join(DEBUG_IDS_DIR, 'stack.txt');
const CHECKOUT_MAP = path.join(DEBUG_IDS_DIR, 'by-id', '9f2c1a7e3b4d4c5e8f60112233445566', 'index-bx3k.js.map');
const CART_MAP = path.join(DEBUG_IDS_DIR, 'by-id', '0a1b2c3d4e5f46789abcdef012345678', 'index-bx3k.js.map');
const VENDOR_FRAME = '    at HTMLButtonElement.<anonymous> (https://example.com/assets/vendor-Q9zT.js:1:2345)  ***Error loading source map for frame (source map not found)';

type Result = { code: number, stdout: string, stderr: string };

// Runs bin/index.ts the same way npm run cmd does
const run = (...args: Array<string>): Promise<Result> => {
  const tsNode = require.resolve('ts-node/dist/bin.js');
  const cli = path.resolve('bin', 'index.ts');
  const env = { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' };
  return new Promise(resolve => {
    execFile(process.execPath, [tsNode, cli, ...args], { env }, (error, stdout, stderr) => {
      const code = error ? error.code as number : 0;
      resolve({ code, stdout, stderr });
    });
  });
};

describe('source-mapper command line', () => {
  let tempDir: string;
  let manifestFile: string;
  let defaultTimeoutInterval: number;

  beforeAll(() => {
    defaultTimeoutInterval = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-mapper-cli-'));
    manifestFile = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(manifestFile, JSON.stringify({
      'https://example.com/assets/index-BX3k.js': { map: CHECKOUT_MAP, debugId: '9f2c1a7e3b4d4c5e8f60112233445566' },
      'https://example.com/admin/assets/index-BX3k.js?v=7': { map: CART_MAP, debugId: '0a1b2c3d4e5f46789abcdef012345678' }
    }));
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = defaultTimeoutInterval;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('prints the package version with --version', async () => {
    const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const { code, stdout } = await run('--version');
    expect(code).toEqual(0);
    expect(stdout).toEqual(`${version}\n`);
  });

  it('prints usage with --help', async () => {
    const { code, stdout } = await run('--help');
    expect(code).toEqual(0);
    expect(stdout).toContain('source-mapper command line usage');
  });

  it('converts a stack with a source map directory and a stack file', async () => {
    const { code, stdout } = await run(BY_NAME_DIR, STACK_FILE);
    expect(code).toEqual(0);
    expect(stdout).toEqual([
      'Error: Order failed: 42',
      '    at fail (../src/legacy.ts:2:8)',
      '    at run (../src/legacy.ts:6:2)',
      '    at fail (../src/legacy.ts:2:8)',
      VENDOR_FRAME,
      ''
    ].join('\n'));
  });

  it('converts a stack with a source map file and a stack file', async () => {
    const { code, stdout } = await run(path.join(BY_NAME_DIR, 'index-BX3k.js.map'), STACK_FILE);
    expect(code).toEqual(0);
    expect(stdout).toContain('    at run (../src/legacy.ts:6:2)\n');
  });

  it('converts a stack with a source map directory that contains a source map with a lowercased name', async () => {
    const { code, stdout } = await run(path.dirname(CHECKOUT_MAP), STACK_FILE);
    expect(code).toEqual(0);
    expect(stdout).toEqual([
      'Error: Order failed: 42',
      '    at fail (../src/checkout.ts:2:8)',
      '    at run (../src/checkout.ts:6:2)',
      '    at fail (../src/checkout.ts:2:8)',
      VENDOR_FRAME,
      ''
    ].join('\n'));
  });

  it('converts a stack with a source map directory, a stack file and a manifest', async () => {
    const { code, stdout } = await run(BY_NAME_DIR, STACK_FILE, manifestFile);
    expect(code).toEqual(0);
    expect(stdout).toEqual([
      'Error: Order failed: 42',
      '    at fail (../src/checkout.ts:2:8)',
      '    at run (../src/checkout.ts:6:2)',
      '    at fail (../src/cart.ts:2:8)',
      VENDOR_FRAME,
      ''
    ].join('\n'));
  });

  it('converts a stack with a manifest if the source map directory does not exist', async () => {
    const { code, stdout } = await run(path.join(tempDir, 'does-not-exist'), STACK_FILE, manifestFile);
    expect(code).toEqual(0);
    expect(stdout).toContain('    at run (../src/checkout.ts:6:2)\n    at fail (../src/cart.ts:2:8)\n');
  });

  it('converts a stack with a manifest if the source map directory is empty', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    fs.mkdirSync(emptyDir);
    const { code, stdout } = await run(emptyDir, STACK_FILE, manifestFile);
    expect(code).toEqual(0);
    expect(stdout).toContain('    at run (../src/checkout.ts:6:2)\n    at fail (../src/cart.ts:2:8)\n');
  });

  it('reads a manifest that starts with a byte order mark', async () => {
    const bomManifestFile = path.join(tempDir, 'bom.json');
    fs.writeFileSync(bomManifestFile, `\uFEFF${fs.readFileSync(manifestFile, 'utf8')}`);
    const { code, stdout } = await run(BY_NAME_DIR, STACK_FILE, bomManifestFile);
    expect(code).toEqual(0);
    expect(stdout).toContain('    at run (../src/checkout.ts:6:2)\n    at fail (../src/cart.ts:2:8)\n');
  });

  it('exits with code 1 if the source map directory does not exist and no manifest was provided', async () => {
    const { code, stdout, stderr } = await run(path.join(tempDir, 'does-not-exist'), STACK_FILE);
    expect(code).toEqual(1);
    expect(stdout).toEqual('');
    expect(stderr).toMatch(/Source map path .*does-not-exist does not exist/);
  });

  it('exits with code 1 if the source map directory has no source maps and no manifest was provided', async () => {
    const { code, stderr } = await run(path.resolve('spec', 'test-data', 'dir-exists-no-map-files'), STACK_FILE);
    expect(code).toEqual(1);
    expect(stderr).toContain('no source map file paths were provided');
  });

  it('exits with code 1 if the manifest does not exist', async () => {
    const { code, stdout, stderr } = await run(BY_NAME_DIR, STACK_FILE, path.join(tempDir, 'missing.json'));
    expect(code).toEqual(1);
    expect(stdout).toEqual('');
    expect(stderr).toMatch(/Could not read contents of manifest file .*missing.json/);
  });

  it('exits with code 1 if the manifest is not valid JSON', async () => {
    const { code, stderr } = await run(BY_NAME_DIR, STACK_FILE, STACK_FILE);
    expect(code).toEqual(1);
    expect(stderr).toMatch(/Manifest file .*stack.txt is not valid JSON/);
  });

  it('exits with code 1 if the manifest is not a JSON object', async () => {
    const arrayManifestFile = path.join(tempDir, 'array.json');
    fs.writeFileSync(arrayManifestFile, '[]');
    const { code, stderr } = await run(BY_NAME_DIR, STACK_FILE, arrayManifestFile);
    expect(code).toEqual(1);
    expect(stderr).toMatch(/Manifest file .*array.json must contain a JSON object/);
  });
});
