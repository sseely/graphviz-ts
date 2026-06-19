# Architecture decisions — DOT-8 finish (curved + compound)

## ADR-1 — `makeStraightEdges` in a new `src/layout/dot/straight-edges.ts`
- **Context:** `makeStraightEdges` (routespl.c:975) + helpers `bend`,
  `get_cycle_centroid` are a cohesive routespl unit, unported.
- **Decision:** port them into a new `src/layout/dot/straight-edges.ts`, mirroring
  the C function boundary; reuse the existing `clipAndInstall`.
- **Consequence:** clean module matching the C source; no churn to existing
  edge-route files beyond the dispatch call.

## ADR-2 — Compound: verify-then-fix (golden-driven)
- **Context:** `dotCompoundEdges` is wired (`dot/index.ts:128`) and `compound.c`
  is ported (T38); `EDGETYPE_COMPOUND` routes as a normal spline.
- **Decision:** add native-C goldens for `splines=compound` and
  `compound=true`+`lhead`/`ltail`; fix `compound*.ts` **only** if a golden
  diverges. Do not pre-emptively re-port.
- **Consequence:** mission stays focused on curved (the real gap); compound risk
  is bounded by the golden check.

## ADR-3 — Curved labels: warn and proceed (NOT downgrade)
- **Context:** `dotsplines.c:241-246` — for curved, C warns *"edge labels with
  splines=curved not supported in dot - use xlabels"* but **continues routing**
  (unlike ortho, which downgrades `useLbls=false` and skips). Labels are still
  positioned by the normal label pass.
- **Decision:** emit the warning when curved + edge labels; otherwise route
  curved normally. Do not skip/branch routing on label presence.
- **Consequence:** faithful to native dot; no special curved-label path.

## ADR-4 — Oracle = native-C goldens; reversible; scoped
- **Decision:** validate `renderSvg` output vs native `dot -Tsvg` (gvmine) for
  curved/compound fixtures. The new dispatch fires only for `EDGETYPE_CURVED`
  (and compound is already attr-gated); any existing non-curved/non-compound
  golden change is a **STOP**.
- **Consequence:** **Reversible** — revert the dispatch + new file. No data/schema
  change. Existing rendered output untouched.

## ADR-5 — Mirror the dispatch position + `makeStraightEdges` exactly
- **Decision:** dispatch `EDGETYPE_CURVED`→`makeStraightEdges` inside the
  edge-group routing loop at the point matching `dotsplines.c:381-387`; add the
  `resetRW`+warning at the `dot_splines_` top (`:241-247`) and the curved finish
  guard (`:461-465`, skip `routesplinesterm`). Preserve the perp-spread math and
  `bend`/`get_cycle_centroid` verbatim.
- **Consequence:** byte-faithful curved geometry.

## Rollback
**Fully reversible.** New `straight-edges.ts` + dispatch branch + new goldens;
revert the commits. No migration, no API/schema/output change for other splines
values.
