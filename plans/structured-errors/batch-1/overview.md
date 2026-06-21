# Batch 1 — Error type system + friendly-message seam

Foundation. Defines the public `GvError` contract and the central
`code → friendlyMessage` seam that every other batch consumes. No dependencies.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | `GvError`/`RenderResult` types, `RenderError` class, friendly-message map | typescript-pro | `src/errors.ts`, `src/errors.test.ts` | — | [x] |

On completion: T1's exports unblock T2, T3 (batch 2) and T4 (batch 3).
