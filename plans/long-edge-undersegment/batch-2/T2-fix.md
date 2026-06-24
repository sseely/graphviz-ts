<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — Fix the long-edge under-segmentation (REWRITTEN BY S1)

## Context

Faithful port; `~/git/graphviz` is the spec. Long multi-rank edges flipped one
bezier piece vs the oracle (p3 `sleep--runmem`: port 3 / oracle 4). S1 localized
the cause to `normalizeXcoords` in `src/layout/dot/position.ts`: it shifts every
node x by `minNormalLeftX = leftmost.coord.x − leftmost.lw`; `lw` is non-integer,
so the delta is non-integer and converts the network-simplex **integer** x-frame
into a non-integer one. `maximal_bbox`'s faithful `round(b)` then straddles
rounding boundaries differently from C (which routes in its integer frame and
does not normalize here), perturbing the `Pshortestpath` corridor `pl` sub-pixel
and flipping the knife-edge fitter. Full diff:
[decisions.md#d-fixsite](../decisions.md#d-fixsite).

## Task (DONE)

`normalizeXcoords`: shift by `Math.round(minX)` instead of `minX`. Keeps the
routing frame integer (C's invariant); the fraction washes out in the postprocess
translate so final node positions are unchanged. Comment updated to explain the
round and cite `lib/dotgen/position.c:set_xcoords` (no normalize step). No fitter
or corridor change — the fix is one token, pinned to C's integer-frame invariant.

## Write-set (actual)

- `src/layout/dot/position.ts` — `normalizeXcoords` delta rounded; doc comment.
- `test/corpus/parity.json` — refreshed by the Batch-3 survey (T3).
- `test/corpus/PARITY.md` — refreshed by the dashboard (T3).

No new golden was added: the change is a frame-rounding correction with no new
shape/primitive; p3's existing parity row is the regression anchor and T3's
survey is the byte-level gate. (If desired, a long-edge golden can be added in a
follow-up — not required to pin this fix, which is covered by the corpus diff.)

## Read-set

- [decisions.md#d-fixsite](../decisions.md#d-fixsite)
- `src/layout/dot/position.ts` (`normalizeXcoords`, `minNormalLeftX`,
  `shiftAllXcoords`)
- `src/layout/dot/edge-route-faithful.ts` (`maximalBbox` `round`)
- `~/git/graphviz/lib/dotgen/position.c:set_xcoords`,
  `lib/dotgen/dotsplines.c:maximal_bbox`

## Architecture decisions

D2 (pin to C: integer routing frame), D3 (this class only — rankdir left to its
separate residual), D4 (0 regressions), D5 (rankdir classified separate).

## Acceptance criteria

- p3 `sleep--runmem`: 4 pieces, full p3 SVG geometry byte-identical to oracle. ✅
- Final node positions unchanged for all graphs (fraction washes out in
  translate) — verified by survey 0 node regressions (T3).
- byte-match ≥ 281, 0 per-id regressions vs `main` (T3 gate).
- rankdir_dot rows: separate residual (D5), not required to flip.

## Rollback

**Reversible** — revert the one-line change; geometry-only.

## Quality bar

`tsc` clean ✅; `vitest` green; survey 0 regressions (T3). Commit:
`fix(T2): round normalizeXcoords delta — integer routing frame matches C`.

## Boundaries

- **Always:** keep currently-matching rows byte-identical (D4); pin to C's
  integer frame.
- **Never:** reimplement the fitter; chase the rankdir separate residual (D3/D5).
