# graphviz-ts — Claude Code Instructions

## Mission

This project is a faithful TypeScript port of [Graphviz](https://graphviz.org/),
the graph-visualization toolkit originally written in C at AT&T Research and
Lucent Bell Labs. The C source lives at `~/git/graphviz` and is the **canonical
specification** for this project. The output of this port will be consumed as a
library by other projects and must run in a browser (no Node.js-only APIs).

## The C Source Is Sacred

The C implementation in `~/git/graphviz` is the spec. Every file, every type,
every function, every algorithm, and every test exists for a reason — often a
reason that only becomes apparent when a specific edge case is encountered.
Decades of user-reported bugs and layout quirks are encoded in that code.

Rules that follow from this:

- **Do not optimize or simplify algorithms.** If the C code does something that
  looks redundant, inefficient, or odd, preserve it exactly. The oddity is
  almost certainly load-bearing.
- **Do not skip edge-case handling.** Special-case branches in the C code exist
  because someone hit that case in production. Port every branch.
- **Do not merge or split functions arbitrarily.** The function boundaries in the
  C source reflect the original authors' mental model of the algorithm. Maintain
  those boundaries unless TypeScript forces a structural change (e.g., no pointer
  arithmetic).
- **Do not reorder logic.** Side-effect order in C is often intentional. Preserve
  the order of operations exactly, and note deviations explicitly.
- **Port the tests too.** Every test in the C source encodes a known correct
  behavior. All tests must be ported and must pass.

When in doubt, read the C. When still in doubt, keep the C behavior and document
the question.

## Translation Rules

### Type Mappings

| C concept | TypeScript equivalent |
|-----------|----------------------|
| `int`, `long` | `number` (note precision limits for values > 2^53) |
| `double`, `float` | `number` |
| `char *` (string) | `string` |
| `char *` (byte buffer) | `Uint8Array` |
| `struct Foo` | `interface Foo` or `class Foo` (prefer `interface` for plain data) |
| `enum` | `const enum` or `enum` |
| `void *` (generic pointer) | `unknown` or a typed union |
| `FILE *` | Abstract `Writer` interface; concrete implementations per environment |
| Pointer arithmetic | Array + index, or `DataView` for packed binary data |
| `NULL` | `null` or `undefined` (prefer `null` for nullable pointers) |
| `#define` constant | `const` or `const enum` |
| Function pointer | Typed function type or interface with a single call signature |

### No Browser-Hostile APIs

This library must run in a browser. Never use:
- `fs`, `path`, `os`, `child_process`, or any Node.js built-in module
- `process.env` (use a passed-in config object instead)
- `require()` (use ES module `import`)
- Synchronous XHR or blocking I/O

If the C code reads a file (e.g., font metrics, config), expose it as a
parameter or callback so the caller can provide the data.

### Memory Management

C's manual memory model does not translate directly. Rules:
- Prefer immutable data structures where the C code builds then reads a
  structure without mutating it after construction.
- Where the C code mutates in place (common in layout passes), use mutable
  objects and document the mutation contract.
- Do not introduce garbage-collection pressure by creating large numbers of
  short-lived objects in hot loops — prefer reusing objects or using typed
  arrays.

### Naming

- Convert `snake_case` C names to `camelCase` TypeScript names.
- Convert `ALL_CAPS` C macros to `UPPER_SNAKE_CASE` TypeScript constants.
- Keep names recognizable — `agnode` → `agNode`, `agedge` → `agEdge`.
  Do not rename to something unrelated; the C name is the spec reference.
- Every ported symbol should have a JSDoc comment referencing its C origin:
  `/** @see cgraph/graph.c:agopen */`

### No New Abstractions Without Cause

Apply YAGNI strictly here. This is a translation, not a redesign:
- Do not introduce new design patterns (observers, decorators, registries)
  unless the C code already uses an equivalent pattern.
- Do not add configuration options the C code does not have.
- Do not build an "improved API" on top — port the existing API first.
  Idiomatic TypeScript wrappers can be a separate layer, separate package.

## C Source Map

The C source is organized under `~/git/graphviz/lib/`. Key modules:

| Directory | Purpose |
|-----------|---------|
| `cgraph/` | Core graph data structure (nodes, edges, subgraphs, attributes) |
| `dotgen/` | `dot` layout engine — hierarchical, layered digraph layout |
| `neatogen/` | `neato` / `fdp` — spring-model layout |
| `circogen/` | `circo` — circular layout |
| `osage/` | `osage` — clustered layout |
| `sfdpgen/` | `sfdp` — force-directed for large graphs |
| `pathplan/` | Path planning (edge routing) |
| `common/` | Shared rendering utilities, label handling, color |
| `label/` | Label layout and text measurement |
| `gvc/` | Graphviz context — plugin registration, rendering pipeline |
| `cdt/` | Container data types (dictionary, tree, list) |
| `ast/` | String utilities |

Start porting from the bottom up: `cdt` → `ast` → `cgraph` → `common` →
layout engines → `gvc`.

## Quality Bar

- TypeScript strict mode (`"strict": true`) — no `any` except at explicit
  C-interop boundaries, documented with a comment.
- 90% line / branch / function coverage per `testing.md`.
- Every ported test from the C suite must pass before a module is considered
  complete.
- `tsc --noEmit` must pass with zero errors before any commit.
- The library must bundle with esbuild/vite for browser consumption with zero
  Node.js shims required.

## License

This project is licensed under the **Eclipse Public License v2.0** (EPL-2.0),
the same license as the upstream C graphviz. All source files must carry the
EPL-2.0 SPDX header:

```
// SPDX-License-Identifier: EPL-2.0
```

Do not add dependencies licensed under GPL-3.0-only or any license
incompatible with EPL-2.0.
