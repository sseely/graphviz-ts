# Mission: non-adjacent flat spline mirror (5:ne->8:nw — close #241_0 to conformant)

## Objective
Make the port's `routeSplines` produce the SAME spline as C `routesplines` for
the `#241_0` non-adjacent flat edge `5:ne->8:nw`, so its two-bezier knot lands on
the **tail side** (internal x≈405, like C) instead of the **head side** (x≈531),
closing the last `#241_0` residual: `5:ne->8:nw` conforms to native `dot` and
`#241_0` moves **structural-match → conformant** (maxDelta 126 → 0). **Zero
regressions** on every other box-channel-routed edge (the whole library).

This is the follow-up named at the close of the `aux-back-edge-curl` mission. The
curl + arrowhead halves of `#241_0` are already on `main` (merge 3106329); this
mission closes the one remaining unrelated edge.

## Root cause (PROVEN in the pre-mission diagnosis — do not re-derive)
The box channel the port builds for `5:ne->8:nw` is **identical to C's modulo a
uniform +27 internal x-translation** (benign frame offset; cancels at emit). The
endpoints are likewise +27. Yet the port's spline is an **EXACT MIRROR** of C's
(same endpoints, control-point sequence reversed, knot tail-side in C vs head-side
in the port). Since a shortest-path-funnel + bezier fit is translation-invariant,
a faithful port must be **translation-EQUIVARIANT**; the port is not. So the bug
is inside `routeSplines` / a sub-step (`buildPolyPoints`, `shortestPath`,
`routeSpline`, `buildConstraintVectors`, or `limitBoxes`) — most likely an
**absolute-coordinate dependence** that breaks equivariance. Full evidence +
C/port dumps: [findings-diagnosis.md](findings-diagnosis.md).

## Why this is unit-testable (the de-risk)
Because the defect is a translation-equivariance violation in `routeSplines`, it
reproduces on a **pure box channel** with NO graph layout: feed `routeSplines` the
5-box channel from findings-diagnosis.md and the same channel translated +27 in x;
a correct fitter returns outputs that are +27 translates, the buggy one returns a
mirror. Batch 1 builds this isolated repro; Batch 2 develops the fix against it,
then gates on the full corpus.

## Where the fix lives (confirm in Batch 1, do not assume)
Port: `src/common/splines-routespl.ts:routeSplinesInternal` and/or
`src/pathplan/` (`shortestPath`, `routeSpline`). C:
`lib/common/routespl.c:routesplines_` (`Pshortestpath` → `Proutespline`),
`lib/pathplan/`. **This is the SHARED box-channel spline fitter — it routes every
multi-rank regular edge and every non-adjacent flat in the library**, so the
regression gate is the crux (higher blast radius than the previous mission's
back-edge change).

## Execution model
Run with **opus** (`claude-opus-4-8`, 1M). TDD: a new translation-equivariance
red test (Batch 1) is the target; it goes green when the fix lands.

## Oracle + harness
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- C instrumentation ephemeral: rebuild `gvplugin_dot_layout` → `/tmp/gvplugins`
  (NOT libgvc); restore clean + verify oracle native (AD-5). The complexity hook
  flags `dotsplines.c`/`routespl.c` as >500 lines — that's a FALSE POSITIVE on the
  upstream spec file; ignore it (never split C source).
- Per-input: `npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/241_0.dot dot`
  vs native; the only diff today is the `5:ne->8:nw` path + a 0.35pt bbox-top.
- Corpus survey: `npx tsx test/corpus/survey.ts` → `test/corpus/parity.json`
  (current `main` baseline: diverged 356; `#241_0` structural-match maxDelta 126).

## Quality gates (after every task)
```
- command: npx tsc --noEmit            ; pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: 0 failures; the new equivariance test passes; every other curated golden
        BYTE-IDENTICAL. Any out-of-family golden flip ⇒ STOP (fitter regression).
- command: npx tsx test/corpus/survey.ts          # THE CRUX (AD-4)
  pass: #241_0 structural-match→conformant (or strictly smaller maxDelta) AND ZERO
        new diverged/structural verdicts corpus-wide (per-id vs baseline;
        errored↔timeout flakiness on already-failing ids excluded).
  on_fail: STOP — routeSplines is global; any new diverge means too broad.
- command: lizard <changed files> -C 10 -L 30 -a 5 ; pass: no violations
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose: build the translation-equivariance repro (pure `routeSplines`), dump the intermediate polyline `pl` vs C `Pshortestpath`, pin the exact sub-step + line where the mirror enters (funnel vs fit vs constraint-vectors vs absolute-bound), and the minimal fix. RED equivariance test added. | [x] PINNED: `routeSpline`/`findMaxDev` tie-break (fit, not funnel); fix=tolerant tie-break, confirmed on repro |
| 2 | T2 implement the pinned fix (equivariance test + `5:ne->8:nw` go green); T3 full-corpus regression sweep (zero new diverges — the crux) | [x] DONE: #241_0 conformant; 1995/1995 goldens; 0 new diverges; 2413_1 also improved |

- [decisions.md](decisions.md) — AD-1..AD-5
- [batch-1/T1-diagnose.md](batch-1/T1-diagnose.md)
- [batch-2/T2-implement.md](batch-2/T2-implement.md) · [batch-2/T3-regression.md](batch-2/T3-regression.md)
- [decision-journal.md](decision-journal.md)
- [findings-diagnosis.md](findings-diagnosis.md) — the proven pre-mission evidence
- [findings-mirror-mechanism.md](findings-mirror-mechanism.md) — T1 sub-step pin
- [findings-regression.md](findings-regression.md) — T3 corpus sweep result

## Mission summary — COMPLETE (2026-06-20)
**`#241_0` FULLY CLOSED: structural-match → conformant.** All tasks done; merged to
`main` via merge commit (per-task IDs preserved).

