# Mission: group adjacent flat edges before aux routing (fix #241_0 curl)

## Objective
Make the port route **all** adjacent flat (same-rank) port-bearing edges between
a node pair through **one** `makeFlatAdjEdges` call (`cnt=N`), ordered so the
reversed back edge clones as a back edge in the shared aux graph and curls —
matching C. This closes the `#241_0` flat-curl-y residual (reversed `3:sw->2:se`
aux spline size 4→7 ⇒ `bb.ll.y` drops ⇒ the +7.88 whole-graph up-shift is
restored ⇒ every cardinal `:e->:w` edge lands correctly). **Zero regressions**
on every other adjacent-flat golden.

This is the **fix** mission named by the 5th `#241_0` diagnosis
(`plans/flat-aux-curl-diagnosis/`, merged `7490f43`). The divergence is **edge
grouping**, not `rank=source` and not a virtual node (memory
`flat-edge-241-is-y-only`).

## Root cause (proven, from the diagnosis — do not re-derive)
- **C** `dot_splines_` groups all adjacent flat edges between a pair into ONE
  `make_flat_adj_edges` call via the `if (ED_adjacent(e0)) continue;` loop
  (`lib/dotgen/dotsplines.c:356-360`). On `#241_0` that is `cnt=3` for the 2↔3
  pair. With the forward edge as `e0` (`edges[0]`), `auxt=clone(node2,rank0)`,
  `auxh=clone(node3,rank1)`; the reversed `3:sw->2:se` clones `auxh(3)→auxt(2)`
  = a BACK edge (rank1→0) → `dot_splines_` curls it → **aux size 7**.
- **Port** routes each adjacent flat in its OWN isolated `cnt=1` aux graph
  (`src/layout/dot/edge-route.ts:297` → `makeFlatAdjEdges(g, [e], 1, …)`), so
  `3->2` clones `auxt(3)→auxh(2)` = FORWARD (rank0→1) → straight → **aux size 4**.

## The fix is caller-side (already-built infrastructure)
`makeFlatAdjEdges` / `buildFlatAux` / `copyFlatSplines`
(`src/layout/dot/splines-flat.ts`) **already** handle `cnt=N`: `copyFlatSplines`
iterates every member of `edges[]` and installs its spline via `aux.alg`. The
ONLY gap is the per-edge dispatch. So this mission does **not** rewrite the aux
internals — it inserts a grouping step in the dispatch.

## The load-bearing detail: GROUP ORDERING (AD-1)
`buildFlatAux`/`copyFlatSplines` key the aux frame off `edges[0].tail`
(`otn = edges[0].tail`). For the back edge to curl, `edges[0]` must be the
**forward** edge (so `auxt=clone(node2)`). In C this falls out of `edgecmp`:
after the equal-rank/equal-x tiebreaks it sorts by `AGSEQ(getmainedge)` (edge
creation order); the forward `2->3` edges have lower AGSEQ than `3->2`, so
`edges[0]` is the forward edge. **The diagnosis dump showed an internal
inconsistency here** (`make_flat_adj_edges: tail=2 head=3` vs `edge[0]: 3->2`),
so the exact membership + order MUST be pinned by C instrumentation **before**
the port change (T1), not guessed.

## Branch / merge
- Branch `fix/group-adjacent-flats` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model
Run with **opus** (`claude-opus-4-8`, native 1M). Fable 5 disabled (memory
`fable-disabled-use-opus`). TDD per `~/.claude/rules/testing.md` (red test first).

## Oracle + harness
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- C instrumentation ephemeral: rebuild `gvplugin_dot_layout` → `/tmp/gvplugins`
  (NOT libgvc); restore clean + keep oracle cache native when done (memory
  `recover-slack-and-c-harness`, `oracle-native-not-wasm`).
- Reuse the diagnosis harness `test/diagnostic/flat-aux-dump.ts` (already
  canary-green) for the rank/chain/size dumps.
- Per-input check: `npx tsx test/corpus/render-one.ts <input> dot` vs cached oracle.
- Corpus survey: `npx tsx test/corpus/survey.ts` → `test/corpus/parity.json`
  (baseline: `#241_0` = `diverged`, maxDelta 126; ~796 entries).

## Quality gates (run after every task)
```
- command: npx tsc --noEmit
  pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, 0 failures; every curated golden BYTE-IDENTICAL except the
        intentionally-changed #241_0 adjacent-flat family (which must move toward
        the oracle). A golden change OUTSIDE that family ⇒ STOP (regression).
  on_fail: fix_and_rerun (in-family) / STOP (out-of-family)
- command: npx tsx test/corpus/survey.ts   # AD-4 regression gate
  pass: parity.json net-improves — #241_0 verdict diverged→matches (or smaller
        maxDelta) AND zero NEW diverges anywhere in the corpus.
  on_fail: STOP — this is the golden-risk the prior 4 missions feared
- command: lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 pin C group membership+order+auxt contract; write the failing (red) #241_0 oracle test | [x] |
| 2 | T2 implement caller-side grouping (green); T3 full regression sweep (goldens byte-identical + survey net-improve) | [ ] |

- [decisions.md](decisions.md) — locked decisions (AD-1..AD-5)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-ordering-contract.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-implement-grouping.md) · [T3](batch-2/T3-regression-sweep.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- **Out-of-family golden changes** (AD-4): any curated golden outside the
  `#241_0` adjacent-flat family flips → a regression in the shared aux path.
- The corpus survey shows ANY new `diverged` verdict.
- C instrumentation cannot pin a deterministic group order (the ordering is
  non-reproducible) — the fix would be guesswork.
- T1's pinned `edges[0]` is the BACK edge (contradicts the curl mechanism) —
  the diagnosis would be wrong; re-open it, do not force a fix.
- The same location/approach is changed 3× without resolving the same failing
  check (consecutive-fix rule).
- Implementing grouping requires restructuring `routeDotEdges` beyond the
  adjacent-flat dispatch (touching regular/back/labeled routing) — that is scope
  creep; bank and re-scope.

## Push-forward with judgment
- The exact insertion point (a grouping wrapper in `routeFaithfulSidePort` vs a
  pre-pass in `routeDotEdges`) — choose the most surgical that keeps the
  per-edge `spl`-dedup working.
- The group key (unordered `{tail,head}`) and the in-group sort comparator,
  pinned to T1's C contract.
- Test file locations/names for the new oracle + guard tests.

## Context
5th-mission diagnosis: `plans/flat-aux-curl-diagnosis/` (esp.
`findings-structural-dump.md`). Memory: `flat-edge-241-is-y-only`,
`instrument-c-before-quarantine`, `recover-slack-and-c-harness`,
`oracle-native-not-wasm`, `bucket-fix-rebucketing` (judge by per-id verdict
deltas, not bucket counts).

## Operational readiness
N/A — offline browser layout library; no SLIs/dashboards/traces/on-call. This is
a **behavior change on the layout path** (unlike the diagnosis): the safety net
is the AD-4 regression gate (curated goldens byte-identical out-of-family +
corpus survey net-improve). **Rollback: Reversible** (revert the merge commit).
No API / schema / contract / backwards-compat impact (internal spline geometry).
