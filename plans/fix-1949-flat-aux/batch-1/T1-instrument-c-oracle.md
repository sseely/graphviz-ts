# T1 — Instrument the C oracle's aux graph

## Context
graphviz-ts is a faithful TS port of graphviz C (`~/git/graphviz` = read-only
spec). Corpus `1949.dot` diverges on two flat adjacent compass-port edges
routed by C `make_flat_adj_edges` (`lib/dotgen/dotsplines.c:1123`). We need
the ground-truth aux graph C builds so we can diff the port against it. The
local C build is currently broken (incremental cmake won't recompile
`position.c`/`libdotgen`).

## Task
1. Clean-rebuild native graphviz per AD-1: `rm -rf ~/git/graphviz/build &&
   cmake -S ~/git/graphviz -B ~/git/graphviz/build … && make -C
   …/build dot`. Verify a temp `fprintf` in a dotgen file actually reaches
   the binary (`strings … | grep`).
2. Regenerate the headless oracle: `npm run survey:setup` (rebuilds
   `/tmp/ghl` symlinks to the fresh plugins).
3. Add temp `fprintf` in `make_flat_adj_edges` (guarded by
   `getenv("DBG1949")`) dumping, for the structParty↔structDefaultAuto group:
   - each aux node: name it was cloned from, rank, order, `ND_coord`
     (before AND after the reposition block)
   - each aux edge: tail/head node, `ED_tail_port`/`ED_head_port` `.defined`,
     `.side`, `.p`
   - after `dot_splines_(auxg,0)`: each aux edge's spline `size` + all control
     points
   - the `del` used and `GD_flip(g)`
4. Run `DBG1949=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg
   ~/git/graphviz/tests/1949.dot >/dev/null` and capture the dump.

## Write-set
- None committed. Temp C instrumentation in
  `~/git/graphviz/lib/dotgen/dotsplines.c` — **revert with `git -C
  ~/git/graphviz checkout` when T2 is done**.

## Read-set
- `~/git/graphviz/lib/dotgen/dotsplines.c:1123-1290` (make_flat_adj_edges)
- `.agent-notes/1949-diagnosis.md` (D1 section — the flat-adj findings)
- `plans/fix-1949-flat-aux/decisions.md#ad-1`

## Interface contract (consumed by T2)
A plain-text dump with, for each of the two aux edges:
`{ auxTailName, auxHeadName, tailPort:{side,p}, headPort:{side,p},
splineSize, controlPoints:[{x,y}...] }`, plus `auxt/auxh` rank+coord
(pre/post reposition) and `del`, `flip`.

## Acceptance criteria
- Given the clean rebuild, when a temp string is added to dotgen, then
  `strings build/cmd/dot/dot` finds it (build actually recompiles).
- Given `DBG1949=1` on 1949, when C runs, then the dump prints both aux edges'
  ports and spline control points.
- Given the dump, then it is pasted verbatim into `decision-journal.md` for
  T2 to diff against.

## Observability
N/A — no new observable operations (temporary diagnostic only).

## Rollback
Reversible. Revert C instrumentation via git checkout in `~/git/graphviz`.

## Quality bar
No committed changes. The C repo returns to a clean `git status` after T2.
