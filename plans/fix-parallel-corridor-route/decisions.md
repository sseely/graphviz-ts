<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions (pre-made) + operational readiness

## ADR-1: Oracle = instrumented C `make_regular_edge` rebuilt to `/tmp/gvplugins`
- **Context:** Pinning needs C's box list, per-edge offset ports, Pshortestpath
  polyline, and final bezier point counts for `ldbxtried` `n0->n2` (×3).
- **Decision:** Add dumps to `lib/dotgen/dotsplines.c:make_regular_edge`; rebuild
  `gvplugin_dot_layout` → `/tmp/gvplugins`; run via
  `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot`. Recipe:
  `[[recover-slack-and-c-harness]]`.
- **Consequences:** Authoritative ground truth; one C-build; no port change in B0.

## ADR-2: No feature flag — faithful port, 0-regression survey is the safety net
- **Context:** A toggle eases rollback but CLAUDE.md forbids config the C lacks.
- **Decision:** No `GV_*` toggle; rely on headless-oracle survey (0-regression) +
  golden pins; commit incrementally so a regression is bisectable.
- **Consequences:** Faithful; rollback = revert commit; demands green survey each step.

## ADR-3: Per-edge corridor routing with offset ports, replacing base+x-shift
- **Context:** `routeParallelEdgeGroup` routes ONE base then x-shifts; C routes
  each edge through its own boxes/corridor from per-edge offset endpoints
  (`dotsplines.c:1880+`). The base is routed from un-offset centers, so it clips
  corners and under-segments (see [[opposing-edge-spline-divergence]]).
- **Decision:** Route each parallel/opposing cross-rank edge through the pathplan
  corridor from its OWN offset ports, then install — exact shape confirmed by B0.
- **Consequences:** Fixes under-segmentation + endpoint mis-placement; shared
  router → broad survey churn expected.

## ADR-4: Headless-oracle goldens for `ldbxtried` + a minimal repro
- **Context:** Goldens must match the production estimate/headless path
  ([[textmeasure-cutover-done]]).
- **Decision:** Refs via `GVBINDIR=/tmp/ghl dot -Tsvg`; pin `ldbxtried` and a
  synthetic minimal repro (parallel edges from inside a cluster to an outside node).
- **Consequences:** TDD red→green; deterministic-tolerance guard.

## ADR-5: Investigation gates the fix; STOP if it exceeds a `make_regular_edge` port
- **Context:** Multiple possible sub-bugs (cross-rank under-segmentation;
  sub-pixel endpoint-port offset) + shared/high-risk router.
- **Decision:** Batch 1 is blocked until Batch 0 pins `ldbxtried` + repro to
  structural/sub-pixel AND confirms the fix is contained to
  dispatch/route/box/straight-edges files. If it needs `src/pathplan/` changes →
  STOP and re-plan.
- **Consequences:** Bounded dig; evidence-driven fix scope.

## Operational readiness (layout-library context)

- **Observability:** N/A — no runtime SLIs. The success metric is the corpus
  survey verdict counts + golden suite + perf bench (`test/corpus/bench.mjs`).
- **Rollback:** **Reversible** — pure layout/render logic; revert the commit, no
  migration.
- **Scalability/perf:** Corridor routing makes more `pathplan` calls per parallel
  edge. Watch `test/corpus/bench.mjs` / `PERF.md`; stop on > 2× native on a
  previously-passing input (a brief stop condition).
- **Backwards compatibility:** SVG edge `@d` output changes for affected graphs —
  intended. No public API/signature change. Golden refs + `parity*.json` +
  `PARITY.md` are regenerated artifacts updated in Batch 2.

## Rollback classification
**Reversible** — revert the commit(s) to restore prior behavior. No data migration.

## Project rule
A batch with any quarantined/excluded case is not "complete" until its comparison
page exists under `comparisons/` and is referenced in `decision-journal.md`.
