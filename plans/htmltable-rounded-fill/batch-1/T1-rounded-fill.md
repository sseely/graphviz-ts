<!-- SPDX-License-Identifier: EPL-2.0 -->

# T1 — Rounded `<path>` bgcolor fill for HTML tables + cells

## Context

`graphviz-ts` is a faithful TypeScript port of Graphviz; the C source at
`~/git/graphviz` is the spec. A prior mission (`htmltable-gradient-fill`) made
HTML tables emit gradient `bgcolor` fills, but the fill is always a square
`<polygon>`. For `style="rounded"` tables/cells the native oracle emits a
rounded-rectangle Bézier `<path>`, and the gradient bounding box is derived from
that rounded shape (so the gradient `x1/x2/y1/y2` shift by ~3.54pt). Separately,
the oracle carries the cell border pen width onto the bgcolor fill as
`stroke-width="N"` even with `stroke="none"`; the port drops it.

Strict TS, no `any`, no Node-only APIs, EPL-2.0 header on any new file. Tests are
vitest, co-located. TDD: write the failing test first.

## Task

Make the bgcolor fill rounded-aware and pen-width-aware, mirroring C.

### Gap A — rounded `<path>` fill (tables + cells)

1. **`src/common/htmltable-emit.ts`** (`emitBgFill`, `BgFillCtx`)
   - When the table/cell `style` string includes `"rounded"`, emit the fill as a
     rounded Bézier `<path>` via the existing
     `emitRoundedBezier(af, { x: 0, y: 0 }, true, { renderer, job })` instead of
     `renderer.polygon(pts, true, job)`. Keep the non-rounded branch (square
     polygon) exactly as-is.
   - `af` = the four AF corner points of the fill box (use `mkPts` from
     `htmltable-emit-fill.ts`, the same inset-by-`border/2` + `pos` offset the
     border path uses). **Verify** the AF ring order `emitRoundedBezier` /
     `interpolationPoints` expects matches `mkPts`'s SW,SE,NE,NW order against a C
     dump before trusting it (push-forward; see C `mkPts(AF, pts, border)` and
     the rounded-cluster/record call sites). Adjust the ring you build, never
     `emitRoundedBezier`.
   - The fill must run inside the same paint scope (`withHtmlPaint`) so the
     gradient/solid obj state is active when `emitRoundedBezier` draws — the
     gradient bbox is derived from the emitted path by the renderer (proven by
     `grdcluster`).
   - Thread `style` into the fill decision for BOTH call sites (cell at the
     `emitCellDecoration` site; table at `emitHtmlLabel`). `style` is already on
     `BgFillCtx` (added in the gradient mission).
   - C reference: `emit_html_tbl` (htmltable.c:543-557), `emit_html_cell`
     (:644-657) — the `if (style.rounded) round_corners(...) else gvrender_box`.

### Gap B — pen width on the bgcolor fill

2. **`src/common/htmltable-emit-fill.ts`** (`withHtmlPaint`, `HtmlPaint`)
   - Currently `withHtmlPaint` forces `penWidth = 1.0` for fills. A bordered
     cell's fill must carry `stroke-width = border`. Add the fill pen width to
     the paint (e.g. honor `penWidth` even on the fill branch, or a dedicated
     `fillPenWidth`), and pass the cell/table `border` from `emitBgFill`.
   - **Verify the C ordering first**: in `emit_html_cell`, confirm whether the
     border penwidth is set before the fill draw or leaks from the prior cell's
     `doBorder`, and mirror it faithfully. Dump the oracle if unsure (see
     `oracle-native-not-wasm`). Do NOT invent a width.
   - Keep `stroke="none"` on the fill (pen color stays transparent); only the
     `stroke-width` attribute changes.

### Tests

In `htmltable-emit.test.ts` / `htmltable-emit-fill.test.ts`:
- A `style="rounded"` table bgcolor emits a `<path …d="M…C…"/>` fill (not a
  `<polygon>`); a non-rounded table still emits a `<polygon>` (regression).
