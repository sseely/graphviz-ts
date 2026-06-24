<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions

## D1 — Reuse `emitRoundedBezier`; do not touch the renderer

**Context:** A rounded table/cell `bgcolor` fill must emit a rounded `<path>`
with the gradient bbox derived from the rounded shape.

**Decision:** Call the existing `emitRoundedBezier(af, {x:0,y:0}, filled,
{renderer, job})` (`src/common/poly-shapes.ts`) from the rounded branch of
`emitBgFill`, exactly as `record.ts:489` and `device.ts:320` do. Do NOT modify
`poly-shapes.ts`, the bezier renderer, or `svg-gradient.ts`.

**Consequences:** `grdcluster` (a byte-match control with a rounded gradient
cluster) proves this path is byte-exact end-to-end, including the gradient bbox.
If a renderer change appears necessary, STOP (stop condition) — the premise is
that the cluster/record path already works.

**Rollback:** Reversible — revert the commit.

## D2 — Port both the table and the cell rounded arms

**Context:** C has the identical `if (style.rounded) round_corners(...) else
gvrender_box(...)` in both `emit_html_tbl` (htmltable.c:550) and
`emit_html_cell` (:649). The corpus exercises rounded tables only (0 rounded
cells), but CLAUDE.md requires porting every branch.

**Decision:** Route both the table and cell bgcolor fill through the same
shared rounded-aware fill helper. One code path, driven by the placed object's
`style` string.

**Consequences:** Faithful to the C; the rounded-cell branch is covered even
though the corpus doesn't trigger it (a unit test will).

## D3 — Include gap B (pen width on the bgcolor fill)

**Context:** The oracle emits `stroke-width="N"` on a bordered cell's fill
polygon (even though `stroke="none"`); the port resets `penWidth` to 1 in
`withHtmlPaint`. All 5 target graphs have 81 bordered cells, so byte-match is
impossible without this.

**Decision:** Thread the cell/table `border` (pen width) into the bgcolor fill
paint so the fill draw carries `stroke-width = border`. Verify the exact C
ordering (`emit_html_cell`: penwidth set before the fill, or leaked from the
prior cell's `doBorder`) and mirror it faithfully — do not invent a value.

**Consequences:** Fixes solid bordered-cell fills too (pre-existing). Kept in
this mission because it is required for the byte-match acceptance criterion and
lives in the same files as gap A (one writer per file).

## D4 — Golden: rounded gradient table (+ optional rounded solid)

**Context:** The `htmltable-gradient-fill` goldens are non-rounded. This mission
needs a golden that pins the rounded `<path>` fill.

**Decision:** Add one native-oracle golden for a minimal rounded table with a
gradient bgcolor and a bordered cell (covers gap A + gap B + gradient bbox).
Optionally a second for a rounded solid-fill table (push-forward; log the
choice). `toleranceClass: "deterministic"`.

**Consequences:** Locks the rounded-path behavior against regression
independently of the corpus survey.
