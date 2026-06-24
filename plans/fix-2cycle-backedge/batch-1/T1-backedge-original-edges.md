<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — back-edge handler iterates original out-edges

## Context

Faithful TS port of C Graphviz (`~/git/graphviz` is the spec). Browser-safe ESM:
no `fs`/`path`/`process`; import paths end in `.js`. Strict TS, no `any`. EPL
header on every file. JSDoc `@see` to C origin. vitest colocated, concrete
assertions. Complexity hook: file ≤500 lines, CCN ≤10, ≤5 params.

`class2`'s back-edge handler finds the opposite forward edge of a back edge by
iterating the **fast graph** (`n.info.out`), but C iterates the **original
cgraph** out-edges (`agfstout`). For a 2-cycle this duplicates the merged edge
(see README root cause). The fix is one line + removing a now-dead helper. It is
already proven on the repro.

## Task

1. In `handleBackEdge` (`src/layout/dot/classify.ts:373`), change
   `for (const opp of outEdges(e.head))` →
   `for (const opp of e.head.outEdges(g))` — the original cgraph out-edges, as
   `class1` already does (classify.ts:144). @see class2.c:259 `agfstout(g, aghead(e))`.
2. Remove the now-unused local `outEdges` helper (`classify.ts:347`); it had no
   other caller. (Verify with grep before deleting.)
3. Do **not** change `tryOppEdge`, `makeChain`, `mergeChain`, or
   `oppEdgeConcOrMerge` — they already mirror C once `opp` is the original edge
   (ADR-2).

## Write-set
- `src/layout/dot/classify.ts` — the two changes above
- `src/layout/dot/classify.test.ts` — tests (create if absent; else append)

## Read-set
- `decisions.md` (ADR-1/-2/-4)
- `src/layout/dot/classify.ts:343-389` (`outEdges`, `tryOppEdge`, `handleBackEdge`, `class2EdgeSameRep`)
- `src/layout/dot/classify.ts:141-146` (`class1` original-edge iteration — the pattern to match)
- `~/git/graphviz/lib/dotgen/class2.c:256-282` (backward-edge block)
- `src/model/node.ts` — `Node.outEdges(g)` (original cgraph out-edges)

## Acceptance (Given/When/Then)
- Given `digraph{a->b;b->a}`, when laid out, then node positions are
  byte-identical to native dot (no duplicate `a→b` fast edge; `make_edge_pairs`
  yields one `a→b` weight-2 edge).
- Given `graphs/NaN.gv`, then within-rank node displacement vs native collapses
  (median → ~0; was 691); maxDelta drops sharply from 1601.
- Given any non-cyclic graph, then output is byte-identical to before.
- Given the full survey vs `/tmp/parity.before.json`: **0 regressions**; the
  2-cycle graphs (NaN ×3, 1447_1, …) improve.

## Tests
- 2-cycle golden: `digraph{a->b;b->a}` byte-matches native (oracle-pinned).
- A back-edge regression case (a longer cycle, e.g. `a->b->c->a`) stays correct.
- Optional: assert post-`class2` that a 2-cycle node has a single merged fast
  out-edge (weight 2), if a unit hook is convenient.

## Quality bar
`npm run typecheck` + `npm test` green; lizard clean on `classify.ts`; survey
gate (overview). Commit:
`fix(dot): merge 2-cycle back-edge instead of duplicating it`
(body: class2 back-edge handler must iterate original cgraph out-edges like C's
agfstout, not the fast graph; one stray edge per 2-cycle perturbed the x-NS;
NaN/1447_1 improve; 0 regressions).
