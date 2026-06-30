# T4 — Apply the Layer-2 fix + full 2471 parity verify

## Context

Batch 2 (`../batch-2/layer2-root-cause.md`) localized the transpose
non-convergence root cause and proposed a C-faithful fix. Apply it and prove
full 2471 parity. The T1 vStart fix is already in place.

## Task
1. Apply the faithful fix from `layer2-root-cause.md` (likely in
   `mincross-cross.ts`: `transpose`/`transposeStep`/`transposeCounts`).
2. Add a unit test that captures the C-faithful behavior the fix restores
   (e.g. a transpose-convergence or in_cross/out_cross-parity case).
3. Verify the full gate set (below). Use the fingerprinted C-oracle dump for the
   2471 order comparison; REVERT C instrumentation after.

## Write-set
- `src/layout/dot/mincross-cross.ts` (most likely; confirm against root-cause doc)
- `src/layout/dot/mincross-cross.test.ts`
- Temp-only: `~/git/graphviz/lib/dotgen/mincross.c` (dump; reverted after)

## Read-set
- `../batch-2/layer2-root-cause.md` (the fix)
- `src/layout/dot/mincross-cross.ts` (target functions)

## Acceptance criteria
- Given the fix, when 2471 is rendered, then its final per-rank order is
  **conformant to C** (fingerprinted name dump diff == 0).
- Given the fix, when 2471 runs, then it **completes in < ~60s** (no hang).
- Given the fix, when `npm test`, then **zero golden churn** and all prior
  reproducers (mc3, chain_24 TB+RL, port_rl, Batch-1 windowed) stay
  conformant to C; all tests pass.
- Given the fix, when `npm run typecheck` / `npm run build`, then exit 0.
- Given completion, then `git -C ~/git/graphviz status --porcelain lib/dotgen`
  is empty.

## Observability
N/A — layout-algorithm internals.

## Rollback
Reversible — revert the commit (returns to T1-applied state, which hangs 2471;
so T4 is only "done" when 2471 completes conformant). Do not merge a state where
2471 hangs.

## Quality bar
All gates green. Commit: `fix(T4): <layer-2 function> converges/orders per C`.
Update memory `2471-blocker-is-cluster-ranking` to RESOLVED on success.
