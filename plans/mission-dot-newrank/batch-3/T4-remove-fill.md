# T4 — `removeFill` + end-to-end newrank parity

## Context

`fillRanks` (T3) inserts `_new_rank` placeholder nodes so ranks reconcile.
`removeFill` (`init.ts`, no-op stub ~245) must delete them after layout so they
never render. `removeFill` is already called in `dotPhasePost`. With both
landed, the verified newrank bug (cross-cluster `rank=same` mis-aligned) is
fixed.

## Task

Port `lib/dotgen/dotinit.c:removeFill` faithfully:
1. `agsubg(g,"_new_rank",false)` (AD-1); if null, return.
2. For each node in that subgraph: `delete_fast_node(g, n)`,
   `removeFromRank(g, n)` (T2), `dotCleanupNode(n)` if present,
   `agdelnode(g, n)` (T1).
3. `agdelsubg(g, sg)` (T1).

Then pin end-to-end parity in `newrank.test.ts`.

## Write-set

- `src/layout/dot/init.ts` — implement `removeFill`
- `src/layout/dot/newrank.test.ts` — end-to-end oracle pins

## Read-set

- `decisions.md#ad-1`, `#ad-2`
- `~/git/graphviz/lib/dotgen/dotinit.c:removeFill` (line 258)
- T1 (`agsubg`/`agdelnode`/`agdelsubg`), T2 (`removeFromRank`), T3 (`_new_rank`
  contract)
- `init.ts:245` (stub), `delete_fast_node` in `fastgr.ts`

## Acceptance criteria

- **Given** the README repro (`digraph{newrank=true; subgraph cluster0{a->b->e}
  subgraph cluster1{c->d} a->c; {rank=same; b; c}}`), **when** rendered, **then**
  `c` aligns with `b` (matches the dot oracle: `c:y=-106`, `d:y=-34`) ≤0.5pt.
- **Given** any rendered `newrank` graph, **then** NO `_new_rank` placeholder
  nodes appear in the SVG (no stray nodes/titles).
- **Given** the same graph WITHOUT `newrank`, **then** the layout differs (the
  non-reconciled baseline) — confirming the flag drives the change.
- **Given** the 115 goldens, **then** all conformant.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates (passed ≥ 1814 + new
pins, 0 failed). After the gate passes, merge `feature/dot-newrank` → `main`
with a **merge commit**.
Commit: `feat(T4): port removeFill + pin newrank rank-reconciliation parity`.
If newrank parity is unreachable, STOP per AD-4 (keep stub, re-scope with a
comparison page in `comparisons/newrank.md`) — do not regress a golden.

## Observability / Rollback

N/A. Reversible (revert; newrank-gated, goldens conformant).
