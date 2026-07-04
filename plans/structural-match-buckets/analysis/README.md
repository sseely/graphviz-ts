<!-- SPDX-License-Identifier: EPL-2.0 -->
# Structural-match equivalence classes — ranked candidate missions

**Coverage: 163 / 163 structural-match cases attributed; unaccounted: [].**
(159 tracked + 4 already-accepted: 1435, 2796, 2471, 2368.)

The 159 *tracked* near-misses (identical SVG tree, numeric drift > ±0.01)
collapse to **~6 root-cause families**. The four largest are all
`known-mechanism` with concrete port loci: **121 of 159 (76%)** can be driven to
conformant by fixes touching a handful of files. **7** are provably won't-fix
(portability / oracle bugs). **~28** need further C-side instrumentation.

Signal captured by `survey.ts` (`maxDeltaPath`), auto-bucketed by `dashboard.ts`
(element-kind × magnitude), mechanism-attributed by five parallel diagnosis
agents (Batch 4). Per-bucket detail: [text-label](bucket-text-label.md) ·
[text-other](bucket-text-other.md) · [edge-path](bucket-edge-path.md) ·
[polygon-points](bucket-polygon-points.md) · [canvas-extent](bucket-canvas-extent.md).

## Cross-bucket family roll-up

The same root cause recurs across element-kind buckets (a worst-diff on a moved
node's *label* lands in `text-position`; on its *shape* in `polygon-points`; on
the *canvas* it grows in `canvas-extent`). Grouped by mechanism, not by bucket:

| # | family | cases | tractability | primary locus |
|---|---|---:|---|---|
| 1 | Cluster/root **label justify + anchor** | 81 | known-mechanism | `graph-label.ts:23-26`, `builder.ts:78` |
| 2 | **Self-loop label** placement + bbox | 18 | known-mechanism | `splines-groups.ts:90-95`, `splines-selfedge.ts` |
| 3 | **HTML table** cell-align + sizing | 15 | known-mechanism | `htmltable-pos.ts:194-210`, `htmltable.ts:426-430` |
| 4 | **compass-port** box-shape ray-cast | 7 | known-mechanism | `compass-port.ts:292-300` |
| 5 | **Shape-geometry** singletons | 4 | known-mechanism | box-orient / star / plain / nojustify |
| 6 | **x-coord NS** degenerate-optimum | 3 | known-mechanism (deep) | `ns-*.ts` LR_balance / Tree_edge order |
| — | **needs-C-instrumentation** (misc) | 28 | needs-C | see below |
| — | **accepted / won't-fix** | 7 | accepted-portability | A4-oracle, hypot-ulp, 1314 |
| | **total** | **163** | | |

Missions 1–4 = **121 cases (76% of tracked)** at known loci.

## Ranked candidate missions (count × tractability)

### Mission 1 — cluster/root label justify + anchor (81 cases) ★ DONE (+80)
**Fixed** on `fix/cluster-label-justify` (`8b22ac2`): 80 labelclust/labelroot
cases → conformant, 0 regressions, full suite green (conformant 603→683). 2592's
cluster label is fixed too but the case stays structural-match on an independent
`lhead/ltail` edge-path residual (now its dominant diff — belongs to the
edge-path/LR_balance work, not here). Original diagnosis below.

Two independent defects, both `known-mechanism`, corroborated by two agents:
- **label-justify (65):** `readLabelPos()` (`src/layout/dot/graph-label.ts:23-26`)
  computes only the TOP/BOTTOM bit from `labelloc`; it never reads `labeljust`
  nor sets the LEFT/RIGHT bits the consumer (`position-bbox.ts:174-199`) already
  handles — so cluster/root labels always center in X. Covers all 64
  `labelclust`/`labelroot` `*l`/`*r` variants **and** 2592 (same file). C parallel:
  `rootLabelPos` (`postproc.ts:288-297`) does read it.
- **label-anchor (16):** `GRAPH_LABEL_INHERIT_KEYS` (`src/parser/builder.ts:78`)
  omits `labelloc` from the subgraph inherit whitelist, so a cluster that doesn't
  redeclare `labelloc` fails to inherit the root default and falls back to the
  built-in top. Covers the `labelroot-*b*` share-/windows- variants.

