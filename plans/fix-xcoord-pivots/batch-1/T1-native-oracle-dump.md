# T1 — Native C oracle dump

## Context
graphviz-ts is a faithful TS port of C graphviz (`~/git/graphviz`). We need the
native x-coord network-simplex ground truth to compare against the port. Native
renders `2475_2.dot` in 3.77s doing 8748 x-coord pivots; the port does 34434.
`dot -v` only prints counts (`network simplex: 26849 nodes 391709 edges 8748 iter`)
— we need the per-pivot trace and the aux-edge list.

## Task
Instrument C to dump, for the **x-coord NS call only** (the large one, balance=2,
~26849 nodes): (a) the auxiliary-graph edge list (tail→head, minlen, weight) and
(b) a per-pivot trace line `pivot#, leave_edge(tail,head), enter_edge(tail,head),
cutvalue`. Build via the /tmp object-linking recipe (ADR-1) — instrument
`lib/common/ns.c` (`leave_edge`, `enter_edge`, `update`) and
`lib/dotgen/position.c` (`create_aux_edges`), rebuild `gvplugin_dot_layout`, copy
to `/tmp/gvplugins`, run with `GVBINDIR=/tmp/gvplugins`. Gate dumps behind an env
var so only the x-coord pass (not the per-component rank passes) is emitted —
e.g. only dump when the NS node count exceeds a threshold (~200).

Capture dumps for `2475_2.dot` and for the small candidate graphs T3 will explore
(parameterize by input path).

## Write-set
- `plans/fix-xcoord-pivots/probes/native/` — probe build script(s), the C diff (as
  a patch file, NOT applied to the tracked C tree permanently), and captured dump
  files (`*.auxedges`, `*.pivots`).

## Read-set
- `~/git/graphviz/lib/common/ns.c` — `leave_edge`, `enter_edge`, `update`,
  `dfs_range`, `init_cutvalues`.
- `~/git/graphviz/lib/dotgen/position.c` — `create_aux_edges`,
  `make_LR_constraints`, `make_edge_pairs`, `nsiter2`.
- README.md (evidence), decisions.md#adr-1.

## Architecture decisions (locked)
ADR-1 (instrumentation method). Do not modify the installed graphviz; build a
local plugin into `/tmp/gvplugins`.

## Interface contract (output, consumed by T3)
```
native aux-edge dump:  one line per edge: "<tailId> <headId> <minlen> <weight>"
native pivot trace:    one line per pivot: "<i> L:<tail>-<head> E:<tail>-<head> cv:<int>"
```
Node ids must be stable/derivable so T3 can align them with the port's ids
(e.g. by rank+order or by a deterministic label).

## Acceptance criteria
- Given the instrumented plugin in `/tmp/gvplugins`, when `dot` renders
  `2475_2.dot`, then it emits an 8748-line pivot trace and the full x-coord
  aux-edge list, for the large NS pass only.
- Given any small candidate `.gv`, when rendered, then the same dump format is
  emitted (parameterized by input path).
- Given the dumps, when counted, then aux-edge count == 391709 for 2475_2
  (sanity check against known evidence).

## Observability / Rollback
N/A — offline probe. Reversible (probe files live under `plans/`; no tracked C
changes committed).

## Quality bar
Dumps are deterministic across runs for the same input. Commit the probe scripts
and a short README in `probes/native/` so the dump is reproducible.
