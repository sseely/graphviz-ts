# Mission (DRAFT): Complete the xdot renderer's draw-op emission

**Status: Draft — run `/plan-mission` to complete before executing.**

Follow-on from [`expose-library-api`](../expose-library-api/decision-journal.md)
(Batch 2 / T6, 2026-06-21). T6 shipped `getDrawOps` — a thin, correct wrapper
that faithfully exposes whatever the xdot renderer emits — but discovered the
**xdot renderer itself is integration-incomplete**. User decision (2026-06-21):
defer the renderer fix to this follow-on; ship the library-API mission.

## Objective

Make `createXdotRenderer` (`src/render/dot.ts`, FORMAT_XDOT) emit per-object
draw-op streams that are byte-faithful to native `dot -Txdot`, so `getDrawOps`
returns a complete op stream (node shapes + edges + correct colors). "The C
source is sacred" — port against `plugin/core/gvrender_core_dot.c`, oracle-
verified.

## Confirmed gaps (oracle diff vs native `dot -Txdot`)

Repro: `printf 'digraph { a [color=red]; a -> b }' | dot -Txdot` vs the TS
xdot output for the same graph.

1. **Edges emit no `_draw_`** — native emits `_draw_="c 7 -#000000 B 4 ..."`
   (bezier) plus `_hdraw_` (arrowhead); TS emits the edge as `a -> b;` with no
   draw attrs at all.
2. **Node pen/fill color not applied** — `color=red` → TS `_draw_` carries
   `#000000`; native carries `#ff0000`.
3. **Node draw-op coordinates mismatched** — TS pairs each node's `_draw_`
   ellipse with the wrong node's coordinates (swapped between nodes).

Not broken: the xdot HELPER functions (`xdotPenColor`, `xdotPoint`, `xdotFont`,
…) are correct and unit-tested. The geometry is fully computed — the **SVG**
renderer draws the same graph (edges + red) correctly. Only the xdot full-graph
emission orchestration (begin/end + ellipse/bezier/polygon/textspan callbacks →
per-object xbuf accumulation) is incomplete.

## Open questions (resolve in planning)

1. Where does the node→draw-op coordinate pairing desync (likely the
   begin/end-node bracketing or the xbuf flush order in `render/dot.ts`)?
2. Is the edge draw path simply not wired into the xdot emit job, or wired but
   emitting to a discarded buffer?
3. Does fixing emission also fix the json/json0 renderers (shared draw path), or
   are those independent? Grep the shared callback path first.

## Blast-radius stub

Touches `src/render/dot.ts` (xdot emit path) and likely the shared render job
callbacks in `src/gvc/device.ts` — NOT additive (modifies the C-faithful
renderer). Needs an oracle harness: native `dot -Txdot` as ground truth, and a
new end-to-end xdot render test (today only helper-level unit tests exist).

## Pointer

Discovery + deferral decision:
[`expose-library-api/decision-journal.md`](../expose-library-api/decision-journal.md)
(Batch 2 / T6, 2026-06-21). Wrapper limitation note: `src/render/xdot-public.ts`.
