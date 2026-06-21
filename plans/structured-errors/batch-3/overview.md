# Batch 3 — Boundary wiring

Wire the structured contract into the public entry point: add `tryRenderSvg`,
classify thrown errors, wrap render-stage failures, and export the new surface.
Depends on T1 (types/`RenderError`), T2 (`ParseError`), T3 (`HtmlParseError`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | `tryRenderSvg`, `classifyError`, render-stage wrap, public exports | typescript-pro | `src/index.ts`, `src/index.test.ts` | T1, T2, T3 | [x] |

Final batch — on completion run full gates on the feature branch and write the
session summary into `README.md` per the autonomous-execution session-end step.
