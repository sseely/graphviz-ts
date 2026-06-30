# Architecture Decisions — steering-port routing

Pre-made decisions. Treat as LOCKED during execution; a conflicting
constraint discovered mid-task is a STOP + journal entry, not a silent
override. SR1 (recon spike) may refine AD1/AD2 with evidence — if so, record
the change here and in the journal before proceeding.

## AD1 — Integration seam: `routeOneEdge` (REVISED by SR1)

**SR1 finding:** `makeRegularEdge` (splines-route.ts) has ZERO callers — it
is dead code. The only live router is `dotSplines_ → routeDotEdges →
routeOneEdge`. So:

Integrate at **`routeOneEdge`** (src/layout/dot/edge-route.ts): when an edge
has an active side-mask port, route via the faithful pipeline (build
`endp.nb` → `beginPath`/`endPath` → assemble `P.boxes` → `routeSplines` →
`clipAndInstall`) instead of `straightEdgeSplineWithRank`. Extend T6a's
`portRouteOf` to detect `.side` as the gate. Do NOT revive `makeRegularEdge`
(parallel dead path); consider deleting it in cleanup once the faithful path
lands.
- Rationale: routeOneEdge is the live seam and already carries the T6a port
  plumbing; reviving dead code would add a second path to maintain.
- Original AD1 (finish makeRegularEdge) is superseded — see SR1-findings.md.
- NOTE (SR1): `beginPath`/`endPath`/`routeSplines` have NO existing callers
  anywhere; this mission first-assembles that sequence. Treat the assembly
  (C `make_regular_edge` glue) as real work, not plumbing.

## AD2 — Staged rollout: ported-with-side edges first, gated

Route an edge through the faithful path ONLY when it has an active side-mask
port (`tail_port.side || head_port.side`). All other edges keep the current
router. This contains blast radius: the 115 existing goldens (no side ports)
are untouched and must stay conformant through batches 1–3.
- The gate is the same `portRouteOf`-style predicate T6a uses, extended to
  read `.side`.
- AD3 revisits whether to widen the gate to all edges.

## AD3 — Golden strategy: byte-stability until an explicit, separate switch

- Batches 1–3: NO existing ref changes. No-port goldens conformant
  (hard gate). New steering-port goldens are APPENDED (AD-C1), 0.5pt class.
- Batch 4 / SR9: routing *all* dot regular edges through the faithful path
  is a SEPARATE, explicitly-gated decision. The faithful fitter will not be
  conformant to the simplified one; any ref re-mint requires oracle proof
  the new output matches dot 15.0.0 better (or equal within tolerance) AND
  Scott's go-ahead. Default outcome if unproven: keep the hybrid (faithful
  for ported, simplified for the rest).

## AD4 — Edge-class scope order

Batch 2 targets **regular adjacent-rank** edges (the T6b demo cases:
`A:n->B`, `A:e->B`, `A:w->B`, contradictory compass, record-field side
ports). Flat edges (FLATEDGE: same-rank), self-edges, and multi-rank
virtual-chain edges are batch 3, each independently gated and independently
golden-validated; any that the faithful path doesn't yet cover is journaled +
comparison-paged, not forced.

## AD5 — pathplan is a black box

`Proutespline`/`Pshortestpath` (`src/pathplan/`) are treated as a correct,
frozen dependency. This mission does not modify them. A divergence that
traces into their numerics is a STOP (FMA/libm precedent, `src/common/
fma.ts`), not an edit target. If `routeSplines` needs a behavior pathplan
doesn't provide, that is a separate mission.

## Carried (AD-C1)

Goldens are append-only. Never modify an existing ref, manifest entry, or
tolerance. New refs come only from the installed dot 15.0.0 binary. Bump the
suite count test; keep it an explicit hardcoded count (Scott's standing
preference).
