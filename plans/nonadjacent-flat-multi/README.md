# Mission: non-adjacent flat multi-edge router (cnt≥2 — faithful to C make_flat_edge)

## Objective
Make the port's non-adjacent flat-edge router faithful to C `make_flat_edge` for
**cnt≥2** (multiple non-adjacent, non-labeled, identical-port flat edges between the
same same-rank node pair). C groups them into ONE call and routes them as a nested
loop (`step = …/(cnt+1)`, edge `i` offset by `(i+1)·step`); the port routes each
independently at `nodesep/2`, so cnt≥2 edges come out **identical/overlapping**
instead of nested. This is a real, oracle-confirmed faithfulness gap with **zero
corpus triggers** (all 74 corpus non-adjacent flats are cnt=1) — validated only via
synthetic inputs. The regression bar is: **all cnt=1 behavior stays BYTE-IDENTICAL.**

This is the latent follow-up banked at the close of `nonadjacent-flat-5ne8nw`
(memory `flat-edge-241-is-y-only`). The diagnosis is DONE (see
[findings-diagnosis.md](findings-diagnosis.md)) — do not re-derive it.

## Root cause (PROVEN — do not re-derive)
C `lib/dotgen/dotsplines.c:make_flat_edge` (top branch, 1502) and
`make_flat_bottom_edges` (bottom branch, 1418) share a cnt-loop:
`stepx = Multisep/(cnt+1)`, `stepy = vspace/(cnt+1)` (`Multisep = GD_nodesep`); ONE
shared `makeFlatEnd` tail+head; then `for i in 0..cnt-1` build 3 connecting boxes
with the two END boxes offset `(i+1)·stepx` / `(i+1)·stepy` and the MIDDLE box height
plain `stepy`; route; `clip_and_install(edges[i])`. The port
(`edge-route.ts:routeFaithfulSidePort`) instead routes each non-adjacent flat
independently via `routeFlatEdgeFaithful(g,e)` with `stepx=nodesep/2`, `stepy=vspace/2`,
no cnt-nesting. For cnt=1 these are algebraically identical (`Multisep/2 = nodesep/2`,
`(0+1)·step = step`); they diverge only for cnt≥2.

## Where the fix lives
- `src/layout/dot/splines-flat.ts` — `routeFlatEdgeFaithful`, `topBoxes`,
  `bottomBoxes`, `makeFlatEndBox`, `flatSide`, `flatVspace`, `freshFlatPath`,
  `assembleFlatPath`.
- `src/layout/dot/splines-flat-multi.ts` (NEW) — group collection + cnt-loop router.
- `src/layout/dot/edge-route.ts` — `routeFaithfulSidePort` dispatch,
  `collectAdjacentFlatGroup` (the grouping template to mirror).
- C spec: `dotsplines.c:make_flat_edge` (1502), `make_flat_bottom_edges` (1418),
  `dot_splines_` group-collection loop (343-411).

## Execution model
Run with **opus** (`claude-opus-4-8`, 1M). TDD: synthetic cnt=2/cnt=3 (top) + cnt=2
(bottom) byte-match-vs-native-`dot` is the target; cnt=1 byte-identical is the gate.

## Oracle + harness
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- Synthetic repro (top cnt=2): `digraph { nodesep=0.25; {rank=same; a;b;c}
  a->b->c[style=invis]; a:ne->c:nw; a:ne->c:nw; }`. cnt=3 adds a third `a:ne->c:nw`;
  bottom uses `a:se->c:sw` ×2. **Re-capture oracle SVGs during execution** (the
  /tmp/oracle-*.svg from diagnosis are throwaway and will NOT persist):
  `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg <case>.dot`.
- Per-input: `npx tsx test/corpus/render-one.ts <case>.dot dot` vs native.
- Corpus survey: `npx tsx test/corpus/survey.ts` → `test/corpus/parity.json`.
- C instrumentation (only if a box-channel mismatch needs pinning): rebuild
  `gvplugin_dot_layout`, copy `build/plugin/dot_layout/libgvplugin_dot_layout.8.dylib`
  → `/tmp/gvplugins`; restore clean after (AD-5). The complexity hook flags
  `dotsplines.c` >500 lines — FALSE POSITIVE on the upstream spec; never split C.

