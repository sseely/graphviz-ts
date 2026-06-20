# T1 — Pin the routeSplines mirror to one sub-step (+ RED equivariance test)

## Context
Faithful TS port of C graphviz (`~/git/graphviz` = spec). Start on
`fix/nonadjacent-flat-5ne8nw` (off `main`). The last `#241_0` residual is
`5:ne->8:nw`, a non-adjacent flat whose box channel matches C modulo a uniform
+27 internal x-translation, but whose spline is an EXACT MIRROR of C's (knot
head-side x≈531 vs C tail-side x≈405). The defect is a translation-equivariance
violation in `routeSplines` / a sub-step. READ `../findings-diagnosis.md` first —
it has the full C/port box + spline dumps; do not re-derive them. This task pins
the EXACT sub-step + line. No `src/` fix beyond the RED test.

## Task
1. **Build a pure repro (no graph layout).** Add a diagnostic harness (or a test)
   that constructs a `Path` with the 5-box channel from findings-diagnosis.md
   (port frame) and the SAME channel + endpoints translated by (+27,0), calls
   `routeSplines` on each, and compares. A correct fitter returns outputs that are
   +27 x-translates; today they MIRROR. Capture both control-point lists. This is
   the AD-1 isolated repro and becomes the **RED equivariance test**.
2. **Dump the intermediate polyline.** Inside `routeSplinesInternal`
   (`splines-routespl.ts:342`), capture `pl` (the `shortestPath` output) for the
   `5:ne->8:nw` channel and for its +27 translate. Determine: is `pl` ALREADY
   mirrored (⇒ bug in `buildPolyPoints`/`shortestPath`, the funnel), or does `pl`
   translate correctly but `routeSpline(edges, pl, evs)` produce a mirrored bezier
   (⇒ bug in `routeSpline`/`buildConstraintVectors`)? This bisects the mirror to
   the funnel vs the fit.
3. **Instrument C for the matching intermediate (AD-5, ephemeral).** Rebuild
   `gvplugin_dot_layout`→/tmp/gvplugins; in `routespl.c:routesplines_` dump the
   `Pshortestpath` polyline + `Proutespline` result for the 5→8 edge; run on
   `~/git/graphviz/tests/241_0.dot`; compare to the port's `pl`/`ps`. **Restore
   the C tree clean** (`git -C ~/git/graphviz checkout -- lib/...`) + rebuild a
   clean plugin + verify the oracle has no debug markers (AD-5).
4. **Name the mechanism + the minimal fix line.** State precisely: which sub-step
   introduces the mirror, the exact `src/` file:function:line, the absolute
   coordinate or orientation that breaks equivariance, and the minimal faithful
   change (match C's algorithm at that line). If the funnel (`shortestPath`) is at
   fault, name the pathplan divergence; if the fitter, name it. Confirm the
   candidate fix yields the tail-side knot on the pure repro (throwaway probe,
   then revert) — the AD-1 "run the actual config" step.

## Write-set
- `plans/nonadjacent-flat-5ne8nw/findings-mirror-mechanism.md` (Create) — the
  funnel-vs-fit bisection result, the C/port intermediate dumps, the named
  sub-step + exact line, and the observed knot under the candidate fix.
- `src/common/splines-routespl.test.ts` (Create or extend) — the RED
  translation-equivariance test (`it.fails(...)` tripwire until T2), asserting
  `routeSplines(channel+27) === routeSplines(channel)+27` and that the
  `5:ne->8:nw` channel knot lands tail-side (x≈405 internal, C value).

Do NOT commit any `src/` (non-test) change in this task. C instrumentation ephemeral.

## Read-set
- `decisions.md` (AD-1, AD-5); `../findings-diagnosis.md`
- `src/common/splines-routespl.ts` — `routeSplinesInternal`, `buildPolyPoints`,
  `buildConstraintVectors`, `limitBoxes`
- `src/pathplan/index.ts` — `shortestPath`, `routeSpline`, `makePolyline`
- `src/layout/dot/splines-flat.ts` — `routeFlatEdgeFaithful`, `topBoxes` (already
  confirmed faithful)
- `~/git/graphviz/lib/common/routespl.c:routesplines_` (294),
  `~/git/graphviz/lib/pathplan/` (shortestpath.c, routespl.c)

## Interface contract (consumed by T2)
```
{ subStep: "buildPolyPoints"|"shortestPath"|"routeSpline"|"buildConstraintVectors"|"limitBoxes"|other,
  plMirrored: boolean,              // true ⇒ funnel bug; false ⇒ fitter bug
  whyMirror: string,                // the absolute coord / orientation that breaks equivariance
  fixLine: string,                  // exact file:function:line to change
  knotUnderFix: number,             // observed internal knot x on the pure repro (must be ≈405)
  fixConfirmed: boolean }           // true ⇒ T2 can implement; false ⇒ STOP
```

## Acceptance criteria
- `findings-mirror-mechanism.md` names ONE sub-step with C+port intermediate dumps,
  the exact line, and the throwaway-test knot (≈405 tail-side) under the fix.
- `fixConfirmed` explicitly true/false; if false, STOP with the reason.
- The RED equivariance test exists and FAILS on current `main` code.
- `npx tsc --noEmit` exit 0; `git diff --name-only` shows only the findings file +
  the new test; C source restored clean (`git -C ~/git/graphviz status` clean).

## Boundaries
- **Never do:** commit a non-test `src/` edit; split the upstream C file (hook
  false positive); chase the +27 frame offset as a bug (it is benign, memory
  `flat-edge-241-is-y-only`).
- **Stop if:** you cannot pin ONE sub-step, or a build/hook blocks you twice.

## Commit
One commit: `docs(diag): pin routeSplines mirror sub-step + RED equivariance test`.
Return: the interface-contract JSON (esp. `subStep`, `plMirrored`, `fixLine`,
`knotUnderFix`, `fixConfirmed`), and C-restore confirmation.
