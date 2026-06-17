# Architecture Decisions — dot-splines (DOT-1)

## AD-1: Full retirement of the simplified fitter, measure-first

**Context:** Regular edges default to the simplified fitter
(`computeSpline`/`buildRankCorridor`/`straightEdgeSplineWithRank`), a
non-faithful shortcut. It matches dot on the 115 goldens but diverges on
edge-condition geometries (wide fan-out/in outer edges collapse; LR spans
drift). The faithful path (`make_regular_edge` + pathplan `routesplines`) is the
C algorithm and is already ported.
**Decision:** Migrate every regular-edge category to the faithful path and delete
the fitter. Goldens are C-generated truth, so a correct faithful port reproduces
them byte-for-byte — measure first (Batch 1), then migrate category-by-category,
fixing each golden shift as a faithful-path bug.
**Consequences:** Higher correctness incl. untested edge-cases. Larger,
multi-batch. The 115 goldens are the hard gate; never regenerate them to match TS.

## AD-2: Faithful path is the existing `routeRegularEdgeFaithful` /
`routeMultiRankEdgeFaithful`, extended — not a rewrite

**Context:** The faithful box-channel pipeline already exists for side-port and
labeled edges (`edge-route-faithful.ts`, `edge-route-chain.ts`).
**Decision:** Reuse and extend it to cover plain edges of each category, rather
than writing a new `make_regular_edge`. Widen the dispatch gates in
`edge-route.ts` (`routeForwardEdge`, `routeOneEdge`) category by category.
**Consequences:** Smaller diffs per task; the faithful primitives are battle-
tested (flat labels matched dot byte-exact via the same pathplan).

## AD-3: Goldens byte-identical is the invariant; new cases pinned as oracles

**Context:** dot-edge-multi / dot-flat-labels established the oracle-pin pattern.
**Decision:** After each migration, the 115 goldens must stay byte-identical; the
newly-fixed cases (wide fan-out, fan-in/merge, LR span) are pinned as dot-oracle
tests at tol 0.5. Un-reachable parity → quarantine with a comparison page.
**Consequences:** No silent divergence; regressions caught immediately.

## AD-4: Delete the fitter only after all categories migrate (Batch 6)

**Context:** The fitter is called from many sites (adjacent, chains, back,
non-forward, `splines-route.ts`).
**Decision:** Keep the fitter live until Batches 2–5 migrate every caller, then
remove `computeSpline`/`computeSplineMulti`/`buildRankCorridor`/
`straightEdgeSplineWithRank` + dead helpers in one final task.
**Consequences:** Each intermediate batch stays green; the final delete is a pure
dead-code removal verified by the full gate.
