<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — ratio=value (numeric aspect ratio) (DEFERRED)

## Dead-code state
`aspectValueScale` (`src/layout/dot/position-bbox.ts`) is **ported but dead**
(same root cause). `parseRatioKind` (T1) must also capture the numeric `ratio`
value (C: `atof(p)>0 → R_VALUE`, stores `GD_drawing->ratio`); `LayoutParams`
already has an optional `ratio` field for this.

## C reference
`lib/dotgen/position.c:949-960` (R_VALUE branch of `set_aspect`):
`desired = ratio`, `actual = sz.y/sz.x`; if `actual<desired` stretch y
(`yf=desired/actual, xf=1`) else stretch x (`xf=actual/desired, yf=1`).
`lib/common/input.c:582-588` (`setRatio` numeric branch).

## Corpus / risk
**No corpus graph uses a numeric `ratio=` today** → no regression surface, no
oracle coverage. Needs a hand-built golden.

## Why deferred
No corpus signal; depends on T1 having stored the numeric ratio. Captured to keep
`aspectValueScale` tracked.

## When taken up
Ensure `parseRatioKind` stores the numeric ratio on `drawing.ratio`; populate
`drawing` for value kind; add an oracle-pinned golden test.
