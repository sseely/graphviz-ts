# T2 — Core doDot + per-component pack + 2458 (TDD)

## Context

graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec). T1 pinned
the wiring. Port C's `doDot` pack branch (`dotinit.c:doDot` ≈437-500), **cluster-free
path**, so corpus 2458 (`pack=1`, two components, no clusters) decomposes into
connected components, lays out each via `dotLayoutPipeline`, and `packSubgraphs`-packs
them — matching headless dot 15.1.0. The pack ops run in points on `n.info.coord`,
so no `attachPos`/`resetCoord` is needed.

**Read T1's findings first:** `comparisons/T1-investigation.md` — its interface block
gives `initSubgNeeded`, `packCall {mode,margin,doSplines}`, `rootRerank`,
`ratioGuardField`.

## Task

Add a `doDot(g)` wrapper mirroring C and route `dotLayoutEntry` through it:
- No pack (`getPackModeInfo==l_undef && getPack<0`) → `dotLayoutPipeline(g)` (unchanged).
- Pack set + `ncc==1` → `dotLayoutPipeline(g)`.
- Pack set + `ncc>1` + ratio is `R_NONE` → for each `ccomps` component: `initSubg`
  (per T1) then `dotLayoutPipeline(sg)`; then `packSubgraphs(ncc, comps, g, pinfo)`
  (`pinfo.doSplines=true`, `mode`/`margin` per T1). The root is NOT re-ranked.
- Pack set + ratio ≠ R_NONE → `dotLayoutPipeline(g)` (C fallback).

Put the wrapper (thin) in `index.ts`; the component loop + `initSubg` in new
`src/layout/dot/pack-components.ts` (ADR-1, keeps caps). TDD: add the golden + unit
test that fails first (Red), then the minimal faithful change (Green). Preserve C's
branch structure/order (CLAUDE.md); cite `@see lib/dotgen/dotinit.c:doDot`.

## Read-set

- `comparisons/T1-investigation.md` (interface block)
- `src/layout/dot/index.ts:108-172`
- `src/layout/pack/index.ts:152` (packSubgraphs), `:394-419` (getPack*/getPackInfo),
  `:293` (ccomps)
- `src/layout/twopi/pipeline.ts:layoutMulti` (template)
- C: `~/git/graphviz/lib/dotgen/dotinit.c:344-356` (initSubg), `:437-500` (doDot)
- `test/golden/refs/concentrate-2559.svg` + `src/layout/dot/concentrate-trunk.test.ts`
  (golden + unit-test idiom from the prior mission)

## Write-set

- `src/layout/dot/index.ts` (doDot wrapper + dotLayoutEntry routing)
- `src/layout/dot/pack-components.ts` (create — component loop + initSubg)
- `src/layout/dot/pack-components.test.ts` (create)
- `test/golden/inputs/pack-2458.dot` (create — copy `~/git/graphviz/tests/2458.dot`)
- `test/golden/refs/pack-2458.svg` (create — headless 15.1.0:
  `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg test/golden/inputs/pack-2458.dot`)

## Architecture decisions (locked)

ADR-1 (split files), ADR-2 (initSubg per T1), ADR-4 (ratio guard + doSplines, no
root re-rank), ADR-5 (15.1.0 oracle, structural-match bar). Do NOT touch
`src/layout/pack/**` or `src/layout/twopi/**` (ADR-3).

## Interface contract

**In (from T1):** `{ initSubgNeeded, packCall, rootRerank:false, ratioGuardField }`.
**Out (→T3/T4):** `{ doDotFn, packComponentsModule, goldenInput, goldenRef,
testFile, commitSha }`.

## Acceptance criteria

- Given `pack` unset, when `dotLayoutEntry` runs, then `dotLayoutPipeline(g)` is
  called unchanged (assert a non-pack graph's output is byte-identical to pre-change).
- Given 2458 (pack=1, 2 comps, no clusters), when laid out, then the SVG structurally
  matches headless 15.1.0 (132×116; q16 packed bottom-right cy≈-32; q1/q2 left column).
- Given a multi-component graph with `ratio` set, when laid out, then it falls back
  to whole-graph `dotLayoutPipeline` (no packing).
- Given the change, when `npx tsc --noEmit --stableTypeOrdering` + `npx vitest run`,
  then both exit 0 with the new 2458 unit test green and no other test regressed.
- Given the diff, when `git diff --name-only`, then it lists only the declared
  write-set.

## Boundaries

- **Never:** modify `src/layout/pack/**`/`src/layout/twopi/**`; special-case 2458;
  re-rank the root in the pack branch; widen the write-set beyond index.ts +
  pack-components.ts (+ tests/goldens).
- **Ask first / STOP:** if a 3rd `src/` file (beyond index.ts + pack-components.ts)
  is required.
- **Always:** keep file ≤500 lines, fn CCN ≤10, params ≤5 (`??` counts); cite the C
  line in a `@see` comment for each ported branch.

## Observability / Rollback

N/A — layout-internal. Reversible (revert restores prior dotLayoutEntry).

## Commit

`fix(T2): port dot doDot pack branch (multi-component) for 2458`

Body (>3 files): explain the C `doDot` pack branch ported, why pack ops use points
(no attachPos/resetCoord), and that cluster copy-back is deferred to T3.
