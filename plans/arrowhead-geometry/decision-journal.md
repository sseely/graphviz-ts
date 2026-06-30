# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | scope = full Arrowtypes table (8 types + modifiers + compound + arrowsize); fix 16 deep arrowhead-geometry cases | user choice "port the full arrow-type table" |
| 2026-06-21 | planning | geometry at layout time, centralized in arrows-shapes.ts (ADR-2); typed draw-op list (ADR-1); type-aware clip length (ADR-4) | confirmed in Phase 3 |
| 2026-06-21 | planning | baseline parity (post low-hanging-fruit, dot 15.1.0): conformant 245, structural 219, diverged 295, errored 13, timeout 9, oracle-error 15 | pre-flight reference for the Batch 3 regression diff |
| 2026-06-21 | execution | created branch feature/arrowhead-geometry; oracle smoke-tested (dot→`<ellipse>`); executing all 3 batches directly (single-writer sequential chains, no parallelism benefit; faithful C port needs deep cross-ref) rather than per-task subagents | parallelism.md: default single-agent unless a bottleneck is demonstrated; batch 1/2/3 are sequential |
| 2026-06-21 | T1 | ResolvedArrow.type holds typeCode possibly OR'd with ARR_MOD_INV (no separate inv field — fixed by spec); open/left/right are booleans from the parsed component | spec fixes ResolvedArrow shape; INV is intrinsic to the name (inv/vee/icurve), not a user prefix mod |
| 2026-06-21 | T2 | componentU omits C's EPSILON nudge (C adds it only to guard a near-zero raw shaft vector; here `dir` is a unit direction so EPSILON perturbs the result — gave dot radius 3.9996 not 4) | oracle dot rx=ry=4 exactly; EPSILON guard re-added for the degenerate zero-length case |
| 2026-06-21 | T3 | split geometry into arrows-shapes-util.ts (primitives) + arrows-shapes-poly.ts (crow/tee/gap/curve) beyond the declared arrows-shapes.ts write-set | sanctioned by the T3 boundary ("split per-type helpers into a sibling file"); file/CCN bar forces it; acyclic (both import util) |
| 2026-06-21 | T3 | added a 4th ArrowDrawOp variant `bezier` to arrows-types.ts (T1's file) for faithful curve/icurve rendering | ADR-3 ports the full 8-type table incl. curve, which emits gvrender_beziercurve; non-breaking union addition (architecture.md: new variant a client can ignore); no parallel writer conflict in solo execution |
| 2026-06-21 | T3 | preserved the C `arrow_length_tee` bug verbatim (the second `if` tests `_at_start` not `_at_end`) | CLAUDE.md "the C is sacred"; documented inline |
| 2026-06-21 | T4 | brief mis-located the elen source: it is `normalArrowLen` in edge-route-routing.ts, called from chain.ts/compound.ts (T5's write-set), not edge-route-clip.ts. T4 adds the `arrowClipLength` helper to edge-route-clip.ts (+ tests); the call-site wiring + ADR-4 golden check moves to T5, which already owns those sites and reads the arrow attrs there | autonomous protocol PUSH-FORWARD (task simpler/mis-scoped than estimated); keeps T4 within its write-set, avoids touching T5's files |
| 2026-06-21 | T4 | VERIFIED: faithful arrowLengthNormal(1,1)=11.51354 == existing normalArrowLen(1)=11.51354 (my earlier hand-calc of 11.5176 was wrong). Swapping normal's clip source is a numeric no-op → ADR-4 normal-regression risk is essentially nil | T5 still runs the golden suite as the guard, but normal is expected to be conformant |
| 2026-06-21 | T5+T6 | MERGED into one wire-in commit. AC4 (no `_arrowPts` refs remain) forces the readers (svg.ts, svg-helpers.ts) to change in T5, which requires the per-kind emitter (T6's deliverable) to exist — a T5-only commit would leave a red intermediate. Merging avoids committing WIP | autonomous commit discipline: don't commit broken; per-task split was based on a clean field-rename that the multi-reader reality doesn't support |
| 2026-06-21 | T5+T6 | write-set expanded beyond the brief: also touched splines-clip.ts + postproc.ts (producers/rotation), svg.ts (multicolor reader), and added svg-arrow-ops.ts (emitter; svg-helpers.ts at 494 lines, +emitter would exceed the 500 cap). None were in another task's write-set | full field-rename migration is mechanical necessity, not a design change; solo execution → no parallel-write conflict |
| 2026-06-21 | T5+T6 | per-end clip wiring: head clip uses arrowhead length, tail clip uses arrowtail length (was one normalArrowLen for both) at all sites incl. arrowOrthoClip (matters for 144_ortho target) | faithful per-type clip (ADR-4); preserved each site's existing penwidth source (attr for clip, render for geometry) |
| 2026-06-21 | T5+T6 | VERIFIED conformant vs native oracle for dot/odot/crow/vee/diamond/box; full suite 2233 green incl. golden suite (0 normal regression) | end-to-end confirmation the G1/G2 targets are solved before the T8 corpus survey |
| 2026-06-21 | T8 | parity regen (dot 15.1.0): conformant 245→249 (+4), structural 219→222 (+3), diverged 295→288 (−7); **0 per-id regressions** (HARD GATE passed) | ADR-6 success metric met |
| 2026-06-21 | T8 | deferred audit: 4/16 targets verdict-improved (1408+2490→byte, 144_no_ortho+144_ortho→structural). The other 12 stayed `diverged` but their first-diff moved off the arrow primitive onto **edge spline `path/@d`** (graphs-arrows arrow-primitive counts now match the oracle EXACTLY: 43 ellipse / 28 polygon / 6 polyline). Arrow geometry is correct everywhere; residual = spline-routing / circo·twopi engine layout | re-bucketing (per the bucket-fix memory); arrowhead-geometry gap closed; 16 comparison pages updated with the new first-diff + reason |

## Mission summary (2026-06-21)

**Status: COMPLETE.** The full graphviz `arrows.c` geometry is faithfully ported.

- **Tasks:** 8 planned, 8 done (T5+T6 merged into one wire-in commit — see journal).
- **Scope delivered:** all 8 Arrowtypes (normal/crow/tee/box/diamond/dot/curve/gap)
  + open/INV/side modifiers + compound stacking (≤4) + arrowsize + per-type clip
  length. New modules: `arrows-types.ts`, `arrows-shapes.ts`, `arrows-shapes-util.ts`,
  `arrows-shapes-poly.ts`, `svg-arrow-ops.ts`. `_arrowPts`→`headArrowOps`/`tailArrowOps`
  (typed `ArrowDrawOp[]`, +`bezier` variant for curve).
- **Parity:** conformant 245→**249**, structural 219→**222**, diverged 295→**288**;
  **0 regressions**. 8 corpus improvements; G1 (dot/odot `<ellipse>`) + G2 (crow/vee
  9-pt) symptoms fixed, conformant in isolation + via 8 new goldens (manifest 146→154).
- **Quality gates:** typecheck 0, test **2241** green (incl. golden suite, 0 normal
  regression), build 0.
- **Residual (out of scope):** 12 target *cases* still diverge on edge spline
  routing / circo·twopi engine layout (NOT arrow geometry) — documented in each
  comparison page; tracked under spline-routing / engine buckets.
- **Decisions flagged for review:** T5+T6 merge + write-set expansion (splines-clip,
  postproc, svg.ts, svg-arrow-ops) beyond the brief — mechanical field-rename
  necessity, logged above.
