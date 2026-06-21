<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — shape=point: sizing + fill + label suppression

## Context
graphviz-ts is a faithful TS port of C graphviz; `~/git/graphviz` is the spec.
`shape=point` is registered (`shapes.ts:83`, `kind: SH_POINT`) but never
specialized — it renders as a default ellipse. Port C's `point_init` sizing and
`point_gencode` rendering via an `SH_POINT` branch (AD-1).

## Task
1. **Sizing** (`src/common/nodeinit.ts`): when the bound shape's `kind` is
   `SH_POINT`, override sizing per `point_init`
   (`~/git/graphviz/lib/common/shapes.c:point_init`):
   `w = min(width_attr, height_attr)`; if NEITHER width nor height is user-set →
   `width = height = DEF_POINT (0.05)`; else `w = max(w, MIN_POINT (0.0003))` and
   `width = height = w`. Do not let the (suppressed) label drive size. (AD-2)
2. **Render** (`src/common/poly-gencode.ts`): when `SH_POINT`, force
   `filled = true` with default fill black (`findFillDflt(n, "black")` semantics:
   explicit color wins), and SKIP the `renderLabel` call. (AD-3, AD-4)
3. **Reuse** the existing ellipse vertex / periphery / `poly_inside` paths
   (AD-5). Verify; only touch `poly-inside.ts` under the AD-5 contingency.
4. Add/extend unit tests in the modules' existing `*.test.ts` (check
   `src/common/shapes.test.ts`, `src/common/poly-shapes.test.ts`, and any
   `poly-gencode`/`nodeinit` test first — add, don't duplicate).
5. Keep helpers ≤ CCN 10, files ≤ 500 lines (decompose if the hook fires).

## Write-set
- `src/common/nodeinit.ts`
- `src/common/poly-gencode.ts`
- the modules' existing test file(s)
- `src/common/poly-inside.ts` — ONLY under the AD-5 contingency

## Read-set
- `~/git/graphviz/lib/common/shapes.c:point_init` (sizing) and `point_gencode`
  (fill + no-label), plus `DEF_POINT`/`MIN_POINT` (`:42`,`:47`)
- `src/common/nodeinit.ts:99-145` (size resolution — `userSize`, width/height)
- `src/common/poly-gencode.ts:159-175` (`renderLabel`) + the ellipse emit
- `src/common/shapes.ts:60-85` (`mkPoint`, `kind: SH_POINT`)
- `src/common/types.ts:316-317` (`SH_POINT`)
- decisions.md#ad-1 … #ad-5

## Architecture decisions (locked)
AD-1 SH_POINT branch (no POINT_FNS). AD-2 point_init sizing formula. AD-3 skip
renderLabel. AD-4 filled black default, explicit color wins. AD-5 reuse
ellipse/inside; poly-inside.ts only under contingency.

## Acceptance criteria
- AC1: Given `a [shape=point]`, when laid out, then ND_width == ND_height ==
  0.05in (rx 1.8pt) — DEF_POINT.
- AC2: Given bare `a [shape=point]`, when rendered, then exactly one filled
  black `<ellipse>` and NO `<text>` element for that node.
- AC3: Given `a [shape=point, color=red]`, when rendered, then the ellipse fill
  is red (explicit color wins).
- AC4: Given `a [shape=point, width=0.2]`, when laid out, then ND_width ==
  ND_height == 0.2in (min-of-attrs honored, not DEF_POINT).
- AC5: Given `digraph { a [shape=point]; b; a->b; }`, when rendered via the
  port, then the `a`-node ellipse byte-matches the oracle
  (`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg`): rx 1.8,
  fill black, no label.

## Observability
N/A — no new observable operations.

## Rollback
Reversible (decisions.md#rollback). In-memory layout only; no migration.

## Quality bar
`npx vitest run` green; `npx tsc --noEmit` clean; complexity hook clean. One
commit: `feat(shapes): render shape=point as a small filled dot (point_init/gencode)`.
