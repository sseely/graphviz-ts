# Batch 1 — transpose correctness fixes

Land the three concrete, C-verified transpose divergences. Fixes 1+2 are
already implemented in the working tree (this investigation); fix 3 (valid)
is new. All in `mincross-cross.ts`.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T1 | transpose reverse condition + candidate flag (already implemented) — commit + verify | `mincross-cross.ts` | — | [ ] |
| T2 | transpose_step `valid` invalidation on swap (root ranks r, r±1) | `mincross-cross.ts` | T1 | [ ] |
| T3 | unit test: transpose reverse tie + candidate convergence vs C ground truth | `mincross-cross.test.ts` | T1, T2 | [ ] |

## C spec anchors

- `transpose_step` swap + candidate + valid — `mincross.c:632-672`
- `transpose` candidate loop — `mincross.c:673-688`
- `in_cross`/`out_cross` (counts) — `mincross.c:1512+`

## Already-implemented (working tree, uncommitted)

- `transposeCounts` (count-based c0/c1, allocation-free), `shouldSwap`
  (`c1<c0 || (c0>0 && reverse && c1===c0)`), `markCandidates`,
  `initCandidates`, candidate-gated `transpose` loop. Goldens green (1864).

## Note on `valid` (T2)

C invalidates `GD_rank(Root)[r]` (the ROOT graph), not `g`. For non-cluster
graphs g==Root. Thread `ctx.root.info.rank` and set `valid=false` for r, r±1
on each swap, mirroring `mincross.c:657-665`.
