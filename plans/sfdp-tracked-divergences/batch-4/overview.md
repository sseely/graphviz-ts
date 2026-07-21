# Batch 4 — B4 ratio=fill aspect-scaling

Depends on Batch 0. Skip if T0.2 marks B4 empty.

Inputs carrying `ratio=fill` (+ size/page): trapeziumlr (×3 copies), pgram (×3),
1855. `ratio=fill` rescales the layout to the target size; the scale factor
multiplies every coordinate, so a sub-point node/edge drift is amplified into a
multi-point bb divergence. pgram was `harness-error` in the stale attribution
(injection failed) — T0.1 should have resolved it; if not, its analysis is
blocked until the injector handles it.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4.1 | Analyze: separate the scale FP from the pre-scale drift | debugger | batch-4/findings.md | T0.2 | [ ] |
| T4.2 | Fix aggressively (scale math) or accept (drift×scale) | general-purpose | (src fix, isolated) + batch-4/findings.md | T4.1 | [ ] |

Key question: does the divergence come from the SCALE COMPUTATION (fixable —
match `_neato_set_aspect` fill/expand factors, [[ratio-fill-activation-done]],
[[neato-overlap-dispatch-prism]]) or from pre-scale position drift amplified by
a correct scale (accept — the scale is faithful, the input drifts)? Inject
exact PRE-scale positions and re-derive the scale; if the scaled bb then matches
native, the scale math is fine and the residual is amplified drift.
