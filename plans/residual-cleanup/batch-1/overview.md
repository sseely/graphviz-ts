# Batch 1 — check + diagnoses (5 parallel, worktree, docs-only)

| ID | Description | Model | Writes (via orchestrator) | Depends | Done |
|---|---|---|---|---|---|
| R1 | 2371 mirror-tie bounded check | sonnet | analysis/2371-mirror.md | — | [x] accept |
| R2 | 1949 both sub-mechanisms | sonnet | analysis/1949-residuals.md | — | [x] fix+fix |
| R3 | 1453 TREE_GROUP Δ457 localize+diagnose | sonnet | analysis/1453-treegroup.md | — | [x] fix (verified 0-diff) |
| R4 | 1447_1+2620 ortho maze-corridor diagnose | fable | analysis/ortho-corridor.md | — | [x] fix×3 (2620 split) |
| R5 | 2646 unknown diagnose (5-min renders) | fable | analysis/2646-unknown.md | — | [x] accept (A6 new class) |

Interface contract per doc: mechanism / origin file:line / causalChain /
ruledOut+evidence / verdict fix|accept|already-closed|inconclusive /
proposedWriteSet / evidence. Prior evidence pointers per task file.
