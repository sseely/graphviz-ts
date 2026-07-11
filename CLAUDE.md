# graphviz-ts — Claude Code Instructions

## Mission

A faithful TypeScript port of [Graphviz](https://gitlab.com/graphviz/graphviz).
The C source at `~/git/graphviz` is the **canonical specification**. The port is
consumed as a library and must run in a browser (no Node.js-only APIs).

Keep the `plans/` contents — they are the archaeology of this effort.

## The C Source Is Sacred

Decades of user-reported bugs and layout quirks are encoded in the C. Rules:

- **Do not optimize or simplify algorithms.** If the C looks redundant or odd,
  preserve it exactly — the oddity is almost certainly load-bearing.
- **Port every branch.** Special cases exist because someone hit them.
- **Keep function boundaries.** Split or merge only where TypeScript forces it
  (e.g., no pointer arithmetic).
- **Do not reorder logic.** Side-effect order is often intentional; note any
  deviation explicitly.
- **Port the tests too.** Every C test encodes a known correct behavior.

When in doubt, read the C. Still in doubt: keep the C behavior and document the
question. On any divergence, instrument the C and dump actual values before
hypothesizing — the default stance is "my port differs — find where."

## Verification

- Oracle = the **native build binary** `~/git/graphviz/build/cmd/dot/dot` with
  `GVBINDIR=/tmp/ghl` (never WASM, never homebrew dot — ABI mismatch).
- Conformance bar = xdot/SVG comparison at 0.01 tolerance (deterministic
  engines). Byte-exactness is not required; structural match is progress.
- Gates before any commit: `tsc --noEmit` clean, `npm test` green, golden
  cross-product monotonic, corpus sweep with **0 regressions**.
- Sweep discipline: never edit `src/` while a sweep runs (it reads live
  source). Resume-style sweeps skip once-passing ids and hide regressions —
  run a fresh (deleted-JSONL) sweep before committing routing changes.
- Journal every fix in `plans/decision-journal.md`.

## Translation Rules

| C concept                | TypeScript                                     |
| ------------------------ | ---------------------------------------------- |
| `int`/`long`, `double`   | `number` (mind precision > 2^53)               |
| `char *` string / buffer | `string` / `Uint8Array`                        |
| `struct`                 | `interface` (prefer) or `class`                |
| `void *`                 | `unknown` or a typed union                     |
| `FILE *`                 | abstract `Writer` interface                    |
| Pointer arithmetic       | array + index, or `DataView` for packed binary |
| `NULL`                   | `null` (prefer over `undefined` for pointers)  |
| `#define` / function ptr | `const` / typed function type                  |

Hazards proven in this port: C `calloc` zeroes fields — an optional TS field
left `undefined` inverts `!= 0` guards (coerce `?? 0`); C `int` assignment
truncates; `round()` is half-away-from-zero, not `Math.round`.

- **Browser-safe only**: no Node built-ins, no `process.env` in library code,
  ES modules only. If the C reads a file, take the data as a parameter.
- **Memory**: mirror the C's mutation contract; avoid GC pressure in hot loops
  (reuse objects / typed arrays).
- **Naming**: `snake_case` → `camelCase`, macros → `UPPER_SNAKE_CASE`; keep
  names recognizable (`agnode` → `agNode`). Every ported symbol carries
  `/** @see cgraph/graph.c:agopen */`.
- **YAGNI, strictly**: no new patterns, options, or "improved APIs" the C does
  not have. Idiomatic wrappers are a separate layer.

## C Source Map (`~/git/graphviz/lib/`)

`cgraph` core graph · `dotgen` dot · `neatogen` neato/fdp · `circogen` circo ·
`osage` osage · `sfdpgen` sfdp · `pathplan` edge routing · `common` shared
render/labels · `gvc` context/pipeline · `cdt` containers · `ast` strings

## Quality Bar

- TypeScript strict mode; no `any` except documented C-interop boundaries.
- 90% line/branch/function coverage per `testing.md`; ported C tests must pass.
- Bundles for the browser (esbuild/vite) with zero Node shims.
- A mission/batch with any quarantined or excluded case is not complete until
  its comparison page exists and is referenced in the decision journal.

## License

EPL-2.0 (same as upstream). Every source file carries
`// SPDX-License-Identifier: EPL-2.0`. No dependencies incompatible with
EPL-2.0 (e.g., GPL-3.0-only).
