<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions — fix 2-cycle back-edge

## ADR-1: Iterate original cgraph out-edges in the back-edge handler
- **Context:** C's class2 backward-edge block iterates `agfstout(g, aghead(e))`
  (original cgraph edges); the port's `handleBackEdge` iterates the `outEdges`
  helper which returns `n.info.out` (the fast/virtual graph). For a 2-cycle this
  makes `opp` a fast edge (`to_virt` undefined), tripping the `makeChain(opp)`
  guard and duplicating the edge.
- **Decision:** change `handleBackEdge` to iterate `e.head.outEdges(g)` (original
  edges), matching C and the port's own `class1` (classify.ts:144). Remove the
  now-unused local `outEdges` helper.
- **Consequences:** `opp` becomes the original forward edge with `to_virt` set →
  `makeChain` skipped → back edge merges into the existing chain. Confirmed: the
  duplicate disappears; NaN median 691→0.

## ADR-2: Faithful-only change; do not alter tryOppEdge/merge logic
- **Context:** once `opp` is the original edge, the rest of `tryOppEdge` /
  `oppEdgeConcOrMerge` / `mergeChain` already mirrors C
  (`make_chain(opp)` when `to_virt==NULL`, then `merge_chain(e, to_virt(opp))`).
- **Decision:** make ONLY the edge-source change + helper removal. Do not touch
  `tryOppEdge`, `makeChain`, or `mergeChain`. If they appear to need changes,
  STOP — the diagnosis says they should not.
- **Consequences:** minimal diff, lowest regression risk.

## ADR-3: NaN residual (Trap ~43) is out of scope
- **Context:** after the fix NaN's arrangement is near-exact (median 0) but one
  node (`Trap`) is ~43 off.
- **Decision:** this mission fixes the 2-cycle double-count only. The residual is
  a separate, smaller issue (font-metric class or another back-edge/flat detail)
  — capture as a follow-up, do not chase here.
- **Consequences:** mission completes on the 2-cycle fix with 0 regressions; NaN
  may stay structural-match on the residual.

## ADR-4: Blast radius = all cyclic digraphs → full survey mandatory
- **Context:** `handleBackEdge` runs for every back edge in every cyclic graph,
  not just 2-cycles. Changing the iterated edge set could affect long back edges,
  labeled back edges, and ported-back-edge cases.
- **Decision:** gate on a full corpus survey with **0 regressions**; add 2-cycle
  goldens. Treat any regression as STOP.
- **Consequences:** confidence the fix is corpus-safe, not just repro-safe.
