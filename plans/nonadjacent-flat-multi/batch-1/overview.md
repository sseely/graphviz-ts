# Batch 1 — Box-helper generalization (foundation)

Pure refactor: generalize the connecting-box builders so the cnt-loop (Batch 2) can
pass per-`i` offsets, and export the flat-routing helpers the new module needs. No
behavior change — cnt=1 stays byte-identical.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Split `topBoxes`/`bottomBoxes` into separate end-step/mid-step params; export box+end helpers | direct (opus) | `src/layout/dot/splines-flat.ts` | — | [ ] |

Gate: `tsc` clean, `vitest run` 1995 green (byte-identical), `lizard` clean,
`splines-flat.ts` <500 lines.