- A `style="rounded"` cell bgcolor emits a `<path>` fill (covers D2 — cell arm,
  not exercised by the corpus).
- A rounded gradient table emits `<path fill="url(#l_N)">` with the gradient
  bbox matching the rounded inset (assert the path + a gradient def present).
- A bordered cell (`border="3"`) bgcolor fill carries `stroke-width="3"`; a
  default-border (1) cell does not.

## Write-set

- `src/common/htmltable-emit.ts` (modify)
- `src/common/htmltable-emit-fill.ts` (modify)
- `src/common/htmltable-emit.test.ts` (modify)
- `src/common/htmltable-emit-fill.test.ts` (modify)

Do NOT modify `src/common/poly-shapes.ts`, `poly-shapes-util.ts`, the bezier
renderer, or `svg-gradient.ts` (D1). If you believe one needs changing, STOP and
log to the decision journal — `grdcluster`/record conformant says the path is
reusable as-is.

## Read-set

- `src/common/htmltable-emit.ts` (`emitBgFill` + the two call sites)
- `src/common/htmltable-emit-fill.ts` (whole — small; `withHtmlPaint`, `mkPts`,
  `HtmlPaint`)
- `src/common/poly-shapes.ts:141` (`emitRoundedBezier` signature) — read-only
- `src/common/record.ts:489` and `src/gvc/device.ts:320` — the exact
  `emitRoundedBezier(af, {x:0,y:0}, filled, {renderer, job})` call pattern to copy
- `src/common/htmltable-pos.ts` (`PlacedCell`/`PlacedHtml`: `style`, `border`,
  `gradientangle` already present) — read-only
- C: `~/git/graphviz/lib/common/htmltable.c:543-557` (table), `:644-657` (cell),
  `:248-275` (`doBorder` / `round_corners` usage), `round_corners` in
  `lib/common/shapes.c`

## Architecture decisions (locked — see decisions.md)

- D1: reuse `emitRoundedBezier`; do not touch the renderer.
- D2: port both the table and the cell rounded arms.
- D3: include gap B (pen width on fill), verifying C ordering.

## Interface contract (consumed by T2)

After this task, rendering any `graphs-grd{fillcolor,linear,linear_angle,radial,
radial_angle}` corpus input via `test/corpus/render-one.ts <input> dot` emits the
table bgcolor fill as a rounded `<path fill="url(#l_N)">` (or `fill="<color>"`
for solid), each bordered cell fill carries `stroke-width="<border>"`, and the
output conforms to the native oracle.

## Acceptance criteria

- Given a `style="rounded"` table with a gradient bgcolor, when rendered, then
  the table fill is a `<path>` (not `<polygon>`) and the gradient def coords
  match the rounded inset.
- Given a non-rounded table bgcolor, when rendered, then the fill is still a
  square `<polygon>` (regression).
- Given a `style="rounded"` cell bgcolor, when rendered, then the cell fill is a
  `<path>`.
- Given a `border="3"` cell bgcolor fill, when rendered, then it carries
  `stroke-width="3"` with `stroke="none"`.
- `npm run typecheck` exits 0; `npx vitest run` exits 0 (no regressions).

## Observability

N/A — pure render emission, no new observable runtime operations.

## Rollback

Reversible — revert the commit; output reverts to square `<polygon>` fills.

## Quality bar

`npm run typecheck` and `npx vitest run` both exit 0 before finishing. No `any`.
Repo hooks: file ≤500 lines, CCN ≤10, params ≤5 — group extra params into the
existing `BgFillCtx`/`HtmlPaint` descriptors. Cap hook-fix iterations at 2 per
violation; if a hook can't be satisfied in 2 tries, STOP and report. Verify your
own gate claims by running the commands. Return only a short summary.

## Commit

`feat(htmltable): emit rounded <path> bgcolor fills + fill stroke-width`
Body: note the C `emit_html_tbl`/`emit_html_cell` rounded arm origin, reuse of
`emitRoundedBezier` (proven conformant by grdcluster/record), and the gap-B
pen-width-on-fill.
