<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (approved)

## AD-1: Dispatch via `kind === SH_POINT` branch (not a dedicated POINT_FNS)
- Context: C uses `point_fns` (point_init/point_gencode/point_inside); the port
  registered `point` with `POLY_FNS` + `kind: SH_POINT` but never branches on it.
- Decision: branch on `SH_POINT` inside `nodeinit.ts` (sizing) and
  `poly-gencode.ts` (render), reusing `POLY_FNS`. No new `POINT_FNS`; no change
  to `shapes.ts` (kind already set).
- Consequences: minimal surface; point logic sits next to the poly logic it
  overrides.

## AD-2: Sizing — port `point_init`'s formula into the `nodeinit.ts` branch
- Context: `point_init` overrides node size independent of the label.
- Decision: `w = min(width_attr, height_attr)`; if neither set → `DEF_POINT`
  (0.05in); else clamp to `MIN_POINT` (0.0003in); set `width = height = w`.
  Bypass label-driven sizing for SH_POINT.
- Consequences: rx 1.8pt for the default point = oracle; size no longer depends
  on the (suppressed) label.

## AD-3: Label suppression at render time
- Context: `point_gencode` never emits a label.
- Decision: in `poly-gencode.ts`, skip the `renderLabel` call when `SH_POINT`.
  Do not delete the label object (kept for hit-testing parity).
- Consequences: no `<text>` for point nodes; size already label-free via AD-2.

## AD-4: Fill — default black, honor explicit color
- Context: `point_gencode` sets `filled=true`, `findFillDflt(n, "black")`.
- Decision: SH_POINT forces `filled=true` with default fill black; an explicit
  `fillcolor`/`color` wins.
- Consequences: bare `point` is filled black; `point [color=red]` is red.

## AD-5: Reuse existing poly vertex / periphery / inside-clip rendering
- Context: the port already draws `point` as an ellipse (`sides≤2`) and
  `poly_inside` has the ellipse branch; only size/fill/label are wrong.
- Decision: reuse them. Verify rx=1.8 AND edge-clip-to-point against the oracle
  during execution. If a peripheries/penwidth-outline or inside-clip case
  diverges, port that branch then (touching `src/common/poly-inside.ts` is
  pre-authorized for that contingency only).
- Consequences: scope held to the three real defects; contingency bounded.

## Rollback
Reversible — revert the commit(s). In-memory layout state only; no migration.
