# DOT-1 (mission-dot-splines) re-verification corpus — 2026-06-16

Branch `feature/dot-splines`. The recommended-sequence mandated a divergence
corpus before promoting DOT-1. Harness: `.probes/dot-splines-corpus.ts` (renders
each graph via `renderSvg` and the dot 15.0.0 oracle, matches edges by `<title>`
+ occurrence, reports max control-point Δ; tol 0.5pt).

## Headline

**Pathplan is already ported and working.** `src/pathplan/` (shortest, route,
triang, visibility) is complete — the flat-label splines (FU-2) routed through
`shortestPath`/`routeSpline` and matched dot byte-exact. The gaps-doc estimate
"~1,200 LOC new pathplan port" is STALE. `splines-route.ts:245` "pathplan not
yet ported" is also stale.

## Observation: regular edge routing matches dot for most shapes
- **Context:** ran 22 varied graphs vs the oracle.
- **Finding:** byte-exact (Δ=0.00) for chain, tree, diamond, parallel-3,
  cluster, dense, wide, longspan (TB multi-rank), back-edge, self-loop,
  edge-label, fan2, fan3, narrow merges. Ports (`a:e->b:w`) within 0.33pt.
- **Impact:** the 115 goldens are representative; standard routing is correct.
- **Confidence:** High.

## Observation: steep wide-fan adjacent-rank diagonals route degenerately
- **Context:** fanout `a->{b..f}`, fan7, merge5 `{b..f}->z`.
- **Finding:** the OUTERMOST edges (steepest diagonals) collapse to ~0.4pt
  stubs near the tail (e.g. fanout `a->b` TS `M151.54,-77.12C…151.25,-76.95`
  vs dot `M149.44,-78.52C125.34,-66.8 86.08,-47.72 58.53,-34.32`). Arrowhead
  also stuck at the tail → effectively an invisible edge. Inner edges
  (near-vertical) are fine. Onset ≈ fan width ≥5 (fan2/fan3 OK, fan5/fan7 bad);
  bad count grows with fan width. Node positions + viewBox are IDENTICAL to dot
  (so this is routing, NOT positioning).
- **Impact:** wide fan-out/fan-in (very common) renders missing outer edges.
  HIGH visual impact. This is the core DOT-1 bug.
- **Confidence:** High.

## Observation: rankdir=LR diverges (spans + fans)
- **Context:** `rankdir=LR` long-span `a->d` (Δ10.6), lr-fan outer edges (PTCNT).
- **Finding:** LR long-spans are ~10pt off; LR wide-fan outer edges degenerate
  like the TB case.
- **Impact:** MEDIUM (rankdir=LR is common).
- **Confidence:** High.

## Likely mechanism / fix direction
The faithful pathplan path (`routeRegularEdgeFaithful`, edge-route-faithful.ts)
already exists but is gated to side-port / multi-rank-label edges
(`edge-route.ts:routeFaithfulSidePort`). Plain edges use the simplified fitter
(`computeSpline`/`buildRankCorridor`, edge-route-poly.ts), which degenerates on
steep adjacent-rank diagonals. Fix candidate: route the diverging cases through
the faithful pathplan path (or fix `computeSpline`), then mint goldens for the
newly-correct cases (existing 115 already match C → must stay byte-identical).

## Scope for the mission brief
1. Characterize the divergence boundary precisely (fan width onset, LR).
2. Route steep adjacent-rank diagonals + LR spans through pathplan.
3. Keep the 115 goldens byte-identical; pin the newly-fixed cases as oracles.
NOT in scope: porting pathplan (done), curved/ortho (DOT-8), flat edges (done).
