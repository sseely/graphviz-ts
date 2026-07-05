<!-- SPDX-License-Identifier: EPL-2.0 -->
# T7 — 2646 (diagnosed 2026-07-04) — FIX; record-port hypothesis REFUTED

**mechanism**: computeLeftBound/computeRightBound
(src/layout/dot/edge-route-rank.ts:23-63) are recomputed fresh PER EDGE,
while C computes spline_info_t sd ONCE per dot_splines pass
(dotsplines.c:248,270-282) and threads it by pointer. recoverSlack/resizeVn
mutate vnode coord.x/lw/rw in place as earlier edges route, so later edges
see a corridor 26pt narrower per side than C's pristine snapshot. Only the 3
edges (of 21,216) whose natural curve approaches the outer boundary show it
(Δ42.09 worst).

**origin**: src/layout/dot/edge-route-rank.ts:23-63 call timing (per-edge) vs
C dotsplines.c:248 (once per pass).

**keyProof**: the port's very FIRST computeLeftBound call (before any edge
routes) returns -585149, byte-identical to C's one-time value — formula
faithful; staleness is the whole bug.

**ruledOut**: record sub-port resolution (beginPath/endPath instrumentation
both sides: field lookup, compass, side, bbox byte-identical for all 3
divergent edges).

**verdict**: fix

**proposedWriteSet**: hoist the bound computation once into dotSplines_ and
thread through edge-route-chain.ts, edge-route.ts, edge-route-faithful.ts,
splines-flat.ts (4-5 files) + regression test. NOTE >3 files: write-set
expansion pre-authorized by the diagnosis doc naming them explicitly
(journal), per the ask-to-expand amendment — flag at T17 start if more appear.

**evidence**: agent transcript (paired beginPath/endPath dumps, bound-value
traces). Cleanup verified by agent: TS worktree reverted; C splines.c/
dotsplines.c reverted; gvc/dotgen/gvplugin_dot_layout REBUILT to purge
instrumentation from /tmp/ghl; clean render mit 0 stray debug lines.