### Mission 2 — self-loop label placement + bbox (18 cases) ★ DONE (+10)
**Fixed** on `fix/self-loop-label`: two faithful C ports — (2A) `updateBB` per
labeled self-loop in `splines-groups.ts` (left/top loops had no canvas-growth
path), and (2B) flip-correct label dimension + inter-loop widen in
`splines-selfedge.ts`. Moves 10 cases → conformant (all circle self-loops +
fsm×3), 0 regressions, conformant 683→693. Residual (separate mechanisms
revealed underneath, tracked as follow-ups): box-shape self-loops sb_box/
sb_box_dbl/sl_box_dbl/sr_box_dbl (~10–125pt, box compass-port geometry +
peripheries), `decorate` (~104pt), train11×3 (4pt canvas height). Original
diagnosis below.

- **bbox updateBB omission (10):** `dispatchEdgeGroup`
  (`src/layout/dot/splines-groups.ts:90-95`) never calls `updateBB` after routing
  a self-loop group; C does (`lib/dotgen/dotsplines.c:401-408`). Left/top loops
  get no ranking-time reservation, so this is the *only* growth path — canvas and
  node-polygon extents drift. Spans polygon-points (6) + canvas-extent (4).
- **selfedge label offset (8):** `SelfEdgeImpl.setLabelX` and the loop widen step
  (`splines-selfedge.ts:120-125`, `:189-231`) miss the `flip ? dimen.y : dimen.x`
  branch and the per-iteration `label.width - stepx` growth that C's `selfRight`
  applies (`lib/common/splines.c:1036-1046`) — the sibling `selfRightSpace` 3 lines
  away already does it right. Spans text-label (fsm/train11, 6) + text-other
  (sr_*_dbl, 2).

### Mission 3 — HTML table cell-align + sizing (15 cases) ◑ PARTIAL (+1)
**Cell-align mechanism fixed** on `fix/html-cell-align`: `placeCellRuns` now uses
`alignContentBox` honoring cell HALIGN/VALIGN (C `pos_html_cell` text branch,
`htmltable.c:1487-1526`), parallel to the existing `alignImageBox`. The
inv/nul/val matrix HTML tables now place byte-identically and 1898 → conformant,
0 regressions. BUT the 13 target cases mostly have compound residuals OTHER than
cell-align, so net conformance is only +1:
- **9-matrix** blocked by a separate 4pt residual on a `b` node with
  `image=…`+`labelloc=b` (image+labelloc node label — `needs-C`, akin to 2082),
  NOT the table (table text is now exact).
- **html2×3** has a deeper vertical-sizing residual (34pt canvas height, 14pt
  y-shifts) beyond alignment.
- **Deferred follow-ups (known mechanism, not yet applied):** per-line `<BR ALIGN>`
  justify — `placeSimpleRuns`/`placeSimpleRuns` hardcode center, should read
  `run.brAlign` (C `emit_htextspans`/BALIGN). Left un-done: it conformant-izes 0
  cases until the html2 vertical residual is also fixed, and it touches the hot
  per-line path. Original diagnosis below.

- **cell align (13):** `placeCellRuns`/`placeSimpleRuns`
  (`htmltable-pos.ts:194-210`, `htmltable-pos-runs.ts:221-240`) hardcode center,
  never reading `cell.align`/`brAlign`. Covers the `inv/nul/val` matrix + `html2`.
- **fixedsize + nested-space (2):** `htmltable.ts:426-430` zeroes a FIXEDSIZE
  table's explicit dimensions outright (1622_2); `pos_html_tbl` extra-space
  distribution (`htmltable.c:1600`) is unported (1622_3).

### Mission 4 — compass-port box-shape ray-cast (7 cases) ★ DONE (+12)
**Fixed** on `fix/compass-port-box` with a one-line guard: `applyIctxt`
(`compass-port.ts`) now skips the ray-cast for `isBox(n)` (shape.polygon===P_BOX),
using the exact bbox corner like C's `poly_port` (`shapes.c:2902-2903`). Moved 12
cases → conformant, 0 regressions: the 7 box/ports cases here PLUS the 4 Mission 2
box self-loop residuals (sb_box/sb_box_dbl/sr_box_dbl/sl_box_dbl) that were
downstream of the same wrong port point, plus bonus 2734. conformant 693→705.
Original diagnosis below.

