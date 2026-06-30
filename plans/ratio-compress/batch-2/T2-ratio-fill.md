<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — ratio=fill (DEFERRED)

## Dead-code state
`aspectFillScale` (`src/layout/dot/position-bbox.ts`) is **ported but dead** —
`setAspect` → `aspectScaleFactors` returns it only when
`g.info.drawing.ratioKind === 'fill'`, and `drawing` is never populated. After
T1 the wiring point exists; this task would populate `drawing` for `fill`.

## C reference
`lib/dotgen/position.c:919-936` (R_FILL branch of `set_aspect`): `filled=true`;
`xf=size.x/sz.x`, `yf=size.y/sz.y`; if either `<1`, normalize the smaller axis to
1 and divide the other (fill stretches both axes). `lib/common/input.c:576`
(`setRatio` → R_FILL).

## Corpus / risk
`b22` (**conformant today, without fill**), `polypoly` (structural 6.56),
`jsort`/`pgram`/`trapeziumlr` (diverged ~700). **Primary risk: regressing b22.**
That b22 conforms to without fill suggests fill is a no-op for it (scale≈1); must
be confirmed against the oracle before activating. The three diverged fill graphs
may improve.

## Why deferred
Activating fill touches 5 graphs including a fragile conformant (b22). Needs its
own baseline survey and per-graph oracle check — out of scope for ratio=compress.

## When taken up
Populate `drawing` for `fill` in `dotGraphInit`; run the full survey; require 0
regressions on b22/b68 and net improvement (or no worse bucket) on the rest.
