<!-- SPDX-License-Identifier: EPL-2.0 -->
# T6 — 1453 splines=curved constraint=false arrowhead Δ465 (diagnosed 2026-07-04)

**mechanism**: `dedupByOrig` (src/layout/dot/splines-groups.ts:73-83) computes
`o = resolveOrigEdge(e)` for the dedup Set but pushes the UNRESOLVED raw `e`
(`out.push(e)` at :80). For a same-rank flat edge whose canonical orientation
is tail/head-swapped, the raw entry is a swapped internal proxy;
`routeCurvedGroup` hands it to `makeStraightEdges`, clipping/routing the
arrowhead against the wrong endpoint geometry.

**origin**: src/layout/dot/splines-groups.ts:80 — `out.push(e)` should push
the resolved original (or C's exact asymmetric form: `getMainEdge` on the
group's first entry).

**causalChain**: constraint=false + concentrate + splines=curved → the edge
routes via routeCurvedGroup → swapped proxy reaches makeStraightEdges → wrong
endpoints → Δ465.65 arrowhead polygon. dispatchEdgeGroup (non-curved caller
of dedupByOrig) masks the same bug in its cnt<=1 branch via a redundant
resolveOrigEdge re-call that routeCurvedGroup lacks — why only curved shows it.

**ruledOut**: routeCurvedGroup lane-order/origSeq resort (mission prime
suspect) — C's instrumented dot_splines_ shows the divergent edge
(CMD_POST_WRAP_COPY->CMD_BEGIN) routes as a cnt=1 SINGLETON group; no
multi-member lane order exists to get wrong. Both repos reverted clean after
instrumentation.

**verdict**: fix (confirmed causally via two independent reverted worktree
experiments)

**proposedWriteSet**: src/layout/dot/splines-groups.ts (dedupByOrig) +
regression test.

**evidence**: agent transcript holds the C dot_splines_ dumps + TS
instrumentation; repro = render 1453.dot both sides, compareSvg deterministic.
