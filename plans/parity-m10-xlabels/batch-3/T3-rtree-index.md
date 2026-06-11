# T3 — src/label/index.ts: R-tree public API

## Context

graphviz-ts lib/label port (mission 10), batch 3. T1 (rectangle.ts) and
T2 (node.ts, split-q.ts) are landed — import them. C is the spec; SPDX;
@see cites; strict TS. Hook rule: ≤2 attempts per file.

## Task

Port `lib/label/index.{h,c}` (~319 lines) into NEW src/label/index.ts:
RTree_t (root + SplitQ state), RTreeOpen, RTreeClose, RTreeNewIndex,
RTreeInsert (with the recursive insert + root-split path), RTreeSearch
(returns LeafList_t in C — port the Leaf/LeafList shapes; an array is
acceptable ONLY if iteration order is proven identical to C's
list-cons order, which prepends — document whichever you keep),
RTreeLeafListFree (no-op in GC'd TS — keep a documented stub or omit
with an @see note; do not invent extra lifecycle).

NOTE the C list-cons detail: RTreeSearch builds the leaf list by
prepending, so C iteration order is REVERSED insertion-hit order. The
consumer (xlabels.c) iterates that list — order is load-bearing for
placement. Pin it in a test.

TDD: failing tests first in src/label/rtree-index.test.ts.

## Write-set

src/label/index.ts (new), src/label/rtree-index.test.ts (new).
Nothing else.

## Read-set

~/git/graphviz/lib/label/index.{h,c}; src/label/rectangle.ts;
src/label/node.ts; src/label/split-q.ts;
~/git/graphviz/lib/label/xlabels.c:493-548 (how the consumer calls
Search/Insert — shapes only)

## Interface contract (consumed by T4)

Exported: `RTree`, `rTreeOpen()`, `rTreeClose`, `rTreeInsert(rtree,
rect, data) -> root updated`, `rTreeSearch(rtree, node, rect) ->
leaf list` (order pinned as C's). `Leaf = { rect, data }`.

## Acceptance criteria

- Given N inserted rects forcing ≥1 split, when searched with a query
  covering a known subset, then the hit set AND iteration order match
  the C list-cons order (pinned fixture)
- Given inserts past root overflow, then tree height grows as C
  (root split path exercised in a test)
- Existing suite 0 failed

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T3): port lib/label R-tree index API`
