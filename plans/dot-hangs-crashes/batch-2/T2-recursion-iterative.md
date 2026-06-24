<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — Remaining O(V) recursion → iterative

## Context

`rerank` was the confirmed stack-overflow culprit on 2108 and is fixed in T1.
The dot critical path has other self-recursive tree/graph walks that *could*
overflow on deep graphs in a browser (V8 ~1MB stack). This task ensures none
remain. Read `decisions.md#ad-3`.

Candidate O(V)-depth recursions in the dot path (verify which actually recurse to
graph depth — cluster/rank-bounded ones are shallow and **out of scope**):

- `src/layout/dot/acyclic.ts` — `dfs` (cycle-break DFS over the node graph)
- `src/layout/dot/straight-edges.ts` — `dfs`
- `src/layout/dot/ns-subtree.ts` — `treeAdjust` (tight-tree walk)

## Task

1. Confirm whether 2108 renders at **default** stack after T1. If yes, build a
   synthetic worst-case: a single chain of ~50k nodes
   (`a0->a1->...->a49999`) and render it with engine `dot` at default stack.
2. For each function that overflows on the synthetic chain (or any corpus input),
   convert it to an explicit todo-stack, preserving visit order and all side
   effects exactly (mirror the corresponding C function in
   `~/git/graphviz/lib/`). Add a unit test asserting equivalence on a small
   fixed graph.
3. If **no** function overflows, this task is a **no-op**: write a journal note
   ("no remaining O(V) recursion overflows at default stack; synthetic 50k-chain
   renders") and skip edits. Do not convert shallow (cluster/rank-bounded)
   recursions — that adds risk for no benefit.

Convert only what demonstrably overflows. Do not mask with `--stack-size`.

## Write-set

- `src/layout/dot/acyclic.ts` — only if its `dfs` overflows
- `src/layout/dot/straight-edges.ts` — only if its `dfs` overflows
- `src/layout/dot/ns-subtree.ts` — only if `treeAdjust` overflows
- corresponding `*.test.ts` for each conversion

## Read-set

- `decisions.md#ad-3`
- The candidate functions above (read each `dfs`/`treeAdjust` body first)
- C spec for each: `~/git/graphviz/lib/dotgen/acyclic.c`,
  `~/git/graphviz/lib/common/ns.c` (subtree), edge code as relevant

## Acceptance criteria

- **Given** a synthetic 50k-node chain, **when** rendered with `dot` at default
  V8 stack, **then** no "Maximum call stack size exceeded" is thrown.
- **Given** each converted function, **when** unit-tested on a small graph,
  **then** its outputs (ranks/order/marks) match the recursive version exactly.
- **Given** the full survey, **when** re-run, **then** zero regressions (AD-4)
  and output for all passing cases is unchanged.

## Observability

N/A.

## Rollback

Reversible per function. A conversion that changes any output → revert and
re-derive the visit order from C.

## Quality bar

`npm run typecheck` + `npm test` + survey gate. One commit per converted
function: `perf(<module>): iterative <fn> to avoid stack overflow`. If no-op,
no code commit — journal note only.
