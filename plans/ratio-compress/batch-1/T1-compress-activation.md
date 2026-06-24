<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — populate drawing; activate ratio=compress

## Context

Faithful TS port of C Graphviz (`~/git/graphviz` is the spec). Browser-safe ESM:
no `fs`/`path`/`process`; import paths end in `.js`. Strict TS, no `any`. EPL
header on every file. Ported symbols carry a JSDoc `@see` to their C origin.
Tests are vitest, colocated, asserting concrete values. Complexity hook: file
≤500 lines, CCN ≤10, ≤5 params (lizard counts `??` as +2 CCN).

`ratio=compress` is currently a **silent no-op**: `g.info.drawing` is never
populated, so `compressGraph` (`src/layout/dot/position-cluster.ts`) early-returns.
The compress machinery (`compressGraph`, `containNodes`, `makeLrvn`, `GD_ln`/
`GD_rn`) is already ported and correct — verified by probe (NaN width 307→396,
native 397). This task only wires `drawing`.

## Task

1. Add `parseRatioKind(g): RatioKind | undefined` mirroring C `setRatio`
   (`input.c:576`): `auto→'auto'`, `compress→'compress'`, `expand→'expand'`,
   `fill→'fill'`, else `atof(p)>0 → 'value'` (store the numeric ratio). Absent →
   `undefined`.
2. In `dotGraphInit` (`src/layout/dot/init.ts`), **after `parseSepAttrs(g)`**
   (matching C order — setRatio + size follow nodesep/ranksep in `input.c`):
   - compute `kind = parseRatioKind(g)`.
   - **Compress-only scope (ADR-1):** populate `g.info.drawing` **only when
     `kind === 'compress'`**. Use `parseDrawingSize(g.attrs.get('size'))`
     (viewport.ts — already the `getdoubles2ptf` port, returns `{x,y,filled}` in
     points) for the size. Set
     `g.info.drawing = { ratioKind: 'compress', size: {x,y}, filled }`.
   - For all other kinds, **leave `g.info.drawing` unset** (Batch 2 territory).
3. @see `lib/common/input.c:576` (setRatio), `:694` (size/filled),
   `lib/dotgen/position.c:501` (compress_graph).

Do not touch `compressGraph`, `containNodes`, or `setAspect`. If the `drawing`
object shape (`LayoutParams` in `src/model/layoutParams.ts`) lacks a field you
need (e.g. `filled`), add it minimally — but check first; it likely already
matches `GD_drawing`.

## Write-set
- `src/layout/dot/init.ts` — `parseRatioKind` + `drawing` population in `dotGraphInit`
- `src/layout/dot/dot.test.ts` — tests (append, mirroring the AC2b ranksep tests)
- `src/model/layoutParams.ts` — only if a `drawing`/`LayoutParams` field is missing

## Read-set
- `decisions.md` (ADR-1/-2/-3)
- `src/layout/dot/init.ts:88-111` (`dotGraphInit`, `parseSepAttrs` pattern)
- `src/gvc/viewport.ts:parseDrawingSize` (size→points+filled)
- `src/layout/dot/position-cluster.ts:compressGraph`, `containNodes` (the consumers)
- `src/model/layoutParams.ts` (`LayoutParams`, `RatioKind`)
- `~/git/graphviz/lib/common/input.c:576,693-694`

## Interface contract (consumed)
`g.info.drawing = { ratioKind: 'compress', size: {x,y} /* points */, filled }`
set during layout init for `ratio=compress` graphs; `undefined` otherwise.

## Acceptance (Given/When/Then)
- Given `ratio=compress` + `size="16,10"`, after `dotGraphInit`, then
  `g.info.drawing.ratioKind === 'compress'` and `size === {x:1152, y:720}`.
- Given `ratio=fill` / `auto` / no ratio, then `g.info.drawing` is `undefined`.
- Given `graphs/NaN.gv` rendered to SVG, then the graph `<g>` scale moves from
  ~0.443 to ~0.57 (native 0.573819) and width from 307pt toward 397pt.
- Given any non-compress `ratio=` graph (b68, b22, polypoly, jsort, pgram,
  trapeziumlr), then output bytes are identical to before this task.

## Quality bar
`npm run typecheck` + `npm test` green; lizard clean on changed files; survey
gate (Batch 1 overview). Commit:
`feat(dot): activate ratio=compress via graph drawing params`
(body: root cause = unpopulated drawing; compress-only scope per ADR-1; NaN
canary; fill/expand/value/auto deferred to the ratio-aspect mission).
