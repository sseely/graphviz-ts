# T1 — Project Scaffold

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC; every
algorithm and numerical constant must be reproduced exactly. T1 creates the
project scaffold so that every subsequent task can compile and test immediately.

## Task

Create all configuration files for a TypeScript 5.x project using ESM modules,
Vitest for testing, esbuild as a build tool, and peggy as the DOT-parser build
step. No source files go in `src/` during this task — only config and CI.

## Write-Set

```
package.json
tsconfig.json
vitest.config.ts
.gitignore
.github/workflows/ci.yml
```

## Read-Set

No source files to read. Derive configuration from the requirements below.

## Architecture Decisions

- AD-11: DOT parser via Peggy (`peggy --format es --dts src/parser/dot.pegjs`)

## Interface Contracts

None — this task produces only configuration files.

## Acceptance Criteria

- Given an empty `src/` directory, when `tsc --noEmit` is run, then it exits 0.
- Given no test files, when `vitest run` is run, then it exits 0 (no tests is
  not a failure).
- Given `package.json`, then it contains `"type": "module"` and lists no
  runtime dependencies (only devDependencies).
- Given `tsconfig.json`, then it enables `"strict": true`, targets `"ES2022"`,
  uses `"module": "NodeNext"`, and includes `src/**/*` and `test/**/*`.

## Key Requirements

### package.json

- `"type": "module"` — ESM throughout.
- `"license": "EPL-2.0"` — project license.
- No runtime `dependencies` block (or an empty object). All tools are
  `devDependencies`.
- Required devDependencies: `typescript` (5.x), `vitest`, `esbuild`, `peggy`.
- Scripts: `"build": "esbuild src/index.ts --bundle --format=esm --outfile=dist/index.js"`,
  `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.

### tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": false,
    "skipLibCheck": false
  },
  "include": ["src/**/*", "test/**/*"]
}
```

### vitest.config.ts

Configure Vitest for ESM. No special transforms needed for pure TypeScript.
Set `include: ["src/**/*.test.ts", "test/**/*.test.ts"]`.

### .gitignore

Include: `node_modules/`, `dist/`, `*.js` (generated parser), `*.d.ts`
(generated parser declarations), `.DS_Store`. Do NOT ignore `src/` or `test/`.

### .github/workflows/ci.yml

Single job `ci` on `push` and `pull_request` to `main`. Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: '22'`
3. `npm ci`
4. `npm run typecheck`
5. `npm test`

### EPL-2.0 header

Every source file in `src/` must begin with:

```typescript
// SPDX-License-Identifier: EPL-2.0
```

The scaffold task does not create source files, but `vitest.config.ts` is a
source file and must carry this header.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 (no test files is not a failure)
- One commit: `feat(scaffold): initialize typescript project`
