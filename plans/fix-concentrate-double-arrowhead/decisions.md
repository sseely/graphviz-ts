<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions (pre-made)

## ADR-1: Port C's `arrow_flags` conc_opp_flag branch verbatim
- **Context:** `arrowFlags` (src/common/splines-clip.ts:73) computes `[sflag, eflag]`
  but skips the `ED_conc_opp_flag` branch (the existing comment admits it).
- **Decision:** After the dir/arrowhead/arrowtail resolution, if
  `e.info.conc_opp_flag`, find the opposing edge `f = edge(head→tail)`, compute
  `arrowFlags(f)` → `[s0, e0]`, then `eflag |= s0; sflag |= e0`. Mirrors
  lib/common/arrows.c:`arrow_flags`.
- **Consequences:** Merged 2-cycle edges get both arrowheads; the existing
  `arrowStartClip` path then clips the spline at the new tail end (fixes `@d`
  too). No behavior change when `conc_opp_flag` is unset (only concentrate=true
  opposing pairs set it), so blast radius is confined to concentrate inputs.

## ADR-2: Opposing-edge lookup via the original cgraph, first match
- **Context:** C uses `agfindedge(agraphof(aghead(e)), aghead(e), agtail(e))` —
  the **original** edge B→A (still present, marked IGNORED), not a fast/virtual edge.
- **Decision:** `e.head.outEdges(e.head.root).find(x => x.head === e.tail)`.
  `outEdges` is sorted (head.id, seq); take the first match, matching agfindedge.
  Guard: if none found, leave flags unchanged (defensive — C assumes f exists,
  but the IGNORED edge is guaranteed present only for true opposing pairs).
- **Consequences:** Reuses existing model API; no new edge index. Recursion
  terminates (f has no `conc_opp_flag`).

## ADR-3: ARR flag OR is faithful at the ported flag domain
- **Context:** Port only models `normal`/`none` arrows → `ARR_NORM=1`, `ARR_NONE=0`.
- **Decision:** Use bitwise `|=` exactly as C. With the 0/1 domain this is
  equivalent to logical-or and stays faithful if richer arrow types are added later.

## ADR-4: Golden pinned to the HEADLESS oracle, not pango
- **Context:** The golden suite's refs are baselined against the headless oracle
  (estimate text path) — see [[textmeasure-cutover-done]] and
  `test/corpus/gen-headless-gvbindir.sh`.
- **Decision:** Generate the new `b135` (and `167`) reference SVG with
  `GVBINDIR=/tmp/ghl <build>/cmd/dot/dot -Tsvg`, NOT a pango-linked `dot`.

## Rollback classification
**Reversible** — pure layout/render logic, no data-model or schema change. Revert
the commit to restore prior behavior. No migration.
