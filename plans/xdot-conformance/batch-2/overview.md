# Batch 2 — Walk conformant items small→large; fix to conformant

This batch is a **loop**, not a fixed task list. Its full protocol is in
[fix-loop.md](fix-loop.md). Each iteration = one root-caused fix = one commit.

## The loop (summary)
```
1. npx tsx test/corpus/xdot-walk.ts        # stop-on-first-divergence
2. if "all conformant" → batch done, go to exit criteria
3. diagnose the reported divergence to root cause  (~/.claude/rules/diagnosis.md)
4. fix at the origin in src/render/dot.ts (or src/gvc/device.ts if shared)
5. quality gates (README) — SVG gate only if device.ts/shared helper touched
6. one commit; append a decision-journal row (item id, mechanism, files)
7. goto 1
```
Irreducible C quirk → record in `test/corpus/accepted-divergences-xdot.json`,
continue. New draw-op class → diagnose + fix inline. Layout-rooted divergence →
STOP (violates the SVG-conformant premise).

## Pre-diagnosed early iterations
From the `digraph{a[color=red];a->b}` probe (verified 2026-07-06). The walker will
surface these in roughly this order on the smallest graphs; expect ~4 fixes to
clear the a→b class. See fix-loop.md for the mechanism of each.

| ID | Fix | Likely file | Depends On |
|----|-----|-------------|------------|
| F1 | xdot coords are y-up — remove Y-inversion (fixes ellipse + text together) | `src/render/dot.ts` | — |
| F2 | pen/fill color from graphics state, not hardcoded `#000000` | `src/render/dot.ts` (+`device.ts` if state lives there) | — |
| F3 | emit-state routing: label→`_ldraw_`, edge spline→`_draw_`, arrow→`_hdraw_` | `src/gvc/device.ts` + `src/render/dot.ts` | — |
| F4 | graph-background `_draw_`; font (`Times,serif`→`Times-Roman`) + color (`black`→`#000000`) canon | `src/render/dot.ts` | — |
| F5…Fn | draw-op classes surfaced by larger graphs (style `S`, cluster `_gdraw_`, gradient, image, record ports) | `src/render/dot.ts`/`device.ts` | loop-discovered |

These are the SAME two files, so iterations are **sequential** (one writer, one
commit each) — consistent with the stop-and-fix loop.

## Exit criteria
- `npx tsx test/corpus/xdot-walk.ts --survey` → `counts.diverged === 0` and
  `counts["port-error"] === 0` across the 759 conformant items (any remaining
  divergence must be an entry in `accepted-divergences-xdot.json` with rationale).
- `PARITY-XDOT.md` regenerated and committed; conformant % recorded.
- SVG `rules-gate.ts` regressions = 0 (no collateral damage to the SVG renderer).
- Every accepted divergence referenced in the decision journal with its mechanism
  (per CLAUDE.md: "a mission with any quarantined/excluded case is not complete
  until its comparison is documented and referenced in the decision journal").
