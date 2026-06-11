# T2 — src/label/node.ts + split-q.ts: R-tree nodes and quadratic split

## Context

graphviz-ts lib/label port (mission 10), batch 2. T1 landed
src/label/rectangle.ts (Rect flat-array + ops) — import it, don't
re-port. C is the spec; SPDX headers; JSDoc @see cites; strict TS.
Suite baseline 1138/0 plus T1's tests.

Hook rule: smallest fix, at most 2 attempts per file, then move on.

## Task

Port `lib/label/node.{h,c}` (~225 lines: Node/Branch types, NODECARD=64
per AD3, InitNode/InitBranch/AddBranch/DisconnectBranch/PickBranch,
node-level combine/cover) and `lib/label/split.q.{h,c}` (~381 lines:
SplitQ_t state, SplitNode, PickSeeds, Classify, LoadNodes, GetBranches
— the Guttman quadratic splitter) into NEW src/label/node.ts and
src/label/split-q.ts.

node.c and split.q.c are mutually recursive (AddBranch overflow →
SplitNode → re-adds branches). If TS module cycles bite, a structural
deviation is pre-authorized (push-forward, report it): e.g. move the
shared types to node.ts and have split-q.ts import one-way, or extract
a types-only module — preserve C function boundaries and names inside
whichever file they land in.

TDD: failing tests first in src/label/node-splitq.test.ts. The key
fixture: insert NODECARD+1 known branches, trigger a split, assert the
two partitions (membership AND cover rects) match C exactly. Derive
the expectation by reading the C algorithm (PickSeeds maximizes wasted
area; Classify greedy by area increase) and hand-tracing a small
fixture — pick rects where the trace is unambiguous.

## Write-set

src/label/node.ts (new), src/label/split-q.ts (new),
src/label/node-splitq.test.ts (new). Nothing else (rectangle.ts is
read-only).

## Read-set

~/git/graphviz/lib/label/node.{h,c}; ~/git/graphviz/lib/label/
split.q.{h,c}; ~/git/graphviz/lib/label/index.h (types/NODECARD);
src/label/rectangle.ts (T1 output)

## Interface contract (consumed by T3)

Exported from node.ts: `Node`, `Branch` types (NODECARD-sized branch
array, count, level), `initNode`, `addBranch`, `disconnectBranch`,
`pickBranch`, `nodeCover`. From split-q.ts: `splitNode`. Semantics
byte-faithful to C.

## Acceptance criteria

- Given NODECARD branches and one more added, when addBranch, then
  splitNode partitions exactly as the hand-traced C run (membership +
  covers)
- Given a node with children, when pickBranch(rect), then the chosen
  branch index matches C's least-enlargement rule incl. tie-breaking
  order
- Given the existing suite, then 0 failed (no behavior change outside
  src/label/)

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T2): port lib/label R-tree node and quadratic splitter`
