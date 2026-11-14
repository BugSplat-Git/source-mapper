[![bugsplat-github-banner-basic-outline](https://user-images.githubusercontent.com/20464226/149019306-3186103c-5315-4dad-a499-4fd1df408475.png)](https://bugsplat.com)
<br/>
# <div align="center">BugSplat</div> 
### **<div align="center">Crash and error reporting built for busy developers.</div>**
<div align="center">
    <a href="https://twitter.com/BugSplatCo">
        <img alt="Follow @bugsplatco on Twitter" src="https://img.shields.io/twitter/follow/bugsplatco?label=Follow%20BugSplat&style=social">
    </a>
    <a href="https://discord.gg/K4KjjRV5ve">
        <img alt="Join BugSplat on Discord" src="https://img.shields.io/discord/664965194799251487?label=Join%20Discord&logo=Discord&style=social">
    </a>
</div>

# 🗺️ source-mapper
`source-mapper` is a utility for translating function names, file names and line numbers in uglified JavaScript Error stack frames to the corresponding values in the original source. `source-mapper` is distributed as both a package and a library and is used by the [BugSplat](https://www.bugsplat.com) backend to deliver crash reporting as a service for JavaScript and TypeScript applications.

The following is an example JavaScript Error stack converted to its TypeScript equivalent using `source-mapper`:

```
Error: BugSplat rocks!
    at crash (/Users/bobby/Desktop/bugsplat/source-mapper/dist/bin/cmd.js:16:11)
    at /Users/bobby/Desktop/bugsplat/source-mapper/dist/bin/cmd.js:6:9
    at Object.<anonymous> (/Users/bobby/Desktop/bugsplat/source-mapper/dist/bin/cmd.js:14:3)
```

```
Error: BugSplat rocks!
    at crash (../../bin/cmd.ts:15:10)
    at <unknown> (../../bin/cmd.ts:5:8)
    at Object.<anonymous> (../../bin/cmd.ts:12:2)
```

## 🖥 Command Line

1. Install this package globally `npm i -g @bugsplat/source-mapper`
2. Run `source-mapper -h` to see the latest usage information:

```bash
bobby@BugSplat % ~ % source-mapper -h

    @bugsplat/source-mapper contains a command line utility and set of libraries to help you demangle JavaScript stack frames.

    source-mapper command line usage:

        source-mapper [ [ "/source-map-directory" OR "/source.js.map" ] [ "/stack-trace.txt" ] [ "/manifest.json" ] ]
        source-mapper --version
    
    * Optionally provide either a path to a directory containing source maps or a .map.js file - Defaults to the current directory
    * Optionally provide a path to a .txt file containing a JavaScript Error stack trace - Defaults to the value in the clipboard
    * Optionally provide a path to a .json file that states which source map each stack frame file uses - Stack frame files that aren't listed are matched to source maps by file name. When this file is provided the source map directory can be empty or missing
    * Use --version to print the version of source-mapper
    
    ❤️ support@bugsplat.com
```

3. Run `source-mapper` and optionally specify a path to a directory containing .js.map files, path to a single .js.map file, and a path to a .txt file containing a stringified JavaScript Error. If no options are provided `source-mapper` will default to looking in the current directory for source maps and attempt to read the stringified JavaScript error stack from the system clipboard.

4. Run `source-mapper --version` to print the installed version.

### Matching by file name

`source-mapper` matches a stack frame to a source map by file name. The frame `at f (https://example.com/assets/main.js?v=2:1:2345)` uses the source map named `main.js.map`: the base name of the frame's file, without the query string and fragment, followed by `.map`. The name must match exactly, so `domain.js.map` is not used for `main.js`. `source-mapper` only looks at the files directly inside the source map directory, not at files in its subdirectories.

A frame that has no source map is copied to the output followed by `***Error loading source map for frame (source map not found)`.

### Matching with a manifest

File names can't tell two source maps apart when two chunks are served under the same file name, and they don't match when a file is renamed after it is built. If you already know which source map a file uses, pass a manifest as the third argument:

```bash
source-mapper ./maps ./stack-trace.txt ./manifest.json
```

The manifest is a JSON object. Each key is a stack frame file exactly as it appears in the stack, including the scheme, host, path and query string. Each value contains the path to a source map and the [debug ID](https://github.com/tc39/ecma426/blob/main/proposals/debug-id.md) the source map must contain:

```json
{
  "https://example.com/assets/index-BX3k.js": {
    "map": "/maps/9f2c1a7e3b4d4c5e8f60112233445566/index-bx3k.js.map",
    "debugId": "9f2c1a7e-3b4d-4c5e-8f60-112233445566"
  }
}
```

* `map` can have any file name. A relative path is resolved against the current working directory.
* `source-mapper` reads the debug ID from the top-level `debugId` field of the source map and, if that field is missing, from `debug_id`. Debug IDs are compared without hyphens and without regard to letter case.
* If the source map can't be read, or doesn't contain the debug ID the manifest states, `source-mapper` ignores the manifest entry and matches the frame by file name.
* Frames whose file is not a key of the manifest are matched by file name.
* When a manifest is provided, the source map directory can be empty or missing.

## 🧩 API

1. Install this package locally `npm i @bugsplat/source-mapper`
2. Import `SourceMapper` from `@bugsplat/source-mapper`

```ts
import { SourceMapper } from '@bugsplat/source-mapper';
```

3. Create a new instance of `SourceMapper` passing it an array of paths to source map files. You can also await the static factory function `createFromDirectory(directory: string, manifest?: SourceMapManifest): Promise<SourceMapper>` which takes a path to a directory and creates a new SourceMapper with an array of source map file paths it finds in the specified directory

```ts
const mapper = new SourceMapper(sourceMapFilePaths);
```

```ts
const mapper = await SourceMapper.createFromDirectory(directory);
```

4. Optionally pass a manifest as the second argument of the constructor or of `createFromDirectory`. The manifest is the object described in [Matching with a manifest](#matching-with-a-manifest). With a manifest, the array of source map file paths can be empty and the directory can be empty or missing

```ts
import { SourceMapper, SourceMapManifest } from '@bugsplat/source-mapper';

const manifest: SourceMapManifest = {
  'https://example.com/assets/index-BX3k.js': {
    map: '/maps/9f2c1a7e3b4d4c5e8f60112233445566/index-bx3k.js.map',
    debugId: '9f2c1a7e-3b4d-4c5e-8f60-112233445566'
  }
};
const mapper = new SourceMapper([], manifest);
```

5. Await the call to convert passing it the stack property from a JavaScript Error object
```ts
const result = await mapper.convert(error.stack);
```

Thanks for using BugSplat!
