# Architecture Decisions (pre-made — DRAFT for Scott's review)

| ID | Decision |
|----|----------|
| AD1 | **Adopt C's `push_obj_state` lifecycle in the device walk.** The device walk (src/gvc/device.ts) pushes a populated `ObjState` at begin-node/edge/cluster/graph and pops at end (ports emit.c push_obj_state/pop_obj_state, :108/:132). `emitStyle` already reads `job.obj` — this populates it instead of leaving it null. The M12 `withHtmlPaint` scoped push/pop stays as a nested override for html cell-level paint (it pushes on top of the object's state). NOT a parallel side-channel — one obj-state stack, as in C. |
| AD2 | **Style resolution is a shared pure-function module** (e.g. src/common/style-resolve.ts) porting `parse_style` → `graphviz_polygon_style_t` flags (filled/dashed/dotted/bold/invis/diagonals/rounded/radial/striped/wedged), `stylenode`, `isFilled`/`findFill`, and `penColor`. Pure data-in/data-out (attrs → resolved pen/fill/penwidth/style); the walk and codefns consume it. No rendering in this module. |
| AD3 | **Two-color fill → first solid color** (carried from M12 AD4). `findStopColor`/`svg_gradstyle` gradient emission is a SEPARATE mission. When `fillcolor`/`bgcolor` is `"c1:c2"` or has `GRADIENTANGLE`, emit the first color as a solid fill (matching `setHtmlFill`/`parseGradientSpec` already in htmltable-emit-fill.ts — reuse, don't duplicate). Document each such site with an @see to the gradient mission. |
| AD4 | **Pen width / dash thresholds match the existing svg-helpers constants exactly.** `emitPenWidth`/`emitDash`/`emitStyle` (src/render/svg-helpers.ts) already encode C's omit-at-default behavior (PENWIDTH_NORMAL 1.0, threshold 0.005, dash arrays "5,2"/"1,5"). The mission FEEDS those functions correct `ObjState` values; it does not change their emission logic (golden byte-stability depends on it). |
| AD-C1 | (Carried M9–M12.) Append-only manifest entries with provenance; never modify existing refs/manifest/tolerances; refs from installed graphviz 15.0.0 only. |

## Locked constraints (not decisions)

- C function boundaries + @see cites per ported block (CLAUDE.md).
- YAGNI does not apply: the C source defines completeness. The only
  scoped omission is gradient paint (AD3) and the wedged/striped
  multicolor node fills (depend on the same gradient/multicolor
  subsystem — first-color fallback, journaled).
- Hot-loop GC: obj-state push/pop runs per object — reuse a pooled
  ObjState or push lightweight state; no per-node garbage in the walk
  (CLAUDE.md memory rules; quality-bar line, not a gate).
- Byte-stability is the hardest gate: the 82 existing goldens are
  monochrome/default-styled and MUST stay conformant. Populating
  obj-state must reproduce today's `fill="none" stroke="black"` output
  for unstyled objects exactly (default ObjState = white fill unused,
  black pen, solid, penwidth 1 → emitStyle's current default output).

## Operational readiness

Observability: N/A — library; the gate suite is the functional SLI
(tsc clean, vitest 0 failed, byte-stability probe, C-oracle compare).
Rollback: **Reversible** (git revert, one commit per task, no
migrations). Scalability: N/A beyond the hot-loop constraint. Backwards
compat: SVG output gains content (convergence to C) for styled graphs;
unstyled output unchanged; no API breakage (ObjState is internal).

## Open question for Scott

The 82 current goldens are all default-styled, so byte-stability is the
safety net but gives ZERO positive coverage of the new behavior until
T6. T6 mints ~15 colored/styled goldens. Confirm that target count, or
raise it if you want denser coverage (e.g. one golden per style flag).
