# Shared `graph_init` — consolidation of per-engine root-graph init

## Observation: the port now has a `graph_init` analogue; every engine calls it once

- **Context**: Three defects of one class in a row (`common_init_edge` → no
  `ED_label`; `gv_postprocess` → no xlabel placement; `do_graph_label` → no
  `GD_label`, 218 corpus ids). Root structural cause: C calls
  `graph_init(g, use_rankdir)` ONCE, engine-agnostically, from `gvLayoutJobs`
  (`lib/gvc/gvlayout.c:81`); the port re-derived those fields inside each
  engine, so any engine could silently miss any one of them.
- **Finding**: `src/common/graph-init.ts` now ports `lib/common/input.c:600
  graph_init` in C's field order. Every engine calls `graphInit(g, useRankdir)`
  exactly once at the top of its layout: dot via `dotGraphInit`
  (`useRankdir=true`), and neato / fdp / sfdp / circo / twopi / osage /
  patchwork with `useRankdir=false`. `neutralGraphRankdir` and the per-engine
  `doGraphLabel(root)` calls are deleted — they are subsumed.
  `LAYOUT_USES_RANKDIR` is set by `plugin/dot_layout/gvlayout_dot_layout.c:27`
  and no other layout plugin, so dot is the only `useRankdir=true` engine.
- **Impact**: The consolidation is behavior-neutral on the corpus (`-Kdot`
  byte-identical over 49 files; no engine regressed). Its value is structural:
  a field added to `graph_init` now reaches every engine by construction. Two
  fields where full faithfulness would have CHANGED behavior were deliberately
  left as-is (below) — both are documented in the source.
- **Confidence**: High. `tsc` clean, 3011/3011 tests (baseline identical),
  `-Kdot` byte-diffed base-vs-head across 49 corpus files.

## Observation: `CL_type` (`clusterrank`) was never set — `setClType` had zero callers

- **Context**: Auditing which `graph_init` fields the port already derived.
- **Finding**: `rank.ts` exports `clType` (init `LOCAL`) and `setClType`, but
  `setClType` was **never called** anywhere in `src/`, and the `clusterrank`
  attribute was not parsed at all. `clusterrank=global` / `=none` were silently
  ignored. `graphInit` now calls
  `setClType(maptoken(clusterrank, ...))` per `input.c:706-707`.
- **Impact**: No `.dot`/`.gv` file in the graphviz repo sets `clusterrank`, so
  corpus output is unchanged; the code path (`rank.ts:345/354/493`) is now
  reachable as C intends. This is the same "silently missing call-site" class as
  the three label defects — found by auditing `graph_init` field by field.
- **Confidence**: High. Grep-verified zero callers before; zero corpus files
  set the attr.

## Observation: module-scope snapshots of cycle-imported constants read as `undefined`

- **Context**: First run of the consolidated code failed 8 dot tests (cluster
  and flat-edge suites); `orderOf(g,'B')` returned `-1` — cluster member nodes
  never entered the ranks.
- **Finding**: `graph-init.ts` had `const RANK_CODES = [LOCAL, GLOBAL, NOCLUST,
  LOCAL]` at **module scope**. `common/graph-init.ts` is in an import cycle with
  `layout/dot/rank.ts`:
  `graph-init → nodeinit → shapes → compass-port → dot/init → graph-init`.
  When `graph-init`'s body evaluates while `rank.ts` is still partially
  initialised, the imported bindings read as `undefined` under Vite's SSR module
  transform (no TDZ throw). `RANK_CODES` froze as `[undefined, …]`, so
  `maptoken` returned `undefined`, `setClType(undefined)` left
  `clType !== LOCAL`, and dot stopped collapsing clusters
  (`rank.ts:345`, `:493`). Fix: build the code tables at CALL time
  (`rankCodes()` / `fontnameCodes()`), where every module is initialised.
- **Impact**: **Never snapshot a cycle-imported constant into module-level data
  in this codebase.** Plain re-exported literals are fine; arrays/objects that
  *capture* an imported binding's value at module-eval time are not. The failure
  is silent (`undefined`, not an exception) and surfaces far from its origin —
  here as missing cluster nodes.
- **Confidence**: High. Proven by probe (`clType` = `undefined` after
  `graphInit`, while a direct `import {LOCAL}` in the test read `100`), and by
  the cycle path dumped from a static import-graph walk.

## Observation: `GD_nodesep` leaks into neato's VPSC separation — a coupling C does not have

- **Context**: `graphInit` parses `nodesep` for EVERY engine (C does). Under
  neato, `maybeRemoveOverlap` (`neato/index.ts`) read `g.info.nodesep ?? 18`.
- **Finding**: Before consolidation, `GD_nodesep` was unset under neato at that
  point, so the site always used the 18pt default. C's overlap removal derives
  its padding from `sepFactor(g)` / `DFLT_MARGIN` (`neatogen/adjust.c:591-600`)
  and **never reads `GD_nodesep`** — in all of neatogen, `GD_nodesep` is used
  only by `makeSelfArcs` (`neatosplines.c:673`) and `routespl.c:1006`. Feeding
  the newly-parsed `nodesep` into that site would have changed the VPSC
  separation on graphs setting both `nodesep` and `overlap` (corpus: `1554.dot`,
  `2242.dot`) — a divergence C does not have. The site is pinned to
  `DEFAULT_NODESEP_POINTS`.
- **Impact**: Controlled experiment confirms the pin is load-bearing: un-pinning
  changes `1554`/`2242` output under the neato family; with the pin, base and
  head are byte-identical across all 4 engines. When a shared init starts
  populating a field that was previously unset, audit every `?? default` reader
  of that field — the default may have been load-bearing.
- **Confidence**: High. C grep + before/after/un-pinned render comparison.

## Observation: `GD_drawing` is still allocated lazily, on purpose

- **Context**: C allocates `GD_drawing(g)` unconditionally (`input.c:609`) and
  stores `ratio_kind` for every ratio mode.
- **Finding**: The port allocates `g.info.drawing` ONLY for
  `ratio=compress|fill` (`parseRatioDrawing`). `drawing === undefined` is a
  load-bearing guard at `dot/position-bbox.ts:142` (`setAspect`) and
  `neato/set-aspect.ts:57`. Allocating it unconditionally would activate the
  unported/unvalidated `expand` / `value` / `auto` reshapes and change dot
  output, so the existing scope is preserved verbatim. Consequently `quantum`,
  `dpi`, `page`, `centered`, `landscape`, `id` are NOT stored in `graph_init`;
  each is derived at its use-site from the same attribute with the same C
  semantics (`nodeinit.ts:129`, `gvc/device.ts:545`, `gvc/viewport.ts:163-169`,
  `render/svg-graph.ts:324`).
- **Impact**: Unblocking `ratio=expand|value|auto` is a separate, corpus-gated
  task: allocate `drawing` unconditionally in `graphInit` and expect dot output
  to move on those graphs.
- **Confidence**: High. Guard sites read directly; dot byte-identity verified.
