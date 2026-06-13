# Batch 3 — multi-color parallel-spline edges

Ports `multicolor()` (lib/common/emit.c:1975): an edge `color="c1:c2:…"`
draws one offset Bézier per color, parallel to the routed spline, plus
per-end colored arrows. Consumes G1's `parseSegs`. The parity mission
(T4) renders the FIRST color only for colorList edges.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| M1 | multi-color parallel-spline edges ([M1-multicolor-edges.md](M1-multicolor-edges.md)) | sonnet | src/render/svg-helpers.ts, src/gvc/device.ts (+tests) | G1 (parser) | [ ] |

Single task. Geometry-heavy (offset-spline computation). Runs after
Batch 1. Byte-stability: existing edge goldens are single-color, so this
is new behavior; single-color edges keep the parity (T4) path.
