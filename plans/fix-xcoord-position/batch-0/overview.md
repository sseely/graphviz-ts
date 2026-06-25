# Batch 0 — Reference measurer + headless rules corpus (side-by-side)

Foundation: a deterministic reference measurer that matches headless graphviz,
and a side-by-side rules survey proving the layout rules are faithful.

| Task | Writes | Gate |
|------|--------|------|
| [T0.1 EstimateTextMeasurer](T0.1-estimate-measurer.md) | src/common/textmeasure.ts | raw measurer exists + unit-tested |
| [T0.2 headless rules corpus](T0.2-headless-corpus.md) | test/corpus/* (new) | reference vs headless byte-exact (modulo pre-existing) |

Gate to exit Batch 0: rules survey byte-exact except documented pre-existing
divergences; existing pango survey still 0 regressions (ADR-3).
