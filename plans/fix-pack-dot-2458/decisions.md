# Architecture Decisions — fix-pack-dot-2458

All approved by the user during planning (2026-06-27).

## ADR-1: Faithful `doDot` port, split across two files

**Status:** Accepted

**Context:** `index.ts` is near the 500-line cap; `doDot` + `initSubg` +
`copyClusterInfo`/`copyCluster`/`mapClust` is substantial.

**Decision:** Thin `doDot` wrapper in `index.ts`; the component-layout loop,
`initSubg`, cluster-carry, and cluster copy-back live in new
`src/layout/dot/pack-components.ts`.

**Consequences:** Both files stay under the complexity caps and mirror C's function
boundaries (CLAUDE.md: C is the spec).

## ADR-2: Seed component drawing-info via an `initSubg` port (verify need in T1)

**Status:** Accepted

**Context:** `buildSubgraph` (shared pack module — don't touch) makes a fresh-`info`
subgraph; `dotLayoutPipeline(sg)` reads `sg.info.{nodesep,ranksep,rankdir,flags,
has_labels,…}`.

**Decision:** Port `initSubg` to seed each component's drawing-info from root. If T1
proves `dotPhaseInit(sg)` already re-derives these from the inherited attr chain,
`initSubg` becomes a no-op and is dropped.

**Consequences:** Defensive correctness; T1 evidence decides whether it stays.

## ADR-3: Cluster-carrying component builder is dot-local; never touch the pack module

**Status:** Accepted

**Context:** `copyClusterInfo`/`mapClust` need each component subgraph to carry its
cluster subgraphs; `buildSubgraph` copies only nodes+edges. `pack/index.ts` and
twopi depend on the current `ccomps` behaviour.

**Decision:** Add a dot-local step (in `pack-components.ts`) that augments `ccomps`
output with each component's cluster subgraphs, so `dotLayoutPipeline` builds
`GD_clust` and `copyClusterInfo` maps back to root. Do **not** modify
`src/layout/pack/**` or `src/layout/twopi/**`.

**Consequences:** The shared pack module stays intact for twopi; cluster support is
isolated to the dot pipeline.

## ADR-4: `ratio_kind==R_NONE` guard + `doSplines=true`; root does not re-rank

**Status:** Accepted

**Context:** C `doDot` packs only when `ratio_kind==R_NONE`, sets
`pinfo.doSplines=true`, and lays out each component fully (incl. splines) before
packing; the root is never re-ranked.

**Decision:** Port the guard exactly — pack only when no `ratio`; else fall back to
whole-graph `dotLayoutPipeline(g)`. Set `pinfo.doSplines=true`; the root bbox comes
from `packSubgraphs`, not a re-run.

**Consequences:** Faithful to C; non-pack and ratio paths are unchanged.

## ADR-5: Oracle = headless 15.1.0; bar = structural-match; hard gate = 0 regressions

**Status:** Accepted

**Context:** Same methodology proven in fix-concentrate-2559. `parity.json` is the
Estimate-measurer + headless-15.1.0 baseline (NOT LUT/pango — memory
`parity-json-recipe-estimate-ghl`).

**Decision:** Generate refs and run all survey verification against the headless
**15.1.0** oracle (`GVBINDIR=/tmp/ghl`, `npm run survey:setup`) with a fresh cache.
Per-test bar: 2458 `diverged → structural-match`. Hard gate: `rules-gate.ts`
regressions=0. Refresh `parity.json`/`PARITY.md` via `cp parity-rules.json
parity.json` + `dashboard.ts`. Pursue conformant only if free.

**Consequences:** Realistic, regression-safe; consistent with the prior mission.

## Operational readiness

N/A — layout-internal pure function. No SLIs/alerts/traces, no API/schema/
backwards-compat surface. **Reversible** (revert the deploy; no migration).
