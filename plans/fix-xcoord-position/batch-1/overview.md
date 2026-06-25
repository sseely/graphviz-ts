# Batch 1 — Public measurer API + auto-resolution

| Task | Writes | Gate |
|------|--------|------|
| [T1.1 setTextMeasurer + resolution chain](T1.1-measurer-api.md) | textmeasure-factory.ts, context.ts, index.ts | API public; browser excludes node-canvas; LUT demoted (ADR-4/5/6/7) |

Gate: explicit override works; browser bundle has no `canvas` import; Node
no-canvas falls back to estimate + install advice; existing survey 0 regressions.
