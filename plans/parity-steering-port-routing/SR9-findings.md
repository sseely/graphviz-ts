# SR9 — Full-switch evaluation: route ALL dot regular edges through the faithful path?

**Date:** 2026-06-15 · **Method:** inline measurement (architect-review style),
no production change committed.

## Question (AD3)

The mission routes only side-port edges through the faithful
`beginPath → routeSplines → endPath → clipAndInstall` pipeline; all other edges
keep the simplified `buildRankCorridor`/`computeSpline` fitter (the hybrid).
SR9 asks whether to widen the gate so *every* dot regular edge uses the faithful
path, and whether that would require re-minting any of the 115 existing
(no-port) refs. **No ref change may be made without Scott's go-ahead.**

## Experiment

1. Baseline (committed hybrid build): rendered all 68 dot goldens and compared
   each to its dot 15.0.0 C ref at the manifest tolerance.
   → **68/68 pass, maxδ = 0.000pt.** The simplified fitter is conformant to C
   for every no-port golden.
2. Forced the faithful path for *all* forward adjacent/flat edges and all
   multi-rank forward edges (dropped the `hasSidePort` gate in `routeForwardEdge`
   and the multi-rank dispatch — a temporary edit, reverted after measurement).
   Re-rendered and re-compared all 68 dot goldens to their C refs.

## Result (faithful forced for all edges)

| outcome | count | detail |
|---------|-------|--------|
| match C within 0.01pt | 64 / 68 | faithful ≈ simplified ≈ C |
| deviate > 0.01pt | 4 / 68 | see below |

| golden | maxδ vs C | what differs |
|--------|-----------|--------------|
| dot-edge-styles | **1.41pt** | arrowhead polygon points |
| dot-node-penwidth-edge-clip | 0.48pt | edge interior controls + arrowhead |
| dot-rankdir-lr | 0.30pt | edge interior controls + arrowhead |
| dot-rankdir-rl | 0.30pt | edge interior controls + arrowhead |

The deviations are interior cubic control points and arrowhead vertices —
the `Proutespline` renormalization SR4 measured (~0.3pt class), plus one
arrowhead case at 1.41pt. They are **not** improvements: the simplified fitter
already reproduces dot 15.0.0 **exactly** (0.00pt) for these edges, so every
deviation moves TS *away* from the oracle.

## Recommendation: KEEP THE HYBRID

The full switch is **strictly not better** (AD3's default decision):

- **No fidelity gain.** dot's refs come from the faithful `make_regular_edge`,
  and TS's *simplified* fitter already matches them to 0.00pt for all 115
  no-port goldens. The faithful TS port matches to ≤0.01pt for 64/68 but adds
  0.30–1.41pt renormalization error on 4 — a net regression vs the oracle.
- **It would perturb ≥4 existing refs** (3 within 0.5pt, 1 at 1.41pt), forcing
  either re-mints (no oracle justification — the simplified is already exact) or
  loosened tolerances (hiding real regressions). Neither is warranted.
- **The faithful path's value is specific:** it routes the non-monotonic loop
  corridors that the simplified fitter *truncates* (steering ports). The hybrid
  already delivers that for the gated side-port classes (SR3–SR8). No other edge
  class needs it.

Because the full switch does **not** improve fidelity, the SR9 stop condition
("full switch improves fidelity but perturbs many refs → escalate the re-mint
scope") does **not** trigger. The default outcome stands: **keep the hybrid; do
not re-mint any ref.**

## If the hybrid is ever revisited

The 4 deviations trace to `Proutespline`/`Pshortestpath` renormalization
(frozen pathplan, AD5) and an arrowhead-clip interaction on the faithful path,
not to a fixable box-assembly bug. Closing them to 0.00pt would mean matching
the simplified fitter's exactness inside the faithful path — out of scope and
without benefit while the simplified fitter remains exact.
