# Batch 2 — fillRanks (after T1)

Single task. Implements the placeholder-insertion half of newrank, using T1's
cgraph primitives. Tested at the model level (rank occupancy) — end-to-end
parity is T4 (which also removes the placeholders).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | `fillRanks`/`realFillRanks` + `makeFillNode` | opus | `src/layout/dot/mincross-build.ts`, `src/layout/dot/mincross-build.test.ts` | T1 | [ ] |

Gate per [../README.md](../README.md). One commit.
- T3: `feat(T3): port fillRanks/realFillRanks for newrank placeholder ranks`