- **Root cause (T1):** the mirror was in the FIT (`routeSpline`), not the funnel
  (`shortestPath`, proven equivariant). Exact line: `route.ts:findMaxDev` max-
  deviation tie-break. The symmetric channel makes the two split deviations an exact
  geometric tie; C computes them bit-identically and its strict `>` keeps the first
  (tail), but the port's absolute-coordinate bezier eval carries ~1e-14 cancellation
  noise whose sign depends on absolute x → the tie flipped to the head at the edge's
  own frame (`+27` from C). NOT the `+27` offset itself (benign elsewhere); NOT
  `mkspline` (C shares the same asymmetric cp).
- **Fix (T2):** one comparison line — `if (d > maxd)` → `if (d > maxd*(1+1e-10)+1e-10)`
  — absorbing sub-ULP noise so a true tie keeps the first index, matching C's
  exact-arithmetic intent. No special-case (AD-2). Equivariance unit test green.
- **Regression (T3, the crux):** 1995/1995 curated goldens pass, zero out-of-family
  flips; corpus survey: exactly 2 ids changed, both improved, zero regressed
  (`241_0` → conformant; `2413_1` maxDelta 68.25→48.05). `241_0` SVG drawing content
  conformant to native dot; knot now svg x=432 (tail). Oracle restored native.
- **Quality gates:** `tsc` clean · `vitest` 1995 pass · `lizard` clean · survey
  zero new diverges.
- **Decisions:** 3 logged (T1/T2/T3), none flagged for review.
- **Follow-up (not this mission):** latent `routeFlatEdgeFaithful` step-size bug
  (`stepx=nodesep/2` vs C `Multisep/(cnt+1)`) for cnt≥2 non-adjacent multi-flats —
  untouched by this fix (5:ne->8:nw is cnt=1); a separate mission if a cnt≥2 case
  surfaces in the corpus.

## Stop conditions
- Batch 1 cannot pin the mirror to a SINGLE sub-step (funnel vs fit vs constraint
  vs absolute-bound) ⇒ STOP; do not guess (the saga's recurring failure).
- The fix flips ANY out-of-`#241_0`-family curated golden or adds ANY new corpus
  diverge and it can't be bounded ⇒ STOP and re-scope (the fitter is global; a
  broad regression means the change is wrong, not the goldens).
- The same location/approach is changed 3× without resolving the same check.
- The fix requires rewriting the pathplan funnel/fit geometry in a way that churns
  many regular-edge goldens ⇒ STOP (blast radius too large for one mission;
  re-scope to a narrowly-gated change or escalate).

## Push-forward with judgment
- The exact sub-step and absolute-coordinate that breaks equivariance, once Batch 1
  pins it with the `pl`-vs-C dump.
- Whether the fix is in the funnel (`shortestPath`/`buildPolyPoints`) or the fitter
  (`routeSpline`/constraint vectors) — Batch 1 decides; the fix follows the
  evidence, not this brief's framing.
- Applying the `Multisep/(cnt+1)` step-size correction in `routeFlatEdgeFaithful`
  IF (and only if) the fix touches that line (latent cnt≥2 bug, findings §latent).

## Operational readiness
N/A — offline browser layout library. **Behavior change on the SHARED box-channel
spline fitter** ⇒ the AD-4 full-corpus gate is the safety net (highest blast
radius of the saga). **Rollback: Reversible** (revert the merge commit). No
API/schema/contract impact (internal geometry).

## Context — read first
Lesson banked across the `#241_0` saga (memory `flat-edge-241-is-y-only`,
`instrument-c-before-quarantine`): never declare a fix sufficient without running
the actual fixed config against the native oracle; instrument C to get ground
truth before hypothesizing. The pre-mission diagnosis already did the C
instrumentation — Batch 1 extends it to pin the sub-step, it does not restart it.
The `+27` internal x-frame offset is BENIGN (cancels at emit); do NOT chase it as
a bug (it mis-led two earlier missions — see memory).
