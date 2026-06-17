# Mission: DOT-newrank-2 — finish newrank rank reconciliation (faithful)

## Objective

Make `newrank=true` reconcile cross-cluster `rank=same` constraints to match the
`dot` oracle, completing what `mission-dot-newrank` rescoped. The prerequisites
(cgraph ops, `removeFromRank`, `fillRanks`/`realFillRanks`, faithful `removeFill`)
are already on `main`. This mission fixes the two verified blockers and reaches
oracle parity — **derived from a deep study of the C control flow**, so the fix
is a faithful port, not a mark-guard patch.

## Verified diagnosis (orchestrator probes, 2026-06-17)

Repro: `digraph{newrank=true; subgraph cluster0{a->b->e} subgraph cluster1{c->d}
a->c; {rank=same; b; c}}`. Oracle: `a=-178, b=-106, e=-34, c=-106 (= b), d=-34`.

1. **Dispatch bug** — `dotRank` (`rank.ts:462`) gates on a never-set `NEW_RANK`
   bit instead of `mapbool(agget(g,"newrank"))` (C `rank.c:523`). So
   `dot2Rank`/`fillRanks` never run. **1-line faithful fix.**
2. **Hang** — with #1 fixed, `renderSvg` hangs in `furthestNode`
   (`mincross-utils.ts:161`). Root cause: node `c` is installed **twice** into
   root rank 1 — once by root `buildRanks`, once by `cluster0`'s `expandCluster`
   `buildRanks` (the `{rank=same; b; c}` union drags `c`, which is in cluster1,
   into cluster0's component). `neighborNode` then bounces `c`→`c` forever.
   Diagnostic: `orders=[c@1,c@1,null]`; two `PLACE c` stacks (root + `cluster.ts:201`).
3. **File-size debt** — `src/layout/dot/mincross-build.ts` is 529 lines, over the
   500-line hook cap (T3 subagent bypassed the main-session hook). Must be split
   before in-session edits.

## Strategy — faithful-first

The fix for #2 is **not** a bolt-on mark-guard. Batch 1 produces a written
C-vs-TS control-flow trace (`docs/newrank-c-trace.md`) pinpointing exactly where
the TS port diverges from how C routes a cluster node that is also in a
cross-cluster `rank=same` set (collapse / `class2` / `decompose` / `build_ranks`
/ `install_cluster`). Batch 2's fix restores C's behaviour, cited line-by-line.

## Branch

`feature/dot-newrank-2` off `main`. Merge back with a **merge commit** when gates
pass (or on a bounded rescope).

## Execution model

Run with **opus** (`claude-opus-4-8`, native 1M context).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND 122 goldens byte-identical
  on_fail: fix_and_rerun
- command: lizard <changed files> -C 10 -L 30 -a 5   # binary at /opt/anaconda3/bin/lizard
  pass: no violations (30 lines/fn, CCN 10, 5 params)
- command: wc -l <changed .ts files>
  pass: every file <= 500 lines (the check-complexity.py hook cap)
  on_fail: split before committing
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start (main): **1839 passed / 0 failed, 122 goldens
byte-identical**. Oracle: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins`. Repro file: `/tmp/newrank-repro.dot`.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 0 | [T0 split mincross-build.ts](batch-0/T0-split-mincross-build.md) | [ ] |
| 1 (after T0) | [T1 deep C control-flow trace](batch-1/T1-c-trace.md) | [ ] |
| 2 (after T1) | [T2 dispatch fix](batch-2/T2-dispatch.md) · [T3 faithful double-install fix](batch-2/T3-faithful-fix.md) | [ ] |
| 3 (after T2,T3) | [T4 oracle parity + corpus](batch-3/T4-parity.md) | [ ] |

## Constraints (stop / push-forward)

**Stop and wait for human input when:**
- Any of the 122 goldens changes byte-for-byte (AD-2 — hard invariant).
- The faithful fix would require changes **outside** the allowed write-set
  `{rank.ts, rank-dot2.ts, mincross-build.ts (+ its split modules),
  mincross-order.ts, mincross-utils.ts, cluster.ts, classify.ts, decomp.ts}`
  (AD-3).
- Reaching parity needs **more than 3 distinct logic fixes** beyond the dispatch
  fix (AD-3 cap) — stop, land what's safe, rescope the residual.
- The C trace (T1) shows the divergence is in a phase not in the allowed set
  (e.g. position/splines) — stop and rescope with the trace as the artifact.
- The same location is changed 3× without closing the same check, or 2
  consecutive gate failures on the same check.

**Push forward with judgment when:**
- The C trace unambiguously identifies a faithful one-line/one-branch divergence
  within the allowed write-set — port it and verify against the oracle.
- Sub-pixel / index / off-by-one parity corrections within the write-set.
- A new (non-golden) newrank case reaches the oracle within tol 0.5 → pin.

## Operational readiness

- **Observability:** N/A — browser library, no runtime services. SLI = "122
  goldens byte-identical; newrank repro reproduces oracle (`c` aligns with `b`,
  ≤0.5pt); newrank renders without hanging," verified by `npx vitest run`.
- **Rollback:** Reversible — revert commits; goldens stay byte-identical (no
  data/format/output migration). newrank is attr-gated.
- **Backwards compat:** Non-breaking — `renderSvg` output unchanged for every
  non-`newrank` input. Turning on the dispatch changes behaviour ONLY for
  graphs that set `newrank=true`.

## Links

- [decisions.md](decisions.md) — AD-1..4
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — newrank rank-build path
- [comparisons/newrank.md](../../comparisons/newrank.md) — prior-mission residual (now being closed)
- [Backlog DOT-3](../layout-engine-backlog/gaps/dot.md)
