# Architecture decisions

## AD-1: Instrument C before any fix (Batch 0 spike)

- **Context**: the exact root cause of each residual is not yet pinned to a C
  line; the project mandates `instrument-c-before-quarantine`.
- **Decision**: Batch 0 dumps C-vs-port for both sites — `makeSimpleFlatLabels`
  rep-edge control points + `make_flat_adj_edges` arc construction, and the
  flat-label-rank `flatNode` height + rank `ht1/ht2` — and pins the first
  diverging value for each.
- **Consequences**: each later batch consumes a pinned divergence; no guessing.
  Temporary, env-gated C/port instrumentation, reverted after capture.

## AD-2: Fix Issue 2 (geometry) and Issue 1 (vspace) in separate, gated batches

- **Context**: distinct root causes in distinct functions
  (`makeSimpleFlatLabels` vs `flatNode`/rank spacing).
- **Decision**: Batch 1 = Issue 2 (curve geometry) FIRST, Batch 2 = Issue 1
  (vspace). One commit + one full survey per batch.
- **Consequences**: a regression is isolated to one change. Issue 2 first because
  it is the dominant maxΔ-65 divergence and resolving it clarifies whether the
  5pt vspace is truly independent. Rejected: combined fix (couples two risk
  surfaces into one un-bisectable survey).

## AD-3: The ~1pt x-NS tie-break is conditional and last (T3)

- **Context**: a ~1pt node-x delta (136 at 255 vs 256) may remain after Issues
  1+2; it is the 2371-class x-NS optimal-face selection (deep, corpus-wide).
- **Decision**: pursue ONLY if 2368 still diverges by that delta AND a localized,
  low-risk fix exists. Otherwise mark T3 a no-op and document the residual.
- **Consequences**: avoids dragging the deep x-NS optimal-face work into a 1pt
  residual. 2368 may close to "≤1pt x-NS residual" rather than perfect conformant
  — an acceptable outcome if the alternative is high-risk.

## AD-4: Hard invariant — the 492 conformant corpus stays conformant

- **Context**: both fixes touch geometry that currently conforms to on many
  graphs.
- **Decision**: full survey after EVERY change; any conformant→worse is STOP +
  revert the change.
- **Consequences**: 2368 conformant is never bought at the cost of a regression
  elsewhere. ~17 min/iteration accepted. If a faithful-to-C fix is impossible
  without regressing others, the divergence is deeper than scoped → stop.

## stop-conditions

1. Any conformant→worse regression in the survey. STOP + revert that change.
2. 2 consecutive gate failures on the same check. STOP.
3. A fix needs to write outside its declared write-set. STOP.
4. 3 consecutive edits to the same site without resolving it. STOP (deeper
   design problem).
5. A 2368 geometry fix cannot be made faithful to C (matching the C trace)
   without regressing other graphs. STOP + document (the divergence is a
   shared-invariant problem, not a localized 2368 fix).

## Key C references (read-only spec)

- `lib/dotgen/dotsplines.c`: `makeSimpleFlatLabels` (944), `makeSimpleFlat`
  (1075), `make_flat_adj_edges` (~1110 dispatch at 1159/1163), `make_flat_edge`
  (1502), `make_flat_labeled_edge` (1314).
- `lib/dotgen/flat.c`: `flat_node` (label vnode height), `flat_edges`.
- `lib/dotgen/position.c`: `set_ycoords`, rank `ht1`/`ht2`, `dot_position`.
- `lib/common/utils.c`: `dot_scan_ranks` / ranksep with `EDGE_LABEL`.

## Ground-truth data (2368, instrumented in the prior mission)

- C label vnode for 256→316 = (20.0, 40.4), ht 9.6, lw/rw 3.3 — **conformant
  to port** (so Issue 1 is rank spacing, not label vnode placement).
- 376→76: C path = `M273.31,-4.56 C268.33,-3.14 263.11,-1.9 258.11,-1.15
  250.49,0 242.34,-0.98 234.83,-2.8` (7-pt arc); port =
  `M290.59,-8.8 C270.39,-8.8 209.3,-8.8 207.06,-8.8` (4-pt straight). adjacent=1,
  orders 3→2, label `to1`.
- bbox: C 608×148, port 604×143 (Δ 4 wide, 5 tall).
- Baseline (after prior mission): 2368 diverged, maxΔ 65.25,
  firstDiff `svg/g[1]/g[13]/path[1]/@d`.
