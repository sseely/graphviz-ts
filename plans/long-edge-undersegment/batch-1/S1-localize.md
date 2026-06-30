<!-- SPDX-License-Identifier: EPL-2.0 -->

# S1 — Localize the long-edge under-segmentation (spike)

## Context

Faithful port; `~/git/graphviz` is the spec. Mission `edge-spline-routing` made
the port's edge routing order conformant to C, but the port still emits one
fewer cubic than the oracle on `sleep--runmem` (p3): port 3 / oracle 4, maxDelta
0.48. The fitter `src/pathplan/route.ts` matches C `reallyroutespline` constants
exactly, so the cause is the **box corridor** (barriers / `Pshortestpath` input)
or the **smode segmentation** (`straight_len`/`straight_path`). This spike pins
which, with the order confound removed.

## Task

1. **Reproduce.** Render `~/git/graphviz/tests/graphs/p3.gv` through the oracle
   (`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg`) and the
   port (`npx tsx test/corpus/render-one.ts <p3> dot`). Confirm `sleep--runmem`
   = oracle 4 cubics / port 3.
2. **Instrument the port.** Dump, for `sleep--runmem`, the exact `Proutespline`
   arguments in `src/common/splines-routespl.ts` (`routeSplinesInternal`): the
   box corridor (boxes pre-x-reset + polygon), the `Pshortestpath` input polyline
   `pl`, the two endpoint slope vectors, and the output piece count. Also dump the
   smode decision in `src/layout/dot/edge-route-chain.ts` (`straightLen`,
   `smodeThreshold`, the per-segment `routeRegularByType` calls). Use guarded
   `globalThis` flags + a gitignored `.probes/` runner (per prior mission). Gate
   the per-edge dump on the chain edge's real tail/head names.
3. **Instrument C.** Add `fprintf(stderr, …)` gated on `getenv("PROBE_EDGE")` to
   C `routesplines_` (`lib/common/routespl.c`) dumping the same: boxes, polygon,
   `pl`, endpoint slopes, `spl.pn`. Also dump `make_regular_edge`'s smode loop
   (`lib/dotgen/dotsplines.c`: `straight_len`, the per-segment `routesplines`
   calls, `recover_slack`). Rebuild `lib/common` + `plugin/dot_layout` → copy
   `libgvplugin_dot_layout*.dylib` to `/tmp/gvplugins`. Render p3 with
   `PROBE_EDGE='sleep--runmem'`.
4. **Diff.** Compare port vs C for `sleep--runmem`, in order:
   - **smode segmentation**: does C split the chain into more segments than the
     port (so each `routesplines` call yields its own piece(s))? Compare
     `straight_len` and the segment boundaries.
   - **box corridor**: boxes (count + coords) + polygon + `pl` (count + coords).
   - **endpoint slopes** (`evs`) + `start/end.constrained/theta`.
   The FIRST field that differs is the root cause. (A 3-vs-4 piece count with
   maxDelta 0.48 strongly suggests either one fewer smode segment, or a corridor
   so close the fitter's `splinefits` accepts a 3-piece fit C rejects.)
5. **Classify the rankdir_dot rows (D5).** For `linux.x86-rankdir_dot`/`dot2` and
   `nshare-rankdir_dot`/`dot2`, dump the diverging `path[1]` edge's piece count
   vs oracle. Decide per row: is the residual the SAME under-segmentation class
   (piece count), or a SEPARATE divergence (e.g. the ~7.5pt label-height layout
   residual from memory `size-attr-scaling-done`)? Record in
   `comparisons/rankdir-classification.md`.
6. **Record.** Fill [decisions.md#d-fixsite](../decisions.md#d-fixsite) with the
   instrumented diff + the precise fix. Rewrite [T2-fix.md](../batch-2/T2-fix.md)
   with the concrete write-set, approach, acceptance. Append a journal entry.
   Remove all instrumentation (revert the C tree; delete `.probes/`).

## Write-set

- `plans/long-edge-undersegment/decisions.md` (#d-fixsite)
- `plans/long-edge-undersegment/batch-2/T2-fix.md` (rewrite from template)
- `plans/long-edge-undersegment/decision-journal.md`
- `plans/long-edge-undersegment/comparisons/rankdir-classification.md`
- `.probes/*` scratch (transient — delete before the gate)
- C instrumentation in `~/git/graphviz` is TEMPORARY — revert it
  (`git -C ~/git/graphviz checkout .`) after dumping.

## Read-set

- `plans/edge-spline-routing/comparisons/graphs-p3-residual.md` (the residual)
- `src/pathplan/route.ts` (`routeSpline`/`reallyRoute`/`splineFits` — confirm faithful)
- `src/common/splines-routespl.ts` (`routeSplinesInternal`, `limitBoxes`)
- `src/layout/dot/edge-route-chain.ts` (`routeChainSegmented`, `straightLen`,
  `smodeThreshold`, `recoverSlack`), `edge-route-faithful.ts` (`maximalBbox`,
  `rankBox`, `completeRegularPath`/`adjustRegularPath`)
- `~/git/graphviz/lib/common/routespl.c:294` (`routesplines_`),
  `lib/pathplan/route.c` (`Proutespline`/`reallyroutespline`/`splinefits`)
- `~/git/graphviz/lib/dotgen/dotsplines.c` (`make_regular_edge` smode loop,
  `straight_len`, `recover_slack`)

## Architecture decisions

D1 (spike first), D2 (pin to instrumented C), D3 (this class only), D5 (rankdir
classification). See [decisions.md](../decisions.md).

## Interface contracts

Produces for T2: the `#d-fixsite` decision = `{ site:
'smode-segmentation'|'box-corridor'|'endpoint-slopes'|'splinefits'|'other',
file: string, cDump: …, portDump: …, fix: prose }`, plus the D5 per-row
classification.

## Acceptance criteria

- Given p3, when both C and port dump `sleep--runmem`'s `Proutespline` inputs +
  smode decision, then the first differing field is identified with concrete
  values from each.
- Given that diff, when `#d-fixsite` is written, then it names the exact file +
  change and predicts which currently-matching edges (if any) the fix touches.
- Given the rankdir_dot rows are dumped, then each is classified same-class vs
  separate-class (D5) with its piece count vs oracle.
- Given the spike is complete, when `git diff --name-only main` runs, then NO
  production source is changed and the C tree is reverted clean.
- Given the diff implicates the fitter (`route.ts`), then STOP and re-scope (do
  not invent a fix).

## Observability

N/A — investigation spike; no runtime operations.

## Rollback

**Reversible** — no production change; instrumentation reverted.

## Quality bar

`git -C ~/git/graphviz status` clean after revert; `.probes/` removed; the filled
T2 spec is concrete enough to execute without further discovery. No commit of S1
beyond plan-doc updates (gitignored) — record the outcome in the journal. If a
tiny obvious fix emerges AND is ≤3 lines pinned to C, T2 may be folded in early
(log the decision).

## Boundaries

- **Never:** change production source in S1; leave C instrumentation in
  `~/git/graphviz`; guess the fix site without the instrumented diff.
- **Ask first:** if localization implicates the faithful `route.ts` fitter
  (premise violation) or an unrelated subsystem (D3/D5).