## Quality gates (after every task)
```
- command: npx tsc --noEmit            ; pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: 0 failures; every curated golden BYTE-IDENTICAL (cnt=1 unchanged); the new
        synthetic cnt≥2 tests pass. Any out-of-family golden flip ⇒ STOP.
- command: npx tsx test/corpus/survey.ts            (T4 — the gate)
  pass: ZERO new diverged/structural verdicts vs main baseline (per-id); all 74
        cnt=1 non-adjacent flats unchanged. on_fail: STOP (shared router).
- command: lizard <changed files> -C 10 -L 30 -a 5  ; pass: no violations
- command: wc -l <changed .ts files>                ; pass: all <500 lines
```

## Batches
| Batch | Task | Status |
|-------|------|--------|
| 1 | T1 generalize `topBoxes`/`bottomBoxes` (separate end/mid steps) + export helpers; cnt=1 byte-identical | [ ] |
| 2 | T2 create `splines-flat-multi.ts` (group collect + cnt-loop router, top+bottom) + unit tests byte-match oracle | [ ] |
| 3 | T3 wire `routeFaithfulSidePort` dispatch to collect+route the group; end-to-end synthetic byte-match | [ ] |
| 4 | T4 full-corpus regression sweep (zero new diverges, 74 cnt=1 unchanged) + oracle restore + close | [ ] |

- [decisions.md](decisions.md) — AD-1..AD-5
- [findings-diagnosis.md](findings-diagnosis.md) — the proven pre-mission evidence
- [batch-1/T1-box-helpers.md](batch-1/T1-box-helpers.md)
- [batch-2/T2-group-router.md](batch-2/T2-group-router.md)
- [batch-3/T3-dispatch.md](batch-3/T3-dispatch.md)
- [batch-4/T4-regression.md](batch-4/T4-regression.md)
- [diagrams/box-channel.md](diagrams/box-channel.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
- ANY of the 74 cnt=1 non-adjacent flats changes, or any out-of-family curated
  golden flips ⇒ STOP (cnt=1 must be byte-identical; the cnt-loop with cnt=1 i=0 is
  algebraically the current code — a flip means the refactor changed behavior).
- Any genuine new corpus `diverged`/`structural` verdict ⇒ STOP (shared router).
- Synthetic cnt≥2 doesn't byte-match native `dot` after the fix and can't be pinned
  by instrumenting C ⇒ STOP; do not guess the box arithmetic.
- A touched `.ts` file can't stay <500 lines, or functions can't stay ≤30 lines /
  CCN ≤10 / ≤5 params ⇒ STOP and re-scope the split.
- The same location/approach is changed 3× without resolving the same check.

## Push-forward with judgment
- The exact `(i+1)` box-offset arithmetic and group ordering — follow C +
  the oracle, not this brief's paraphrase.
- Minor helper extraction / file organization to satisfy the line cap.
- Whether the group-collection key needs port-equality (`portcmp`) beyond
  same-pair — follow C `dot_splines_` (370-373) and the oracle.

## Operational readiness
N/A — offline browser layout library. **Behavior change confined to the
non-adjacent flat path of the SHARED box-channel router; cnt=1 is byte-identical by
construction, and the T4 corpus gate is the safety net.** **Rollback: Reversible**
(revert the merge commit). No API/schema/contract impact (internal geometry).

## Context — read first
Lessons banked across the `#241_0` saga (memory `flat-edge-241-is-y-only`,
`instrument-c-before-quarantine`, `corpus-scan-for-rare-triggers`): instrument C for
ground truth before hypothesizing; never declare a fix sufficient without running the
actual config against the native oracle; this gap has NO corpus trigger, so synthetic
byte-match IS the validation and cnt=1-unchanged IS the regression bar.
