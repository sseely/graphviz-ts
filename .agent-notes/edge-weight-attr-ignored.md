<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: the `weight` edge attribute was completely ignored by dot layout

- **Context**: investigating 2095 (#1 worst diverged, maxΔ 19852). Same
  node/edge count (275/275), near-identical height (~20000), but width C=1949pt
  vs port=177pt — the port collapsed the graph into a narrow column.
- **Root cause**: `dotInitEdge` (init.ts) did `e.info.weight = e.info.weight ?? 1`
  — it NEVER read the `weight` attr. C: `ED_weight(e) = late_int(e, E_weight, 1,
  0)` (dotinit.c:65). So every edge got weight 1 regardless of `weight=N`.
  Confirmed: `info.weight` is `undefined` after parse for `weight=5`/`weight=0`.
- **2095 trigger**: edge `8->414` has `weight=0`. Node 8 (no in-edges, only the
  weight-0 out-edge) should float to the top rank via network-simplex
  `TB_balance` (inw==outw → move to least-populated rank, default low=0). With
  weight forced to 1, inw(0)≠outw(1) → 8 stayed tight against the sink 414 →
  edge 8->414 became a short edge instead of a whole-graph-spanning one. C bows
  it out to x=4140; the port kept it narrow.
- **Fix (branch fix/edge-weight-attr)**: read the attr when present, else
  preserve the existing runtime weight:
  `e.attrs.has('weight') ? lateInt(e.attrs.get('weight'),1,0) : (e.info.weight ?? 1)`.
- **GOTCHA — why not the unconditional `lateInt`**: `dotInitEdge` is RE-RUN
  (3× on the labeled flat edge in `{rank=same;a b} a:e->b:w[label="x"]`). The
  flat-label machinery stamps `e.info.weight = 10000` (splines-flat.ts:165)
  BETWEEN re-inits; an unconditional `lateInt` clobbers it to 1, breaking the
  flat-label spline (10pts→4pts). The attr-conditional form preserves it. The
  pre-existing dot.test.ts "preserve pre-set weight" test documents exactly this
  re-init contract.
- **Result**: 2095 maxΔ 19852→6.0 (width 177→1948 vs C 1949; node 8 floats to
  top). All 2416 tests pass.
- **Confidence**: High — oracle-confirmed (minimal repro
  `"8"->"414"[weight=0]; chain->414`: C floats 8 to top, port now matches).
