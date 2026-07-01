<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: fix graphs-b15 — port C's collect + edgecmp/getmainedge grouping

## Objective

`graphs-b15` (`concentrate=true`) is `diverged`, **maxDelta 0**,
`svg/g[1][childCount]`: the port emits **147 edges vs the oracle's 153 — it
drops 6**. Diagnosis is **already complete** (prior attempt, see below). The
remaining work is the **faithful fix a prior session deferred**: port C's
`dot_splines_` edge **collect** (rank-array iteration incl. virtual
`splineMerge` nodes) so the merged secondary chains are routed, and route them
through the port's **existing** `edgecmp`-sort + `getMainEdge`-group +
`routeEdgeGroup` dispatch so **each original routes exactly once** — restoring
the 6 edges **without** the doubled-bezier regression the naive fix caused.

## Inherited diagnosis (do NOT redo)

Root cause (prior T1, preserved at
`git show fix/graphs-b15:.agent-notes/graphs-b15-concentrate-drop.md`):
`dotSplines_` (`src/layout/dot/splines.ts:521`) collects via
`g.nodes.values()` = NORMAL nodes only. `dotConcentrate`'s DOWN sweep merges the
6 back-edge chains into a **virtual** `splineMerge` node `left` that owns the 5
secondary chains' out-edges; being virtual, `left` is never visited → those
edges get no `ED_spl` → no `<g>`. C iterates the **rank array** including virtual
nodes when `splineMerge(n)` (`dotsplines.c:281-299`).

Why the prior fix was reverted (commit `a124fed`): iterating `nlist` emitted all
153 edges but **doubled ~40 beziers** (maxDelta 0→432) because it added a
*bespoke* `routeConcentrateSecondaryChain` running alongside the dispatch. Two
boolean guards failed. Conclusion: route the secondary edges **through the
existing group dispatch** (each `getMainEdge` group routed once), not a side
router.

## Confirmed present in the port (grounding)

`getMainEdge` (`splines.ts:102`), `edgecmp` (`splines.ts:218`), `groupSize`
(groups contiguous same-`getMainEdge` edges, `splines.ts:341`), and
`routeEdgeGroup`/`dispatchEdgeGroup` already exist. The dispatch skeleton is
correct — the gap is the **collect** step plus ensuring `getMainEdge`/`to_virt`
coalesces the concentrate secondary edges into their mains' group.

## Branch

`fix/graphs-b15-edgecmp` (branch from `main`). The prior `fix/graphs-b15`
branch holds the diagnosis + reverted attempt — preserved, not reused.

## Constraints

**Stop conditions**
- The doubled-bezier regression reappears (any maxDelta rise vs HEAD) and cannot
  be resolved *at the grouping level* within 3 attempts on the same site.
- Any other corpus id regresses in `survey:gate` (vs committed HEAD).
- The fix needs a file outside the declared write-set.
- The root cause of a residual traces to irreducible FP/libm — STOP with a
  controlled experiment.
- Two consecutive gate failures on the same check.

**Push-forward (decide and log)**
- Probe/instrumentation wording; journal phrasing; which concentrate graphs to
  spot-check beyond the gate.
- Whether a `getMainEdge`/`to_virt` adjustment is needed vs collect-only.
- Unit-test shape; comment/commit wording.

## Architecture decisions (AD-1…AD-5)

See [decisions.md](decisions.md). Headlines: **faithful collect port, route
through the existing group dispatch — NO bespoke secondary router, NO boolean
guard** (both failed before); **done = b15 conformant AND maxDelta ≤ HEAD** (the
432 doubled-bezier trap — count alone is not the bar); **gate vs committed HEAD**,
0 regressions.

## Quality gates

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run src/layout/dot/splines src/layout/dot/conc src/layout/dot/classify
  pass: exit 0
  on_fail: fix_and_rerun
- command: b15 re-render
  pass: 153 edge blocks, all 6 named edges present, AND compareSvg maxDelta ~0
  on_fail: stop
- command: npm run survey && npm run survey:gate   # vs committed HEAD baseline
  pass: exit 0; graphs-b15 conformant; NO id regressed (maxDelta guard)
  on_fail: stop
- command: git diff --name-only
  pass: only src/layout/dot/splines.ts (+ its .test.ts) [+ conc.ts/classify.ts
        if the mechanism implicates them], test/corpus/parity*.json, PARITY.md,
        plans/**, .agent-notes/**
  on_fail: stop
```

Note: survey npm scripts invoke a bare `tsx`; if `node_modules/.bin/tsx` is
absent, run via the npx-cached tsx with `TSX_BIN` set (decisions.md AD-1 note).

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — design the collect + grouping port | [ ] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — implement + regression baseline | [ ] | [batch-2/overview.md](batch-2/overview.md) |

## Index

- [decisions.md](decisions.md) — AD-1…AD-5
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-design-collect-grouping.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-port-collect-grouping.md) · [T3](batch-2/T3-regression-survey-gate.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- [resume.md](resume.md) — paste-ready prompt for the fresh make_regular_edge rewrite session
- Prior diagnosis: `git show fix/graphs-b15:.agent-notes/graphs-b15-concentrate-drop.md`;
  prior attempt commits `ff0a6d6..a124fed` on `fix/graphs-b15`.
- Memory: `concentrate-trunk-2559-done`, `b69-concentrate-undermerge`,
  `2361-ortho-concentrate-dedup-done`, `map-vs-nlist-iteration-hazard`,
  `byte-match-is-the-bar`, `recover-slack-and-c-harness`.
