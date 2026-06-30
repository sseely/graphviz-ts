<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Match C's ldbxtried horizontal layout

## Context
T0 pinned the first divergent stage in ldbxtried's horizontal layout and named
the C rule + fix locus. Read T0's Output block in
`.agent-notes/ldbxtried-xdivergence.md`. Apply the minimal change that makes the
port lay out node X like C (e.g. n454 → x=772.89; n518 ordered rightmost in rank
y=−38). The C source is the spec; preserve C's function boundaries and order.

## Task
Modify the `fixTarget` named by T0 so ldbxtried node X (and the dependent edge
paths) are conformant with C on `ldbxtried.gv`. Add a test that locks node X
(and, if the cause was ordering, the within-rank order) against the C oracle.
Keep the change minimal and C-faithful (no rewrite of the mincross/position
pipeline).

## Read-set
- T0 Output in `.agent-notes/ldbxtried-xdivergence.md`
- The C function T0 named (in `mincross.c` / `position.c` / `ns.c` / `cluster.c`)
- The port `fixTarget` file + its existing tests (pattern to follow)
- `decisions.md` (faithful-port + conformant bar; bsd-qsort precedent)

## Write-set
- The file T0 named (`fixTarget`).
- A `*.test.ts` (extend an existing cluster/mincross/position test or add one):
  render `ldbxtried.gv`, assert the affected nodes' X match the C oracle (n454
  772.89, n449 543.89, n518 642.89, …) and — if T0 found a reorder — assert the
  rank y=−38 L→R order is `n526,n513,n518`. Ensure the test is sensitive (fails
  pre-fix).
- Do NOT touch rank-assignment (Y) or edge-spline-routing code unless T0's
  fixTarget is there (out of scope per T0 stop-condition).

## Acceptance (Given/When/Then)
- Given ldbxtried rendered by the port, when node X is read, then all 32 nodes
  match C within ±0.01 (incl. n454/n449/n518).
- Given ldbxtried, when full paths are compared to the oracle, then graph maxΔ
  falls below 0.5 and the n518 within-rank order matches C.
- Given the change, when `npx tsc --noEmit` runs, then exit 0.
- Given the change, when the touched test suite runs, then all pass (incl. the
  new ldbxtried lock), and existing cluster / mincross / position goldens are
  unchanged.

## Verify (commands)
```
gv=~/git/graphviz/tests/graphs/ldbxtried.gv
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts "$gv" dot > /tmp/ld-fix.svg
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg "$gv" > /tmp/ld-c.svg
# compare node cx for n454/n449/n518 in both
```

## Boundaries
- **Stop** if ldbxtried node X is not conformant after the pinned fix —
  divergence is deeper than T0 thought. Log to decision-journal; do not force-fit.
- **Stop** if the fix requires editing outside the file T0 named.
- Preserve C's exact comparison / iteration; no behavior-changing "cleanup".

## Observability / Rollback
N/A runtime. Reversible — single commit, revert to undo. Survey gate (T2) is the
safety net.

## Commit
One commit: `fix(<scope>): match C ldbxtried cluster x-layout` (reference the
node-X / ordering divergence + share/windows-ldbxtried in the body). Scope =
the real locus T0 named (e.g. `mincross` / `position`), not a guess.

## Quality bar
`tsc --noEmit` clean + touched tests green + ldbxtried node X conformant BEFORE
committing. Do not run the full survey here — that is T2.
