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

        source-mapper [ [ "/source-map-directory" OR "/source.js.map" ] [ "/stack-trace.txt" ] ]
    
    * Optionally provide either a path to a directory containing source maps or a .map.js file - Defaults to the current directory
    * Optionally provide a path to a .txt file containing a JavaScript Error stack trace - Defaults to the value in the clipboard
    
    ❤️ support@bugsplat.com
```

3. Run `source-mapper` and optionally specify a path to a directory containing .js.map files, path to a single .js.map file, and a path to a .txt file containing a stringified JavaScript Error. If no options are provided `source-mapper` will default to looking in the current directory for source maps and attempt to read the stringified JavaScript error stack from the system clipboard.

## 🧩 API

1. Install this package locally `npm i @bugsplat/source-mapper`
2. Import `SourceMapper` from `@bugsplat/source-mapper`

```ts
import { SourceMapper } from '@bugsplat/source-mapper';
```

3. Create a new instance of `SourceMapper` passing it an array of paths to source map files. You can also await the static factory function `createFromDirectory(directory: string): Promise<SourceMapper>` which takes a path to a directory and creates a new SourceMapper with an array of source map file paths it finds in the specified directory

```ts
const mapper = new SourceMapper(sourceMapFilePaths);
```

```ts
const mapper = await SourceMapper.createFromDirectory(directory);
```

4. Await the call to convert passing it the stack property from a JavaScript Error object
```ts
const result = await mapper.convert(error.stack);
```

Thanks for using BugSplat!
