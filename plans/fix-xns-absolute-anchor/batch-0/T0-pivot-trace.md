# T0 — x-NS pivot-trace harness

## Context

graphviz-ts is a faithful TS port of Graphviz C. The x-coord network simplex
(`src/layout/dot/ns.ts`, called from `position.ts` `dotPosition` via
`rank(g, 2, …)`) produces x-coords that are a *uniform shift* of C's — same
relative layout, different absolute anchor (see `decisions.md` ground-truth).
We must find where the port's NS pivot sequence first diverges from C's so the
absolute anchor can be aligned (Batch 1). C is the spec.

## Task

Produce a side-by-side trace of the x-coord NS (balance=2) for `2368_1`:

1. **C trace** (`~/git/graphviz/lib/common/ns.c`, gate all prints by `getenv("NSDBG")`):
   - after `init_rank`: every node's name/type/rank.
   - after `feasible_tree`: tree-edge list (tail→head) + every node rank.
   - each main-loop pivot: `leave_edge` result (tail→head, cutvalue) and
     `enter_edge` result (tail→head, slack).
   - before and after the `balance==2` `LR_balance` call: every NORMAL node's rank.
   Build: `make -C ~/git/graphviz/build gvplugin_dot_layout`; regen
   `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`; run
   `NSDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2368_1.dot -o /dev/null`.
   Save stderr to `/tmp/xns-c.txt`. Then **revert** ns.c + rebuild clean.
2. **Port trace** (`src/layout/dot/ns.ts`, gate by `process.env.NSDBG`): the same
   points (initRank, feasibleTree tree edges, each leaveEdge/enterEdge pivot,
   before/after lrBalance). Run
   `NSDBG=1 GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2368_1.dot dot`
   → `/tmp/xns-ts.txt`. Keep the port instrumentation behind `NSDBG` but **remove
   it from `ns.ts` before closing the batch** (commit only the harness docs).
3. Write `test/diagnostic/xns-diff.mjs`: load the two traces, align them
   step-by-step, print the FIRST diverging step (init order, tree edge, pivot
   choice, or balance rerank) with surrounding context.
4. Write `test/diagnostic/xns-trace.md`: the recipe (env vars, build commands,
   the temporary-instrumentation snippets to paste, the revert step) + the
   captured baseline first-divergence for 2368_1.

## Write-set
- `test/diagnostic/xns-trace.md` (create)
- `test/diagnostic/xns-diff.mjs` (create)
- temporary, reverted: `~/git/graphviz/lib/common/ns.c`, `src/layout/dot/ns.ts`

## Read-set
- `src/layout/dot/ns.ts` (whole — the NS port)
- `~/git/graphviz/lib/common/ns.c` (init_rank, feasible_tree, rank2 loop, balance)
- `decisions.md#ground-truth-data`

## Acceptance criteria
- Given the harness, when run on 2368_1, then `/tmp/xns-c.txt` and `/tmp/xns-ts.txt`
  both contain init/tree/pivot/balance traces.
- Given `xns-diff.mjs`, when run, then it prints the first step where the port's
  pivot sequence diverges from C's, with the node/edge identities involved.
- Given the batch is closing, when `git status` is checked, then ns.c (C) is
  reverted + rebuilt clean and `ns.ts` has no committed NSDBG code.

## Observability / Rollback
N/A — diagnostic only. Reversible (delete the two files).

## Quality bar
`npx tsc --noEmit` clean; `npx vitest run` green (the diagnostic files are not
test suites — ensure they don't break collection). Commit:
`test(diagnostic): x-NS pivot-trace harness for absolute-anchor alignment`.
