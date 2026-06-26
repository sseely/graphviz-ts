# T1 — Instrument C x-coord NS; dump 4-stage oracle

## Context
graphviz-ts ports native dot layout. honda-tokoro's only divergence is the
x-coordinate (cross-rank) network simplex resolving weight=0 slack differently
than C. We need C's ground-truth NS trace before touching the port. The x-coord
NS is `rank(g, 2, …)` in `lib/dotgen/position.c:142` (balance mode 2 →
`LR_balance` in `lib/common/ns.c`). See [README](../README.md) and
[decisions.md](../decisions.md) (ADR-2).

## Task
Add temporary stderr instrumentation to the native C x-coordinate network
simplex and capture a 4-stage dump for honda-tokoro:
1. **Aux graph** — every aux node and aux edge with `ED_weight`, `ED_minlen`
   (the input to the x-coord NS, built by `create_aux_edges`).
2. **Pivot sequence** — each NS iteration's leave-edge and enter-edge (in
   `rank()`/`enter_edge`/`leave_edge` in ns.c).
3. **Pre-balance x** — `ND_rank` (= x in the aux problem) of every real node
   right BEFORE `LR_balance` runs.
4. **Post-balance x** — same after `LR_balance`.

Gate all dumps behind an env var (e.g. `getenv("DBG_XNS")`) so normal runs are
unaffected. Map aux/virtual node IDs back to original node names where possible
(print `agnameof` for real nodes; a stable synthetic id for virtuals).

## Build & run
```
cmake --build ~/git/graphviz/build --target gvplugin_dot_layout dot
sh test/corpus/gen-headless-gvbindir.sh        # regen /tmp/ghl
DBG_XNS=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg \
  ~/git/graphviz/tests/graphs/honda-tokoro.gv >/dev/null 2>plans/xcoord-ns-degeneracy/oracle/c-dump.txt
```

## Write-set
- `~/git/graphviz/lib/dotgen/position.c` (temp instrument)
- `~/git/graphviz/lib/common/ns.c` (temp instrument)
- `plans/xcoord-ns-degeneracy/oracle/c-dump.txt` (create)

## Read-set
- `lib/dotgen/position.c:80-150` (dot_position, create_aux_edges, rank calls)
- `lib/common/ns.c` — `rank`, `enter_edge`, `leave_edge`, `LR_balance`
- `lib/dotgen/position.c:make_aux_edge` (aux edge weight/len)

## Output interface (consumed by T2)
`oracle/c-dump.txt`, four labelled sections:
```
[AUX] node <id> | edge <u>-><v> w=<weight> minlen=<minlen>
[PIVOT] iter <i> leave=<u>-><v> enter=<u>-><v>
[PREBAL] <name> x=<int>
[POSTBAL] <name> x=<int>
```

## Acceptance criteria
- Given honda-tokoro, when instrumented C runs with `DBG_XNS=1`, then
  `c-dump.txt` contains all four sections.
- Given the dump, when node IDs are inspected, then every real node n000..n022
  appears in PREBAL and POSTBAL with integer x.
- Given a normal run (no `DBG_XNS`), then SVG output is unchanged (instrument is
  env-gated, side-effect-free).

## Observability
N/A — diagnostic instrumentation only.

## Rollback
Reversible. C edits are temporary; reverted in T4 (`git checkout` the C files +
clean rebuild). Do NOT leave instrumentation in the oracle for the survey.

## Boundaries
- Never do: change C layout logic; only add env-gated dumps.
- Always: keep the dump deterministic and node-name-mappable.
