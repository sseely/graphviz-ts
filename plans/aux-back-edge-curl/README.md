# Mission: aux back-edge port-curl (close #241_0 — final half)

## Objective
Make the auxiliary graph's **back-edge clone** curl like C, so the reversed
`#241_0` flat edge `3:sw->2:se` reaches aux spline **size 7** (not 4) and the
flat-curl-y residual closes (`bb.ll.y` drops → the +7.88 whole-graph up-shift is
restored → cardinal `:e->:w` edges land correctly). **Zero regressions** on
other adjacent back edges.

This is the 6th-and-final `#241_0` mission, the **second half** of the
`group-adjacent-flats` fix. The first half (edge grouping) is **already done and
banked** on this branch.

## Prerequisite — start FROM this branch
Begin on `fix/group-adjacent-flats` (do NOT branch from main). The grouping fix
(`routeFaithfulSidePort` → `collectAdjacentFlatGroup`) already landed there and is
golden-neutral (vitest 1992 pass + 1 xfail; corpus survey 357→357 diverged, zero
new). **Do not revert or re-derive grouping** (AD-3). Branch
`fix/aux-back-edge-curl` off `fix/group-adjacent-flats`.

The existing **xfail tripwire** `src/layout/dot/splines-flat-group.test.ts`
(`it.fails('XFAIL: 3:sw->2:se back edge stays straight …')`) is the red test —
when this mission succeeds it flips to passing, and the `.fails` marker must be
removed. No new red test is needed.

## Root cause (PROVEN by the prior mission — do not re-derive)
In the aux graph, `auxt` (rank 0) and `auxh` (rank 1) are on **different ranks**
(the hvye weight-10000 edge forces the gap), so each cloned edge is a **regular
adjacent-rank** edge, not flat. The back-edge clone is `auxh(r1)->auxt(r0)` — a
regular adjacent-rank BACK edge. The port routes it via
`routeOneEdge` → `routeFaithfulAdjacentBack` (guard `tr === hr + 1`, which
matches) → `makeFwdEdge` → `routeRegularEdgeFaithful` → **straight (size 4)**,
ignoring the `sw/se` corner ports. C's `make_regular_edge` honors those ports and
**curls it (size 7)**.

Contrast: the forward corner-port edge (`2:ne->3:nw`, `auxt->auxh`) curls
correctly because it takes the **side-port path** (`routeForwardEdge` →
`hasSidePort` → `routeFaithfulSidePort` → `routeRegularEdgeFaithful`). Only the
back edge is intercepted by the **straight back-edge path first**
(`routeFaithfulAdjacentBack` runs before the side-port branch in `routeOneEdge`).

Grouping, clone order, and `otn` are **ruled out** by a fixed-`otn` clone-order
experiment (the back edge stays size 4 in every order, incl. C's exact
`[back, ne/nw, e/w]`). Full evidence:
`plans/group-adjacent-flats/findings-second-divergence.md`.

## Where the fix lives (to be confirmed in Batch 1, not assumed)
Port: `src/layout/dot/edge-route.ts` — `routeOneEdge` dispatch order and/or
`routeFaithfulAdjacentBack` / `routeRegularEdgeFaithful` (the back edge must
honor side ports). C: `lib/dotgen/dotsplines.c:make_regular_edge` (adjacent
back edge with ports). **This is CORE back-edge routing — it affects every
adjacent-rank back edge, not just the aux**, so the regression gate is the crux.

## Execution model
Run with **opus** (`claude-opus-4-8`, 1M). TDD: the xfail tripwire is the target.

## Oracle + harness
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- C instrumentation ephemeral: rebuild `gvplugin_dot_layout` → `/tmp/gvplugins`
  (NOT libgvc); restore clean + verify oracle native (AD-5).
- Reuse `test/diagnostic/flat-aux-dump.ts` for aux rank/size dumps.
- Per-input: `npx tsx test/corpus/render-one.ts <input> dot` vs cached oracle.
- Corpus survey: `npx tsx test/corpus/survey.ts` → `test/corpus/parity.json`
  (baseline on this branch: diverged 357; `#241_0` diverged maxDelta 126).

## Quality gates (after every task)
```
- command: npx tsc --noEmit            ; pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: 0 failures; the xfail tripwire flips to PASSING (then its `.fails` is
        removed); every other curated golden BYTE-IDENTICAL except the intended
        #241_0 family. Out-of-family golden flip ⇒ STOP (back-edge regression).
- command: npx tsx test/corpus/survey.ts          # THE CRUX (AD-4)
  pass: #241_0 verdict diverged→matches (or strictly smaller maxDelta) AND ZERO
        new diverges corpus-wide (compare per-id vs baseline; errored↔timeout
        flakiness on already-failing ids is not a regression).
  on_fail: STOP — back-edge routing is global; a new diverge means the fix is
        too broad. Narrow the gate (hasSidePort/aux-only) or re-scope.
- command: lizard <changed files> -C 10 -L 30 -a 5 ; pass: no violations
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose: instrument C `make_regular_edge` + port back-edge path on the SAME aux back edge; name the exact mechanism + port line; confirm the minimal gating condition | [ ] |
| 2 | T2 implement the gated fix (xfail flips green); T3 full-corpus regression sweep (zero new diverges) | [ ] |

- [decisions.md](decisions.md) — AD-1..AD-5
- [batch-1/T1-diagnose-curl.md](batch-1/T1-diagnose-curl.md)
- [batch-2/T2-implement.md](batch-2/T2-implement.md) · [batch-2/T3-regression.md](batch-2/T3-regression.md)
- [decision-journal.md](decision-journal.md)
- Prior: [../group-adjacent-flats/findings-second-divergence.md](../group-adjacent-flats/findings-second-divergence.md)

## Stop conditions
- The minimal fix flips ANY out-of-`#241_0`-family golden or adds ANY new corpus
  diverge, and it can't be bounded by a `hasSidePort`/aux-only gate ⇒ STOP and
  re-scope (the fix may belong only in the aux pipeline, not global back-edge
  routing).
- Batch 1 cannot pin a single mechanism (ports vs multi-edge-spread vs
  box-channel) ⇒ STOP; do not guess (the recurring failure of this saga).
- The same location/approach is changed 3× without resolving the same check.
- The fix requires changing `make_regular_edge`-equivalent core geometry in a way
  that touches forward edges too ⇒ STOP (blast radius too large for one mission).

## Push-forward with judgment
- The exact gating predicate (e.g. `routeFaithfulAdjacentBack` defers when
  `hasSidePort(e)`), confirmed minimal by Batch 1.
- Whether the curl comes from honoring ports vs multi-edge spread — Batch 1
  decides; the fix follows the evidence.

## Operational readiness
N/A — offline browser layout library. **Behavior change on core back-edge
routing** ⇒ the AD-4 full-corpus gate is the safety net. **Rollback: Reversible**
(revert the merge commit). No API/schema/contract impact (internal geometry).

## Context — read first
Lesson banked (memory `flat-edge-241-is-y-only`): "grouping alone suffices" was
an UNTESTED hypothesis that cost this mission a stop. **Never declare a fix
sufficient without running the actual fixed config against the oracle.** Batch 1
must prove the mechanism, not assume it.
