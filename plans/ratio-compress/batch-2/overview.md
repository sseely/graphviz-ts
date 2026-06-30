<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — ratio-aspect dead-code inventory (DEFERRED)

**Not a work order.** This batch captures the rest of the `ratio` family that is
dead or unported for the same root cause T1 fixes (`g.info.drawing` never set).
It exists so these paths are tracked, not lost. Do **not** execute in the
ratio=compress mission — each needs its own sign-off, oracle validation, and a
baseline survey, because activating them changes graphs that currently pass.

Once T1 lands, "activating" each of these is mostly: (a) populate
`g.info.drawing.ratioKind` for that kind in `dotGraphInit` (extend
`parseRatioKind` usage), and (b) verify the already-ported consumer
(`aspectFillScale` / `aspectExpandScale` / `aspectValueScale`, or port
`idealsize` for auto). The consumers in `setAspect` are the dead code.

| ID | Kind | Consumer (state) | Corpus graphs | Primary risk | Done |
|---|---|---|---|---|---|
| [T2](T2-ratio-fill.md) | fill | `aspectFillScale` (ported, dead) | b22 (byte), polypoly (struct), jsort/pgram/trapeziumlr (diverged) | regress **b22** (currently conformant) | [ ] |
| [T3](T3-ratio-expand.md) | expand | `aspectExpandScale` (ported, dead) | none in corpus today | low (no corpus coverage) | [ ] |
| [T4](T4-ratio-value.md) | value | `aspectValueScale` (ported, dead) | none in corpus today | low (no corpus coverage) | [ ] |
| [T5](T5-ratio-auto-idealsize.md) | auto | `idealsize` (UNPORTED) | b68 (byte, works by omission) | regress **b68**; new code | [ ] |

**Shared C reference:** `lib/dotgen/position.c:905` `set_aspect` —
R_AUTO/`idealsize` (916), R_FILL (919), R_EXPAND (937), R_VALUE (949);
`lib/common/input.c:576` `setRatio`.
