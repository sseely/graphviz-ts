<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions (pre-made) + operational readiness

## ADR-1: Oracle = instrumented C `dot_splines_` edge dispatch order
- **Context:** Need C's exact per-edge `edgecmp` ordering and which order-sensitive
  shared state each edge reads (`recover_slack` vnode moves; `top_bound`/`bot_bound`
  neighbor-spline visibility).
- **Decision:** `GV_DUMP_MRE`-gated dumps in `~/git/graphviz/lib/dotgen/dotsplines.c`
  (dispatch order at the make_regular_edge/make_flat_edge call site; recover_slack
  moves). Rebuild `gvplugin_dot_layout`; render `GVBINDIR=/tmp/ghl dot -Tsvg`.
- **Consequences:** Authoritative order ground truth; no port change in B0.

## ADR-2: No feature flag — faithful port, 0-regression survey is the safety net
- **Context:** A toggle eases rollback but CLAUDE.md forbids config the C lacks.
- **Decision:** No `GV_*` toggle; rely on headless-oracle survey (0-regression) +
  golden pins; commit incrementally so a regression is bisectable.
- **Consequences:** Faithful; rollback = revert commit; demands green survey each step.

## ADR-3: Unify into ONE `edgecmp`-ordered pass routing both lone and group edges
- **Context:** `dotSplines_` routes only multi-edge groups + flats (its
  `routeEdgeGroup` loop; `dispatchEdgeGroup` early-returns lone edges), then
  `routeDotEdges` routes lone edges in a second pass. C routes both in one
  `edgecmp` loop.
- **Decision:** **Option A** — route each `edgecmp` group in order: `cnt>1` →
  `routeParallelEdgeGroup`, `cnt==1` → the lone dispatch (`routeOneEdge`), and
  eliminate the separate `routeDotEdges` pass. Exact mechanism refined by B0.
- **Consequences:** Lone edges see C's exact neighbor/vnode state; shared-router
  churn expected. `routeOneEdge` must be callable mid-loop with identical results
  for non-interacting graphs.

## ADR-4: Headless-oracle goldens; re-evaluate `ldbxtried` post-fix
- **Context:** `n0->n1` conforms to C once order is correct (proven with
  recoverSlack disabled), but `n0->n2` keeps a ~1px Proutespline residual.
- **Decision:** Refs via `GVBINDIR=/tmp/ghl dot -Tsvg`; flip the `ldbxtried`
  golden to its true post-fix verdict (byte / structural / knownResidual per the
  actual result); add a minimal repro (lone edge sharing a vnode with a
  later-`edgecmp` group). Keep `parallel-multirank-min`.
- **Consequences:** Honest golden state; TDD red→green.

## ADR-5: Investigation gates the fix; STOP if it exceeds the dispatch layer
- **Context:** Unifying touches the shared router; order-sensitivity spans
  recover_slack AND top/bot_bound.
- **Decision:** Batch 1 is blocked until Batch 0 pins C's order, confirms the
  port's `edgecmp` reproduces it, AND confirms the change is contained to
  `splines.ts`/`edge-route.ts` dispatch (with at most a trivial `edge-order.ts`
  alignment as T1.3). If it needs comparator-semantics changes or reaches into
  `routeRegularEdgeFaithful`/`recoverSlack` → STOP and re-plan.
- **Consequences:** Bounded change; evidence-driven scope.

## Operational readiness (layout-library context)

- **Observability:** N/A — no runtime SLIs. Success metric = corpus survey verdict
  counts + golden suite + perf bench (`test/corpus/bench.mjs`).
- **Rollback:** **Reversible** — pure layout/render logic; revert the commit, no
  migration.
- **Scalability/perf:** The change reorders routing; it does not add per-edge work.
  Guard: `test/corpus/bench.mjs` — no previously-passing input > 2× native
  (a stop condition).
- **On-call:** N/A.
- **Backwards compatibility:** SVG edge `@d` output changes for affected graphs —
  intended. No public API/signature change. Golden refs + `parity*.json` +
  `PARITY.md` are regenerated artifacts updated in Batch 2.

## Rollback classification
**Reversible** — revert the commit(s) to restore prior behavior. No data migration.

## Project rule
A batch with any quarantined/excluded case is not "complete" until its comparison
page exists under `comparisons/` and is referenced in `decision-journal.md`.
