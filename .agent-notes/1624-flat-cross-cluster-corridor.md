<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 1624 non-adjacent flat edge routed straight — FIXED via corridor + makefwdedge orientation (C-instrumented)

- **Context**: 1624 (`digraph cluster`, record nodes, clusters dc1/dc2; edges
  app1->cas1, app1->cas2, app2->cas1). diverged maxΔ 29.41. Part of the flat
  cross-cluster spline-routing family.

- **Root cause**: only `app2->cas1` diverges — a **non-adjacent flat
  cross-cluster** edge (app2 right, cas1 left, cas2 between). C routes it
  up-and-over via `make_flat_edge`'s box corridor; the port declined all
  `routeFlatEdge` branches (labeled / adj-no-port / side-port) and fell back to a
  straight line through cas2. The corridor router `routeFlatEdgeGroupFaithful`
  existed but was gated behind `hasSidePort`.

- **C instrumentation** (rebuilt `gvplugin_dot_layout` with printf in
  `make_flat_edge`, gated on the app2/cas1 pair; reverted after). Ground truth:
  - `BWDEDGE=1` → C `makefwdedge`s the sample so tn=cas1 (left), hn=app2 (right).
  - `vspace=8, stepx=9, stepy=4`; `cas1 coord.y=26.5` (PRE cluster translate),
    `ht2=51.3`. The port works in the FINAL frame (cas1 y=34.5 = 26.5+8); the
    boxes/points match C **+8 uniformly**, so shape is translation-invariant.
  - C routed pn=10: cas1-center→app2-center; then `clip_and_install` clips to
    node borders and emits tail→head (app2→cas1).

- **Fix** (4 parts, all faithful):
  1. `isNonAdjGroupable`: drop the `hasSidePort` gate (C routes EVERY non-adjacent
     flat). `collectNonAdjacentFlatGroup`: also require `x.info.label ===
     e.info.label` — C's edgecmp breaks a flat group on label inequality, so a
     labeled opposing leg is NOT pulled into an unlabeled rep's group (this is
     what re-drew 2368_1's merged `256->376` until added).
  2. `routeFlatEdge` (edge-route.ts): new branch — non-adjacent, unlabeled,
     no-side-port flat → corridor.
  3. `routeFlatEdgeGroupFaithful` (makefwdedge): build the channel left→right by
     node ORDER (leftNode=lower order) with a swapped-port **sample** edge so
     `beginPath` anchors the path start at the left node; then reverse the routed
     points for a right-to-left edge and pass `ignoreSwap:true` so
     `clipAndInstall` clips/arrows by the real tail/head (emits tail→head).
  4. `flatVspace`: guard `prevIdx >= minrank` (EDGE_LABEL uses r-2; after
     `abomination` r-2 can fall below minrank → was crashing 2368_1 with
     "reading 'v' of undefined").

- **Result**: 1624 diverged→**BYTE-MATCH**; 2368_1 kept BYTE-MATCH (the earlier
  opposing-merge fix); golden suite + flat/edge/render unit tests green. (A prior
  too-broad attempt without the label-equality + orientation pieces regressed
  2368_1 to errored and worsened 1624 — those are now resolved.) Full corpus
  survey/gate: pending verification in the working session.

- **Confidence**: High — every value pinned to C instrumentation; 1624 + 2368_1
  conformant with the headless oracle.
