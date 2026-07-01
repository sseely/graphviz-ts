# graphs-biglabel — root cause (T2)

## Mechanism
The record shape's `pboxfn` (C `record_path`, `lib/common/shapes.c:3793`) is
**unported**: `RECORD_FNS.pboxfn = null` (`src/common/shapes.ts:56`). For a
REGULAREDGE whose head is a record node reached via an **interior** port
(`side == 0`, e.g. `struct3:here`), C's `endpath` invokes
`pboxfn = ND_shape(n)->fns->pboxfn` = `record_path` to build the routing box as
the **full-node-height vertical strip of the top-level field containing the port
x** (`lib/common/splines.c:585-588, 742-744`). With `pboxfn` null the port falls
to `endp.boxes[0] = endp.nb` (the maximal bbox), producing a wide box instead of
the narrow port channel.

## Origin
`src/common/shapes.ts:56` (`RECORD_FNS.pboxfn = null`) + the unported
`record_path`. The port's `beginPath`/`endPath` accept `pboxfn` as a parameter
that every caller passes as `null` (`edge-route-faithful.ts:367`,
`edge-route-chain.ts:81`, `splines-flat.ts:381`) — whereas C looks it up
internally from the node's shape (`splines.c:389` begin, `:586` end).

## Causal chain
null pboxfn → endPath fallback box2 = maximal bbox
(x[48.9,295.4], y-bottom 689.1) instead of C's record_path channel
(x[261.6,317.7], y-bottom 0) → Proutespline fits a single diagonal cubic
(45.77,1413.8)→(295.4,690.1) instead of C's up-along-top-then-down 2-cubic →
the spline enters the `here` cell from the LEFT and clips at x≈548 instead of
the RIGHT at x≈578 → 111pt head-endpoint delta (= maxDelta 111.03) and the
`g[5]/path[1]/@d` divergence.

## Ruled out (with evidence)
- **Record/node sizing:** struct3 group `g[4]` is byte-identical port vs oracle
  (13897 B). The `here`/`d` cell box is in the same place both sides.
- **Head-port resolution:** instrumented `here` port on both sides →
  `sides=0, side=0, p=cell-center, clip/constrained` identical; `posReclbl`/
  `recSideMask` (record.ts) is an exact port of C `pos_reclbl`.
- **Tail/start:** start point (45.769,1413.800) matches C exactly. struct1:f2 is
  an *edge* field (`side != 0`) so C's endpath/beginpath side-box branch handles
  it (not pboxfn) — which the port already mirrors. Only the interior head port
  needs pboxfn.
- **Proutespline / fitter itself:** given identical boxes it would match; the
  divergence is entirely upstream in the box corridor.

## fixSite (for T3)
1. Port `record_path` → e.g. `recordPath(n, prt, side, rv, kptr)` in
   `src/common/record-port.ts` (faithful to shapes.c:3793: pick the top-level
   `info.fld[i]` whose local x-range brackets `prt.p.x`; box = that field's
   x-range × full node height, offset by `ND_coord(n)`; honor `GD_flip`).
2. `src/common/shapes.ts:56` → `RECORD_FNS.pboxfn = recordPath`.
3. Make `beginPath`/`endPath` obtain `pboxfn` from the node's shape internally
   (C `ND_shape(n)->fns->pboxfn`, splines.c:389/586) rather than the null
   parameter — the minimal faithful wiring; the `pboxfn` param then becomes
   redundant.

## Verdict target (AD-3)
`conformant` (byte-match) expected — this is a genuine algorithmic port defect,
not platform-libm FP. **Not** an AD-5 escape.

## Scope note (AD-4)
`beginPath`/`endPath` are shared primitives: wiring pboxfn changes routing for
ALL record-node port edges. This is the intended faithful behavior; the
789-corpus `survey:gate` (0 regressions) is the mandatory guard in T4.
