<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

Re-scoped mission (edgecmp-grouping). The prior mission's ADRs (instrument-first,
etc.) are satisfied — diagnosis is done. These govern the fix.

## AD-1 — C-oracle instrumentation via the gvplugin harness (if needed)
- **Context.** Batch 1 is design; if it needs to confirm C's collect/grouping
  order for the 6 edges, capture ground truth.
- **Decision.** Reuse the `/tmp/ghl` + rebuilt `dot_layout` plugin harness
  (instrument `lib/dotgen/dotsplines.c` collect/group loop); revert + rebuild
  pristine after. **Harness note:** survey npm scripts call a bare `tsx`; when
  `node_modules/.bin/tsx` is absent, use `TSX=$(ls ~/.npm/_npx/*/node_modules/.bin/tsx | head -1)`
  and run `TSX_BIN="$TSX" GVBINDIR=/tmp/ghl ... "$TSX" ...`.
- **Consequences.** Reproducible; C tree stays clean.

## AD-2 — Faithful collect + route through the existing group dispatch
- **Context.** C's `dot_splines_` collects from the rank array incl. virtual
  `splineMerge` nodes (`dotsplines.c:281-299`), sorts with `edgecmp`, groups by
  `getmainedge`, and routes each group once (`:328-383`). The port has the sort,
  `getMainEdge`, `groupSize`, and `routeEdgeGroup` — only the collect misses
  virtual nodes.
- **Decision.** Fix the **collect** to mirror C (include virtual `splineMerge`
  nodes, honoring the `ND_out`/`ND_other`/`ND_flat_out` structure), and route the
  new edges through the **existing** `edgecmp`+`getMainEdge`+`routeEdgeGroup`
  path. Add a `getMainEdge`/`to_virt` fix ONLY if grouping fails to coalesce a
  secondary edge with its main.
- **Consequences.** Each original routes once — the 6 edges return and the
  doubled-bezier trap is avoided structurally.

## AD-3 — NO bespoke secondary router, NO boolean guard
- **Context.** The prior attempt added `routeConcentrateSecondaryChain` alongside
  the dispatch → doubled beziers; two boolean guards (`out.size>1`;
  `node_type!==NORMAL && splineMerge`) failed at the same 41 edges.
- **Decision.** Do not reintroduce a side router or a boolean dispatch guard.
  Coalescence must happen via `getMainEdge` grouping (C's model), not a filter.
- **Consequences.** Faithful to C; avoids the known dead-end.

## AD-4 — Done = conformant AND maxDelta ≤ HEAD, gated vs committed HEAD
- **Context.** Edge count alone is a false signal — the prior fix hit 153 edges
  but maxDelta 432. The on-disk `parity.json` can be pre-contaminated.
- **Decision.** `graphs-b15` must reach `conformant` (153 edges, 6 named present)
  AND compareSvg maxDelta must not rise vs HEAD. `rules-gate` must show 0
  regressions **against `git show HEAD:test/corpus/parity.json`**. Refresh the
  baseline only after a clean gate.
- **Consequences.** The doubled-bezier regression cannot pass as success.

## AD-5 — Reversible
- Revert the commit(s) + restore the baseline. No data/schema/API change. The
  collect change is gated by the `splineMerge` predicate, so non-concentrate
  graphs' edge sets are structurally unaffected (verified by the gate).
