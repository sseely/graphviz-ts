# T3 — Full-corpus regression sweep (the crux, AD-4)

Branch `fix/nonadjacent-flat-5ne8nw` after the T2 fit fix. The change is in the
SHARED box-channel spline fitter (`routeSplines`/`findMaxDev`), so this sweep is
the decisive gate. Judged by per-id verdict deltas (memory `bucket-fix-rebucketing`),
not bucket totals.

## Curated goldens — `npx vitest run`
**148 files / 1995 tests PASS. Zero out-of-family flips.** The two equivariance
tests (`src/common/splines-routespl.test.ts`) pass (flipped green by T2). No curated
golden references the old head-side knot (558); none needed updating.

## Corpus survey — `npx tsx test/corpus/survey.ts` (THE CRUX)
Counts (baseline `main` → after fix):
```
conformant        159 → 160   (+1)
structural-match  238 → 237   (-1)
diverged          356 → 356   ( 0)   <- ZERO new diverges
errored            20 →  20   ( 0)
timeout             8 →   8   ( 0)
oracle-error       15 →  15   ( 0)
total 796
```

Per-id verdict delta (only ids whose verdict OR maxDelta changed):
| id | baseline | after | direction |
|----|----------|-------|-----------|
| **241_0**  | structural-match / maxDelta 126 | **conformant** | BETTER (target) |
| 2413_1 | structural-match / maxDelta 68.25 | structural-match / maxDelta **48.05** | BETTER (smaller delta) |

**Exactly 2 ids changed; BOTH improved; ZERO regressed.** No conformant→worse, no
new diverged/structural verdict, no errored↔timeout flips. `2413_1` is another
box-channel edge that benefited from the now-equivariant fitter (verdict unchanged,
divergence strictly reduced) — confirms the fix generalizes correctly, not a
241_0 special-case.

## End-to-end — `241_0` conformant vs native dot
`render-one.ts ... 241_0.dot dot` vs native oracle: **all drawing content (paths,
polygons, text) is BYTE-IDENTICAL.** The `5:ne->8:nw` edge is now
```
M402.02,-41.9C413.34,-53.22 416.67,-57.24 432,-61.88 495.11,-80.98 533.98,-90.24 579.67,-49.74
```
knot at svg x=**432 (tail-side)**, exactly the oracle (was 558, head-side). The only
remaining file diff is the SVG generator-comment header + native's `<!-- node -->`
comment lines — pre-existing emit differences present on every corpus input
(normalized away by the survey's conformant verdict), NOT introduced here. The
0.35pt bbox-top residual from the diagnosis is also resolved (viewBox identical:
`0.00 0.00 782.00 86.00`).

## Oracle integrity (AD-5)
- `git -C ~/git/graphviz diff --stat lib/pathplan/route.c` → empty (clean).
- `/tmp/gvplugins` plugin not instrumented: a `CPROBE=1` render emits 0 markers.
- Oracle remains native ground truth.

## Verdict
AD-4 gate PASSED: `#241_0` structural-match → conformant, ZERO new diverges/
regressions corpus-wide, one additional edge improved. The shared-fitter change is
safe. `parity.json` updated to the new baseline.
