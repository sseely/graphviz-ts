# Batch 1 — diagnoses (docs-only, all parallel, all worktree-isolated)

Seven independent diagnosis tasks. Outputs = analysis/<family>.md per the
interface contract in decisions.md + a journal row. No src changes → no
survey; batch gate = all docs present with a verdict.

| ID | Description | Model | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | b29/b124 re-verify + diagnose | fable | analysis/hub-fanin.md | — | [x] |
| T2 | 2413_1/_2 2-cycle vspace diagnose | fable | analysis/2413-vspace.md | — | [x] |
| T3 | ortho 2361/1856 bounded pass | fable | analysis/ortho-tiebreak.md | — | [x] |
| T4 | polypoly ×3 bounded pass | sonnet | analysis/polypoly.md | — | [x] |
| T5 | 2613 canvas-extent diagnose | sonnet | analysis/2613-canvas.md | — | [x] |
| T6 | 1453 concentrate+curved diagnose | sonnet | analysis/1453-curved.md | — | [x] |
| T7 | 2646 record-port residual diagnose | sonnet | analysis/2646-recordport.md | — | [x] |