`applyIctxt` (`src/common/compass-port.ts:292-300`) ray-casts box-shaped nodes;
C's `poly_port` (`lib/common/shapes.c:2902-2903`) bypasses the ray-cast for
`IS_BOX` shapes and uses an exact corner formula. `bezierClip` bisection can't
land exactly on a rectangle corner (a singular inside-test point), missing by up
to ~150px. Covers `sl_box`/`st_box`/`st_box_dbl`/`sr_box` + `ports` (×3).

### Mission 5 — shape-geometry singletons (4 cases) ★ DONE (all 4 conformant)
Independent `known-mechanism` one-offs, resolved individually:
- **1658** box vertex order ignores `orientation` — conformant (fixed by prior
  `fix/node-shape-geometry` work).
- **ref-star** `star` shape → conformant via the star vertex + `star_size`
  node-sizing port (`fix/star-cylinder-size-gen`); the old "generic decagon"
  note is stale.
- **ref-plain** `shape=plain` 0-size — conformant.
- **nojustify** label-justification space — fixed on `fix/nojustify-label-space`
  (`0e87163`): `labelSpace` (`poly-sizing.ts`) hardcoded the `!nojustify` path;
  added the `nojustify` branch (`space.x = dimen.x`, shapes.c:2132-2145) so a
  `\l` line in a node wider than its label aligns to the label block. The actual
  locus was `poly-sizing.ts labelSpace`, not the `make-label.ts:131` guess.
  graphs-nojustify → conformant, 0 regressions.

### Mission 6 — x-coord NS degenerate-optimum (3 cases, deep)
`1447_1`, `2371`, `2521` — equal-cost network-simplex vertex selection diverges
because the port's `Tree_edge` list order (`ns-subtree.ts`/`ns-core.ts`) differs
from C's `tight_tree`, so `LR_balance` reranks in a different sequence. The
long-standing NS-selection class ([[path-structure-1447]],
[[2371-is-xcoord-ns-solution-selection]]); harder than 1–5, own mission.

## Accepted / won't-chase (7 cases → `accepted-divergences.json`)

Not fix missions — portability constraints or oracle bugs. Move the un-entered
ones into `test/corpus/accepted-divergences.json`.

| ids | class | reason |
|---|---|---|
| 1435, 2796 | A4-oracle | already accepted (broken init_rank/pathplan oracle state) |
| 2471 | A4-oracle | already accepted; **2470** same family — *gap: not yet entered* |
| 2368 | A3 hypot-ulp | already accepted (Apple libm hypot ULP); **241_1** same family |
| 1314 | numeric-overflow | **C-side bug**: `unsigned int` job width/height overflow mod 2³² on a fuzzed giant fontsize; C prints wrapped bits via `%d`. Port reproduces C's wrong value bit-for-bit mod 2³². Accept as oracle defect. |

**Follow-up:** enter 2470 and 241_1 into `accepted-divergences.json` (one-line
each) so they leave the tracked set.

## Needs-C-instrumentation (28 cases, deferred)

Mechanism not yet pinned to a C locus within Batch-4 scope. Largest:
`hub-fanin long-edge chain` — **partly resolved**: `b100`/`b104` (Δ20) were
C-instrumented and proven to be the accepted A3 hypot-ULP tie-break class (NOT
the b15 groupSize mechanism, which was refuted for b100 — box/poly/taut-path all
byte-identical to C up to `findMaxDev`'s knot pick); now accepted-portability
(`.agent-notes/hub-fanin-longedge-diagnosis.md`). `b29 ×4 / b124 ×3` (Δ up to
2559 — orders of magnitude larger than one rank-row) remain OPEN as a distinct,
larger mechanism, possibly the real `plans/fix-graphs-b15/` groupSize work.
`splines=ortho corridor
tie-break` (3: 56/1856/2361); `polypoly` rotated-4-gon ellipse-fit float
sensitivity (3); labeled 2-cycle vspace (2: 2413_1/2413_2); edge-port-label-clip
(2: arrowsize/144_ortho); singletons 1453, graphs-style, 2646, 2082, b57, 2613,
2734, 1949. Each keeps its own row in the per-bucket files.

## How to regenerate the auto-buckets

`npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts` → the
"Tracked structural-match — by worst-diff signature" table in
[PARITY.md](../../../test/corpus/PARITY.md). This analysis (mechanism families)
is the point-in-time human/agent layer over that regenerable element-kind map.
