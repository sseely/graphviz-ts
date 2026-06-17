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
  pass: exit 0 AND failed == 0 AND 115 goldens byte-identical
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1814 passed / 0 failed, 115 goldens byte-identical**
(main, post-DOT-1b). Oracle: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins`.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 cgraph primitives](batch-1/T1-cgraph-ops.md) · [T2 removeFromRank](batch-1/T2-remove-from-rank.md) · [T5 expandLeaves](batch-1/T5-expand-leaves.md) | [x] |
| 2 (after T1) | [T3 fillRanks](batch-2/T3-fill-ranks.md) | [ ] |
| 3 (after T1,T2,T3) | [T4 removeFill + parity](batch-3/T4-remove-fill.md) | [ ] |

## Constraints (stop / push-forward)

**Stop and wait for human input when:**
- Any of the 115 goldens changes byte-for-byte (AD-4 — hard invariant; never
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
  "115 goldens byte-identical, newrank/LEAFSET oracle pins ≤0.5pt," verified by
  `npx vitest run`.
- **Rollback:** Reversible — revert commits; goldens stay byte-identical so no
  data/format/output migration. New `ag*` primitives are additive.
- **Backwards compat:** Non-breaking — `renderSvg` output unchanged for every
  non-`newrank`/non-`LEAFSET` input; new model functions add signatures without
  changing existing ones.

## Links

- [decisions.md](decisions.md) — AD-1/2/3/4
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — rank-build dispatch + fill/leaf web
- [Backlog DOT-3/DOT-4](../layout-engine-backlog/gaps/dot.md)
