<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Match C's L→U routing

## Context
T0 pinned the first divergent stage in L→U routing and named the C rule + fix
locus. Read T0's Output block in `.agent-notes/graphs-mike-LtoU-routing.md`.
Apply the minimal change that makes the port route L→U like C (C path:
`M387.79,-434.5C377.94,-424.92 364.85,-412.19 353.68,-401.34`, 8 pts). The C
source is the spec; preserve C's function boundaries and order exactly.

## Task
Modify the `fixTarget` named by T0 so L→U is conformant with C on `mike.gv`. Add
a routing test that locks L→U's piece count + geometry against the C oracle.
Keep the change minimal and C-faithful (no rewrite of the routing pipeline).

## Read-set
- T0 Output in `.agent-notes/graphs-mike-LtoU-routing.md`
- The C function T0 named (in `~/git/graphviz/lib/dotgen/dotsplines.c` or
  `lib/common/routespl.c`)
- The port `fixTarget` file + its existing tests (pattern to follow)
- `decisions.md` (faithful-port + conformant bar)

## Write-set
- The file T0 named (`fixTarget`).
- A routing `*.test.ts` (extend an existing routing test or add one): render
  `mike.gv`, assert edge L→U's `<path d>` matches the C oracle (8 pts,
  `M387.79,-434.5…`) and that the fix is sensitive (fails pre-fix).
- Do NOT touch x-coord / mincross / node-placement code (out of scope per T0
  stop-condition).

## Acceptance (Given/When/Then)
- Given mike.gv rendered by the port, when edge L→U's path is read, then it is
  conformant with C (±0.01; 8 points, start `M387.79,-434.5`).
- Given mike.gv, when the full graph is compared to the oracle, then K→L's maxΔ
  also drops (shared node L) and the graph maxΔ falls well below 72.
- Given the change, when `npx tsc --noEmit` runs, then exit 0.
- Given the change, when the routing test suite runs, then all pass (incl. the
  new L→U lock), and the 115 no-side-port goldens stay unchanged.

## Verify (commands)
```
gv=~/git/graphviz/tests/graphs/mike.gv
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts "$gv" dot > /tmp/mike-fix.svg
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg "$gv" > /tmp/mike-c.svg
# compare L->U path d in both
```

## Boundaries
- **Stop** if L→U is not conformant after the pinned fix — divergence is deeper
  than T0 thought. Log to decision-journal; do not force-fit.
- **Stop** if the fix requires editing outside the file T0 named.
- Preserve C's exact comparison/iteration; no behavior-changing "cleanup".

## Observability / Rollback
N/A runtime. Reversible — single commit, revert to undo. Survey gate (T2) is the
safety net.

## Commit
One commit: `fix(splines): match C L→U routing for graphs-mike` (reference the
piece-count divergence + share/windows-mike in the body).

## Quality bar
`tsc --noEmit` clean + routing tests green + L→U conformant BEFORE committing.
Do not run the full survey here — that is T2.
