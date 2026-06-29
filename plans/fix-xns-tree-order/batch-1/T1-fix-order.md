<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Match C's subtree-merge add order

## Context
T0 pinned the first `addTreeEdge` order divergence and the C rule that produces
C's pick. Read T0's Output block in
`.agent-notes/b51-blok60-is-xcoord-ns-selection.md`. Apply the minimal change that
makes the port's subtree-merge emit `addTreeEdge` calls in C's order. The C source
is the spec; preserve C's function boundaries and iteration order exactly.

## Task
Modify the `fixTarget` named by T0 so the port's `Tree_edge` order matches C for
share-b51. Add/extend a unit test that locks the corrected order (or a direct
assertion on blok_60's resulting x). Keep the change minimal and C-faithful.

## Read-set
- T0 Output in `.agent-notes/b51-blok60-is-xcoord-ns-selection.md`
- The C function T0 named (in `~/git/graphviz/lib/common/ns.c`)
- `src/layout/dot/ns-subtree.ts` (the merge functions), `ns-core.ts:addTreeEdge`
- Existing tests: `ns-range.test.ts`, `ns-subtree.test.ts` (pattern to follow)

## Write-set
- The NS file T0 named (`ns-subtree.ts` and/or `ns-core.ts`).
- A unit test asserting the corrected order / blok_60 outcome.
- Do NOT touch `ns.ts` (`lrBalance`/`enterEdge` are correct given right order).

## Acceptance (Given/When/Then)
- Given share-b51 rendered by the port, when blok_60's center x is read, then it
  equals **611.38** (NS rank 463), matching C.
- Given share-b51, when `flat-geom-diff.mjs` compares C vs port, then blok_60's
  per-element delta is 0 and the graph maxΔ drops well below 158 (ideally the
  secondary ~26-30px nodes also resolve, since they are the same class).
- Given the change, when `npx tsc --noEmit` runs, then exit 0.
- Given the change, when the NS unit tests run, then all pass (and the new
  order-locking test passes).

## Verify (commands)
```
gv=~/git/graphviz/tests/share/b51.gv
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts "$gv" dot > /tmp/b51-fix.svg
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg "$gv" > /tmp/b51-c.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/b51-c.svg /tmp/b51-fix.svg | head -20
```
Optionally re-instrument XNSDBG (revert after) to confirm `Tree_edge` order now
matches and blok_60 reaches 463 after LR_balance.

## Boundaries
- **Stop** if blok_60 does not reach 611.38 after matching the add order — the
  divergence is deeper than T0 thought (dfsRange lim / createAuxEdges). Log to
  decision-journal, do not force-fit.
- **Stop** if the fix requires editing outside the NS files.
- Preserve C's exact comparison/iteration; no "cleaner" reordering that changes
  behavior.

## Observability / Rollback
N/A runtime. Reversible — single commit, revert to undo. Survey gate (T2) is the
safety net.

## Commit
One commit: `fix(ns): match C tight_tree edge-add order for x-coord balance`
(reference share-b51 blok_60 + the 2371 class in the body).

## Quality bar
`tsc --noEmit` clean + NS unit tests green + blok_60 == 611.38 BEFORE committing.
Do not run the full survey here — that is T2.
