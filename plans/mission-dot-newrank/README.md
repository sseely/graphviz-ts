# Mission: DOT-newrank — fillRanks (newrank) + expand_leaves

## Objective

Port the two stubbed compound-graph rank-building functions so dot honours
`newrank=true` and `LEAFSET` leaf packing faithfully (backlog DOT-3 + DOT-4).
The ranking dispatch already exists (`dotRank`→`dot2Rank`, ported; `mincross`
calls `fillRanks` under the `NEW_RANK` flag), but `fillRanks`/`realFillRanks`,
`removeFill`, and `expandLeaves` are no-op bodies. Per "the C source is sacred,"
mirror `mincross.c`/`dotinit.c`/`position.c` exactly.

**Verified premise (oracle, 2026-06-17):** `digraph{newrank=true; subgraph
cluster0{a->b->e} subgraph cluster1{c->d} a->c; {rank=same; b; c}}` — C aligns
`c` with `b` (`c:y=-106`); TS leaves `c` at `a`'s rank (`c:y=-178`) because
`fillRanks` never inserts the placeholder nodes that reconcile ranks globally.

## Branch

`feature/dot-newrank` off `main`. Merge back with a **merge commit** when gates
pass.

## Execution model

Run with **opus** (`claude-opus-4-8`, native 1M context).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND 115 goldens conformant
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1814 passed / 0 failed, 115 goldens conformant**
(main, post-DOT-1b). Oracle: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins`.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 cgraph primitives](batch-1/T1-cgraph-ops.md) · [T2 removeFromRank](batch-1/T2-remove-from-rank.md) · [T5 expandLeaves](batch-1/T5-expand-leaves.md) | [x] |
| 2 (after T1) | [T3 fillRanks](batch-2/T3-fill-ranks.md) | [x] |
| 3 (after T1,T2,T3) | [T4 removeFill + parity](batch-3/T4-remove-fill.md) | [~] RESCOPED — removeFill ported & green; parity blocked by 2 out-of-scope defects (see [comparisons/newrank.md](../../comparisons/newrank.md)) |

## Constraints (stop / push-forward)

**Stop and wait for human input when:**
- Any of the 115 goldens changes conformant (AD-4 — hard invariant; never
  regenerate or quarantine an existing golden).
- A fix requires changes outside the declared write-set (e.g. the ranking phase
  `dot2Rank` itself, or shape/position code).
- newrank/LEAFSET parity is unreachable even with a faithful port — keep current
  behaviour and re-scope the residual with a comparison page; do NOT regress.
- The same location is changed 3× without closing the same failing check, or 2
  consecutive gate failures on the same check.
- A declared architecture decision (AD-1/2/3/4) would be contradicted.

**Push forward with judgment when:**
- Sub-pixel / index / off-by-one corrections within the routing/ranking write-set.
- A new (non-golden) newrank/LEAFSET case reaches the oracle within tol 0.5 → pin
  and move on.
- Minor model-primitive additions required by AD-1 within the model write-set.
- Faithful-port bug fixes verified against the dot oracle.

## Operational readiness

- **Observability:** N/A — browser library, no runtime services/metrics. SLI =
  "115 goldens conformant, newrank/LEAFSET oracle pins ≤0.5pt," verified by
  `npx vitest run`.
- **Rollback:** Reversible — revert commits; goldens stay conformant so no
  data/format/output migration. New `ag*` primitives are additive.
- **Backwards compat:** Non-breaking — `renderSvg` output unchanged for every
  non-`newrank`/non-`LEAFSET` input; new model functions add signatures without
  changing existing ones.

## Links

- [decisions.md](decisions.md) — AD-1/2/3/4
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — rank-build dispatch + fill/leaf web
- [Backlog DOT-3/DOT-4](../layout-engine-backlog/gaps/dot.md)

## Session summary (2026-06-17, opus autonomous)

**Tasks completed vs planned:** 5/5 ported & green; primary objective
(end-to-end newrank parity) **NOT achieved — rescoped** (AD-4).

| Task | Commit | Result |
|------|--------|--------|
| T1 cgraph ops | 5537a0a | DONE — agnode/agsubg/agsubnode/agdelnode/agdelsubg + 9 tests |
| T2 removeFromRank | 5f91a2d | DONE — faithful inverse of install_in_rank + 4 tests |
| T5 expandLeaves | 87333d5 | DONE — faithful (reproduces position.c:1025 head−head dormant bug; net = makeLeafslots); LEAFSET ranktype never set anywhere upstream → oracle parity pinned on a leaf-heavy graph (0.0pt) |
| T3 fillRanks | 4e03a14 | DONE — realFillRanks + makeFillNode + 3 tests; clust 0-index adaptation |
| T4 removeFill | 7705284 | **RESCOPED** — removeFill ported & green; parity blocked |

**Gates (final, HEAD):** `tsc --noEmit` 0 · `vitest` 1839 pass / 0 fail (123
files) · **122 goldens conformant** · `lizard` 0 warnings on all changed
files. +25 mission tests. Baseline 1814→1839.

**Why parity is unreachable (orchestrator-verified, both outside all
write-sets):**
1. `dotRank` (rank.ts:462) gates on `flags & NEW_RANK` — a bit nothing ever
   sets — instead of `mapbool(agget(g,"newrank"))` (rank.c:523). So
   `dot2Rank`/`fillRanks` never run; removeFill is a correct no-op.
2. Patching the dispatch to read the attribute makes `renderSvg` **hang**
   (reproduced: `timeout 15` → exit 124) in `furthestNode`
   (mincross-utils.ts:161) — fill-node `order` indices make the neighbor walk
   non-terminating, inside `dotMincross` before removeFill.

The two fixes are **coupled**: landing only #1 turns wrong-but-terminating
output into a hang (a regression), so neither was landed. All five commits are
additive, non-regressing prerequisites; current default behaviour is unchanged.

**Decisions flagged for review:** T5 (dormant-bug reproduction), T4 (rescope +
merge-deferral). See decision-journal.md.

**Known issues / follow-ups (next mission):**
1. Port `mapbool(agget(g,"newrank"))` flag-set into `dotRank` (rank.ts).
2. Fix `furthestNode` non-termination with fill placeholders present
   (mincross-utils.ts / fillRanks ordering) — needs real debugging, unbounded.
3. Flip `newrank.test.ts` residual assertions to the oracle targets (c aligns
   with b ≤0.5pt).

**Merge status:** `feature/dot-newrank` NOT merged — objective unmet; merge of
prerequisite work deferred to human decision.
