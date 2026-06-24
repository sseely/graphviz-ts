<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: fix 2-cycle back-edge double-count in class2

## Objective

Fix a base-layout bug: for a **2-cycle** (mutual edges `a→b` and `b→a`), the
port's `class2` creates a **duplicate** fast edge where native dot has one merged
edge. This perturbs the x-coordinate network-simplex constraint graph, so any
graph with 2-cycles diverges in its within-rank arrangement. Found while
investigating NaN's `ratio=compress` residual (T6/T7) — but it has **nothing to
do with compress or ratio**; it affects cyclic digraphs generally.

## Root cause (pinned + fix proven)

`class2`'s back-edge handler `handleBackEdge` (`src/layout/dot/classify.ts:373`)
looks for the *opposite forward edge* of a back edge by iterating the local
`outEdges(e.head)` helper — which returns the **fast graph** (`n.info.out`). C's
class2 (`lib/dotgen/class2.c:259`) iterates the **original cgraph** out-edges
(`agfstout(g, aghead(e))`).

Consequence for a 2-cycle back edge `b→a`: the port's `opp` is the *fast* edge
`a→b`, whose `to_virt` is `undefined` (fast edges have no `to_virt`). So the
guard `if (opp.info.to_virt === undefined) makeChain(opp)` in `tryOppEdge`
wrongly fires, building a **redundant second chain** and merging the back edge
into it — leaving the original `a→b` as a stray edge. C's `opp` is the *original*
forward edge, whose `to_virt` is already set (it was chained when the forward
edge was processed), so C skips `make_chain` and merges into the existing edge.

**Verified:** after class2 the port's node `a` has two fast out-edges
`a→b(w1)` and `a→b(w2)`; C has one `a→b(w2)`.

## The fix (confirmed on the repro)

In `handleBackEdge`, iterate the **original** out-edges, exactly as `class1`
already does (`classify.ts:144` uses `n.outEdges(g)`):

```ts
function handleBackEdge(g: Graph, e: Edge): Edge | undefined {
  for (const opp of e.head.outEdges(g)) {   // was: outEdges(e.head)  (fast graph)
    if (tryOppEdge(g, e, opp)) return undefined;
  }
  makeChain(g, e.head, e.tail, e);
  return e;
}
```

Then **remove the now-unused local `outEdges` helper** (`classify.ts:347`), the
only other user.

**Candidate-fix results (already measured):**
- minimal repro `digraph{a->b;b->a}` → node positions **byte-match** (was a
  duplicate edge); `make_edge_pairs` 1 `a→b w2` like C.
- `NaN` (uncompressed): max node displacement **1784 → 43**, median **691 → 0**.
- typecheck passes.

## Branch
`feature/fix-2cycle-backedge` (from `main`; do not work on `main`).

## Acceptance canary
1. `digraph{a->b;b->a}` renders **byte-identical** to native dot.
2. `NaN` / `1447_1` maxDelta drop sharply (NaN node arrangement median → ~0; a
   small residual may remain — e.g. NaN `Trap` ~43 — that is a *separate*
   smaller issue, not this bug).

## Constraints

**STOP if:**
- Any survey **regression** (this changes back-edge handling shared by *every*
  cyclic digraph — the blast radius is the whole corpus, not just 2-cycles).
- The fix needs to touch `tryOppEdge`/`makeChain`/`mergeChain` logic beyond the
  one-line edge-source change + helper removal (it should not — C's structure is
  identical once `opp` is the original edge).
- Two consecutive quality-gate failures on the same check.

**PUSH FORWARD (decide and log):**
- The NaN residual (`Trap` ~43) stays — out of scope; capture as follow-up.
- Adding 2-cycle goldens and back-edge tests.

## Quality gates

| command | pass |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0, all green |
| `~/.claude/hooks/.venv/bin/lizard src/layout/dot/classify.ts -C 10 -w` | no warnings |
| survey: `npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts` | diff vs `/tmp/parity.before.json`: **0 regressions; NaN/1447_1 + other 2-cycle graphs improve** |

Baseline first: `cp test/corpus/parity.json /tmp/parity.before.json`.

## Batches
| Batch | Task | Status |
|---|---|---|
| 1 | [T1 — back-edge uses original out-edges](batch-1/T1-backedge-original-edges.md) | [x] commit `c8781c5` |

## Outcome (2026-06-24) — COMPLETE

T1 shipped (`c8781c5`). `handleBackEdge` now iterates `e.head.outEdges(g)`
(original cgraph edges); dead `outEdges` helper removed. Faithful: minimal repro
+ fix-sensitive golden byte-match native; 167 aux-edge count 9==C. **Corpus: 16
graphs diverged→structural-match, 0 verdict regressions** (cyclic graphs: dfa,
dpd, ngk10_4, overlap, neato spline graphs). NaN arrangement → native (maxDelta
1907→679; stays diverged here only because compress is a separate branch).
Accepted: 167/2087 +~9pt maxDelta, same bucket — a separate masked divergence
the now-correct arrangement exposes (their constraint graphs match C), not a
regression. typecheck 0 · npm test 2375 · lizard clean.

## Docs
- [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
- [batch-1/overview.md](batch-1/overview.md) · [diagrams/component-map.md](diagrams/component-map.md)

## C references
- `lib/dotgen/class2.c:256-282` — backward-edge block: `for (opp = agfstout(g, aghead(e)); …)` (original edges), `if (ED_to_virt(opp)==NULL) make_chain(opp)`, `merge_chain(e, ED_to_virt(opp))`.
- `lib/dotgen/class1.c` — `class1` iterates original out-edges (the port mirrors this at classify.ts:144).
