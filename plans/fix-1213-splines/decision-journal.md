<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. Batch 1 (T1) writes the mechanism artifact here
(Mechanism / Origin `file:line` / Causal chain / Ruled-out), which T2 consumes.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | pre-mission | Investigation: `1213-1`/`1213-2` `diverged` (maxΔ ~20–22) is **constraint=false edge-spline routing only**. Node positions/ranks/clusters and 14/17 edges match the oracle byte-for-byte; only `V0->V2`, `V0->V3`, `V1->V9` (all constraint=false) differ in spline control points. C oracle exits 1 with `Error: trouble in init_rank` (unfixed xfail #1213, `ns.c:171`; port `initRank` omits the `ctr!=N_nodes` check at `ns.ts:56`) but lands on the identical node layout — **init_rank is a red herring for geometry** (AD-4). See `.agent-notes/1213-constraint-false-spline-divergence.md`. |
| 2026-06-30 | T1 | Mechanism pinned (gated STOP). Corrected the pre-mission count: **5** edges diverge in `1213-1`, not 3 — `V0->V2`, `V0->V3`, `V1->V9` **plus** `V10->V6`, `V10->V7` (two had structurally different segment counts/endpoints). All trace to **one** root cause: the flat-label virtual-node placement order. See mechanism artifact below. **Origin = `src/layout/dot/flat.ts:87 flatLimits` (non-faithful port of `flat.c:104 flat_limits` + `flat.c:58 setbounds` + `findlr`).** Confirmed via reverted probe (force `place=8` → all 17 edges byte-match oracle) and on `1213-2` (same cause). **AD-4 does NOT apply** (not init_rank). Recommend re-scoping T2 write-set from `edge-route*.ts`/`splines*.ts` to **`src/layout/dot/flat.ts`** (+ its test). |

---

## T1 mechanism artifact (gated — STOP before Batch 2)

### Summary
The pre-mission diagnosis named the right symptom (constraint=false splines) but
the wrong subsystem. The divergence is **not** in edge-spline routing
(`edge-route*.ts`/`splines*.ts`). It originates one phase earlier, in the
**placement order of a flat-labeled edge's label virtual node** during
`flat_edges` (mincross setup). A single wrong order cascades into the
constraint=false back-edge corridors. `1213-1` has **5** diverging edges (not 3):
`V0->V2`, `V0->V3`, `V10->V6`, `V10->V7` (multi-rank back edges) and `V1->V9`
(the labeled flat edge itself).

### Mechanism
For a non-adjacent **labeled flat edge**, C `flat_node` inserts a label virtual
node on the rank *above* the endpoints (`r-1`) at order `place = flat_limits(g,e)`.
C's `flat_limits`/`setbounds`/`findlr` is **topology-aware**: it walks every node
already on rank `r-1` and, per node, inspects where that node's *outgoing edges*
land on rank `r` relative to the flat edge's endpoint-order span, accumulating
hard/soft left/right bounds, then places the label at the bound midpoint.

For `1213-1`'s `V1->V9` (label=b; V1@order4, V9@order2 on rank 2, non-adjacent —
a `V10>V6` vnode sits between them) C computes **place = 8** (the end of rank 1).
The port's `flatLimits` is a **crude rewrite that ignores edge topology**: it
compares the rank-`(r-1)` vnodes' *own* orders against the rank-`r` endpoint
orders `tOrd`/`hOrd` (orders on a *different* rank) and returns the midpoint of
those counts → **place = 3**. Same inputs (both sides see order(V9)=2,
order(V1)=4 — rank-2 order arrays are byte-identical), different algorithm,
different result.

Inserting the label vnode at order 3 instead of 8 shifts every subsequent rank-1
virtual node (the back-edge chain nodes `V10>V6`, `V3>V1`, `V0>V3`, `V10>V7`,
`V0>V2`) by +1 order. Position network-simplex then assigns those vnodes
different x-coords (e.g. `V0->V2` vn: C x=364 vs port x=404; `V10>V6` vn: C 206 vs
port 268). `maximal_bbox` → `neighbor` consequently selects a different
left/right neighbor for each back edge's chain vnode, producing a different
middle corridor box (`box[2]`): for `V0->V3`, C `box[2]` LL.x=13 (neighbor walks
left past pathscross-ing vnodes to the far-left `V4>V0` vn) vs port LL.x=235
(neighbor stops at the mis-placed `V1>V9` vn now sitting at order 3, x=227).
`routesplines` then fits a wider, wavier spline with extra bezier segments
(`V0->V2`: 4 segs vs C 3; `V10->V6`: 5 vs 3). `V1->V9` itself diverges because
its own label node is mis-placed.

