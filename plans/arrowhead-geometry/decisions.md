# Architecture Decisions

Confirmed with the user during planning (2026-06-21).

## ADR-1: Typed arrow draw-op list

**Context:** dot/odot need an `<ellipse>`; compound arrows ("crowdot") emit a
sequence of primitives. A single `Point[]` cannot represent either.
**Decision:** Replace `e.info._arrowPts: Point[]` / `_tailArrowPts` with a typed
discriminated union list:
`ArrowDrawOp = { kind:'polygon', points:Point[], filled:boolean }
            | { kind:'ellipse', center:Point, rx:number, ry:number, filled:boolean }
            | { kind:'polyline', points:Point[] }`
stored as `_headArrowOps` / `_tailArrowOps`.
**Consequences:** Faithful to `arrow_gencode`'s emit sequence; SVG emitter
switches on `kind`. Old `_arrowPts` field removed (update all readers).

## ADR-2: Geometry computed at layout time, centralized

**Context:** C computes arrows at render (`arrow_gencode`); the port computes at
layout and stores on `e.info`. tip/dir are known at layout, not easily at render.
**Decision:** Keep computation at layout. New `src/common/arrows-shapes.ts`
exposes `arrowDrawOps(type, mods, tip, dir, penwidth, arrowsize) → ArrowDrawOp[]`
and `arrowLength(comps, arrowsize, penwidth) → number`. The 4 layout sites swap
`arrowheadPolygon(...)` for the dispatch; `edge-route-clip.ts` uses `arrowLength`.
**Consequences:** Lower risk than moving to render; same math as C. One dispatch
module, no 4-way duplication.

## ADR-3: Full Arrowtypes table + modifiers + compound + arrowsize

**Context:** "The C is sacred" — partial porting of a dispatch table is awkward
and leaves latent gaps.
**Decision:** Port all 8 types (normal, crow, tee, box, diamond, dot, curve, gap),
the open (`o`/`e`) and side (`l`/`r`) modifiers, up to 4 stacked components per
end, and the `arrowsize` edge attribute. `parseArrow` (name→components, already
in `arrows.ts`) is reused.
**Consequences:** Larger port but complete; fixes the bucket and prevents future
arrow-type divergences. `inv` is `normal | ARR_MOD_INV` (already partly working).

## ADR-4: Type-aware clip length shifts non-normal-arrow coordinates

**Context:** The spline is clipped back by the arrow's length; C's length is
per-type (dot 0.8×, diamond 1.2×, tee 0.5×, etc.). The port currently clips at a
fixed `ARROW_LENGTH=10` (normal only), so non-normal-arrow endpoints are wrong.
**Decision:** Clip using `arrowLength` per type/compound. This moves spline
endpoints for edges with non-normal arrows.
**Consequences:** Those edges are all currently *diverged* (correct length never
applied) → only-improvement expected. **Risk:** a currently byte-matching case
that uses a non-normal arrow and coincidentally matched at length 10 would
regress — guarded by the per-id 0-regression gate (ADR-6); STOP and investigate
if seen.

## ADR-5: One golden per arrow-type group

**Decision:** Add one byte-matching golden per type group: dot/odot (ellipse),
crow/vee (9-pt), box, diamond, tee, curve, a compound (e.g. `crowdot`/`onormalodot`),
and a side-modifier sample. Use a corpus case where it byte-matches, else a
synthetic with `fixedsize` to pin geometry. Normal/inv are already covered.
**Consequences:** Curated golden suite guards the new geometry; the corpus survey
remains the broad report.

## ADR-6: Parity regeneration is the success metric

**Decision:** Batch 3 re-runs `survey.ts` + `dashboard.ts`; the committed
`parity.json`/`PARITY.md` byte-match delta with **0 per-id regressions** (judged
by per-id verdict deltas, not aggregate counts) is the measured outcome.
**Consequences:** Deterministic, oracle-grounded success criterion.

## Rollback classification

**Reversible.** Every task is a localized code change + golden; `git revert` per
commit. No data/schema/migration. Sole regression vector: the type-aware clip
length (ADR-4), guarded by ADR-6.
