# pgram / trapeziumlr secondary cause = ratio=fill activation gate

> **RESOLVED (merged `f9f1898`).** Activated ratio=fill (`parseRatioCompress` →
> `parseRatioDrawing` in init.ts populates `g.info.drawing` for fill). Survey GATE
> PASS, 0 regr, byte 496→503. trapeziumlr×3 + jsort×3 + 1855 → conformant. pgram×3
> still diverged on the ~0.41px label/font residual below (separate follow-up).
> expand/value/auto remain deferred. See [[ratio-fill-activation-done]].

## Observation: pgram/trapeziumlr divergence is dormant set_aspect (ratio=fill)
- **Context**: investigating the residual `diverged` verdicts on
  `{graphs,share,windows}-pgram` (maxΔ736–1108px) and `-trapeziumlr` (maxΔ690–931px)
  left open after the FLATORDER `left2right` fix (mission fix-flatorder-enforcement).
- **Finding**: both graphs are `rankdir=LR; ratio=fill; size="7,9.5"; page="8,10.5"`.
  C scales the layout to exactly fill `size` (504×684pt = 7×9.5in×72) via
  `set_aspect` R_FILL (`lib/dotgen/position.c:904-972`). The port renders the
  natural layout (trapeziumlr 167×684) — the x/rank axis is NOT stretched.
  **Heights matched, widths off ~3×** was the tell.
  - The port's `setAspect` (`src/layout/dot/position-bbox.ts:151`) ALREADY ports the
    full fill/expand/value math (`aspectFillScale` etc., faithful to C). It is
    DORMANT: `setAspect` returns early because `g.info.drawing` is only populated
    for `ratio=compress`. `parseRatioCompress` (`src/layout/dot/init.ts:125`) gates
    on `kind === 'compress'` (ADR-1 deferral); fill/expand/value/auto leave
    `drawing` unset.
- **PROOF (experiment, reverted)**: temporarily widening that gate to also populate
  `g.info.drawing` for `fill` →
  - `trapeziumlr`: port 504×683, geom diff **0.00 — conformant to C**.
  - `pgram`: port 504×683 (dims now exact), residual **maxΔ 0.41px** (node u) =
    SEPARATE smaller cause (note `Times,serif` font-metric fallback warning;
    pgram has octagon + multiline labels).
- **Impact**: the fix is NOT "implement R_FILL" (already done) — it is "activate it"
  (populate `drawing` for fill, mirroring `parseRatioCompress`). LOW risk/effort for
  trapeziumlr (conformant); pgram needs a tiny follow-up for the 0.41px label/font
  residual. **13 corpus graphs use `ratio=fill`** (b106, b22, decorate, jsort,
  pgram, polypoly, trapeziumlr across graphs/share/windows) → activation MUST pass
  the full survey gate (AD-3) before commit.
- **Interaction gotcha** (`src/gvc/device.ts:431-436`): `ratio=fill` must NOT set the
  `init_job_viewport` `filled` flag, or it double-scales (~31x). The port's `filled`
  comes only from a trailing `!` on `size=` (independent of `ratio`), so this is
  already correct — after `set_aspect` fills to `size`, the viewport zoom Z≈1.0. The
  experiment's exact dimensions (504×683, no double-scale) confirm it.
- **Scope note**: `1472` (also in the residual list) is NOT a `ratio=fill` graph — a
  separate, unrelated residual (no coord delta → structural/element-count).
- **Confidence**: High (experimentally proven, C-spec-confirmed, reverted clean).