### Origin (AD-2 single fix file:line)
- **`src/layout/dot/flat.ts:87` `flatLimits`** (+ helpers `limitsLeft` :65 and
  `limitsRight` :74) — a non-faithful simplification.
- C spec: **`~/git/graphviz/lib/dotgen/flat.c:104 flat_limits`**, which calls
  **`flat.c:58 setbounds`** and **`flat.c:46 findlr`** (neither ported). The fix
  is to faithfully port `flat_limits`+`setbounds`+`findlr` into `flat.ts`,
  replacing `flatLimits`/`limitsLeft`/`limitsRight`. `flat_node`/`make_vn_slot`
  are already faithful (`flat.ts:148`/`:49`); only the bound computation is wrong.
- **Single file** → satisfies AD-2. Proposed T2 write-set:
  `src/layout/dot/flat.ts` (+ `src/layout/dot/flat.test.ts` or a 1213 golden).

### Causal chain
`flatLimits` ignores edge topology (flat.ts:87) → returns 3 not 8 for `V1->V9`'s
label vnode → `make_vn_slot` inserts it at rank-1 order 3 (flat.ts:155) → all
back-edge chain vnodes shift +1 order → position-NS reassigns their x-coords →
`maximal_bbox`/`neighbor` (edge-route-faithful.ts:152/splines-route.ts:238)
returns a different bounding neighbor → `box[2]` of each back-edge corridor
differs → `routesplines` fits a wavier, extra-segment spline. The labeled flat
edge `V1->V9` diverges directly from the mis-placed label node.

### Ruled out (with evidence)
- **NOT the spline fitter / `routesplines`.** Forward multi-rank edges
  (`V4->V0` etc.) run through the *same* `routeChainSegmented` → `routeSplines`
  and match the oracle byte-for-byte. Their chain vnode (order 0) sits before the
  divergence point, so its `box[2]` is correct. Same fitter, correct input ⇒
  correct output.
- **NOT edge classification / router dispatch.** Both forward and back multi-rank
  edges use `routeChainSegmented`; `routeBackEdge` (edge-route-chain.ts:405) is a
  faithful `makeFwdEdge`+chain wrapper, not a legacy fitter. The divergence is the
  *input geometry* (vnode order/position), not which router runs.
- **NOT init_rank (AD-4).** `flat_edges`/`flat_node`/`flat_limits` runs in
  mincross setup regardless of the ranking cycle. Its inputs — the rank-2 endpoint
  orders `order(V1)=4`, `order(V9)=2` — are **byte-identical** between C and port
  (rank-2 dumps match exactly). The port diverges purely because `flatLimits` is
  the wrong algorithm, not because of degraded ranking input. So matching C does
  not require reproducing C's init_rank error.
- **Confirmation probe (reverted).** Forcing `place=8` in `flatNode` (env-gated,
  reverted) made **all 17 edges of `1213-1` match the oracle within ±0.01** —
  every one of the 5 divergences collapsed. Proves the single root cause and the
  full causal chain.
- **`1213-2` shares the cause.** Its labeled flat edge `S1->H4` (label=b) gets
  C order **8** (x=260) vs port order **3** (x=268) on rank 1 — the identical
  pattern; its 8 diverging edges are the analogous constraint=false back edges
  plus the labeled flat edge.

### Instrumentation (all reverted; `git diff` clean in both repos)
C `dotsplines.c`: box/endpoint dump before each `routesplines`; per-edge
RANKINFO; `maximal_bbox` neighbor dump; one-shot full-rank dump. Port: router
trace in `routeOneEdge`; `P`-box dumps in `routeRegularEdgeFaithful`/
`routeChainSegmented`; `maximalBbox` neighbor dump; one-shot rank dump; env-gated
`place` override probe in `flatNode`. C rebuilt clean (`gvplugin_dot_layout`).
