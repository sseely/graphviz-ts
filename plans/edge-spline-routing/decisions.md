<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture Decisions

## D1 — Spike before fix; do not pre-commit a fix file {#d1}

**Context:** The extra-segment cause is upstream of the faithful fitter but not
localized (box corridor vs input chain vs endpoint slopes).
**Decision:** Batch 1 (S1) instruments C + port to pin the exact site; the fix
file/approach is decided only then.
**Consequences:** The fix task (T2) is a template until S1 fills it in. Avoids a
wrong-file guess; costs one extra batch boundary.

## D2 — C is the spec; pin to instrumented oracle values {#d2}

**Context:** Routing geometry is decades of load-bearing C behavior (CLAUDE.md).
**Decision:** Dump C's `routesplines`/`Proutespline` inputs+outputs (rebuild
`gvplugin_dot_layout` → `/tmp/gvplugins`) for the reproducer's diverging edge and
pin the port to them conformant. No "cleaner" reimplementation.
**Consequences:** Requires a C rebuild + instrumentation harness (S1).

## D3 — Scope to the long-edge extra-segment class only {#d3}

**Context:** dot edge routing has many divergence classes (flat, self, steering,
parallel) — most already ported/verified (route corpus 25/25).
**Decision:** Fix only the long-edge piecewise-subdivision divergence. If S1 or
T2 surfaces an unrelated routing bug, log it and stop — do not chase it here.
**Consequences:** Keeps the mission bounded and the regression surface small.

## D4 — Regression floor: 0 regressions, conformant ≥ 280 {#d4}

**Context:** `main` has 280 conformant rows; none must regress. Edge routing is
shared, so a corridor/chain change can perturb many edges.
**Decision:** Acceptance requires `conformant ≥ 280` and **0 per-id regressions**
(survey diff vs `main`). The fix must leave currently-matching edges byte-
identical. If it cannot, stop and re-scope.
**Consequences:** The fix must be narrow — ideally gated on the exact condition
that triggers the extra split, not a global corridor change.

## D-fixsite — Localized fix site (FILLED BY S1) {#d-fixsite}

**Status:** RESOLVED by S1 (2026-06-23). Site = **edge routing ORDER** in
`routeDotEdges` (`src/layout/dot/edge-route.ts`), NOT the box-corridor geometry,
input chain, or slopes (all faithful).

**Context — instrumented C-vs-port diff (reproducer `/tmp/le_long.gv`, diverging
edge `n12->n14`, a 2-rank forward edge through one rank-13 virtual node `v1`):**

The first differing `Proutespline` field is the **box corridor** (hence the
shortest-path polyline, hence the piece count):

| field | C (oracle) | port |
|-------|-----------|------|
| `pl` (Pshortestpath input) | **3 pts**, bends at the waist | **2 pts**, straight |
| output spline | **7 (2 cubics)** | **4 (1 cubic)** |
| `v1` maximal-bbox right wall (box[2].UR.x) | 45 | 106 |

Node centres conformant with the oracle; the endpoints' uniform +41 x is a benign
internal-frame translation (cancels at render). After removing it, `v1` itself
sits where C puts it, **but `v1`'s right neighbour (rank-13 order-1 virtual) is
+12.7 too far right**, which widens `maximal_bbox(v1)` and erases the corridor
waist → straight shortest path → 1 cubic instead of 2.

**Why the neighbour moves:** `recover_slack` (faithfully ported) re-centres each
chain virtual node into its routing box. Both C and the port move the rank-13
order-1 vnode to the **identical** position (n12-relative box `ll 54.3 / ur 59.2`,
centre 56.7). The divergence is **WHEN** that move happens relative to
`n12->n14`:
- **C `dot_splines_`** routes edges from a list built **rank-major** (`GD_rank[i].v[j]`
  out-edges) then **`edgecmp`-sorted** (key order: edge-type desc → **rank-span
  asc** → |Δx| asc → AGSEQ asc → ports). So the **shorter** `n12->n14` (span 2)
  routes **before** the longer edge X that owns/displaces its neighbour →
  `n12->n14` sees the neighbour at its pre-displacement x → narrow waist → 2 cubics.
- **port `routeDotEdges`** iterates `g.nodes.values()` (insertion order, no
  span sort), so X routes **first**, displacing the neighbour → `n12->n14` sees
  it +12.7 right → no waist → 1 cubic.

Because `recover_slack` mutates **shared** neighbour virtual nodes, corridor
geometry is **routing-order-dependent**; the port's order ≠ C's order.

**Decision:** Make `routeDotEdges` iterate edges in C's `dot_splines_` order:
build the edge list **rank-major** over `g.info.rank[i].v[j]` (out-edges of
NORMAL / splineMerge nodes — the port's `buildOutEdgeIndex` already keys real
tails), then **stable-sort by a ported `edgecmp`** (edge-type desc, rank-span
asc, |tail.x−head.x| asc, AGSEQ asc). Route in that order. `routeOneEdge`'s
per-edge dispatch (flat/back/regular) is unchanged. JS `Array.sort` is stable so
edgecmp-equal edges keep rank-major order (C batches those via the cnt-loop, so
their relative routing order is immaterial).

**Prototype verification (in S1, reverted):** rank-major collection + stable sort
by rank-span ascending makes **all 26** reproducer paths conformant with the oracle,
with the other 25 paths **unchanged**.

**Consequences / blast radius:** This is a **global** routing-order change, not a
gated corridor tweak (contra D4's "narrow fix" preference). It only perturbs
output where `recover_slack` displaces a vnode shared as another edge's corridor
neighbour — i.e. dense overlapping multi-rank graphs. Most of the 280 conformant
rows are simpler graphs and should be unaffected, but **T3's full survey is the
D4 gate**: if any of the 280 rows regress, STOP and report (do not force the
order).
