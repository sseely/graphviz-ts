# T3 — Faithful fix for the cross-cluster double-install

## Context

With the dispatch fixed (T2), `newrank=true` on the repro hangs because node `c`
is installed twice into root rank 1 (root `buildRanks` + cluster0
`expandCluster` `buildRanks`). T1's `docs/newrank-c-trace.md` identifies the
exact place the TS port diverges from C (which installs `c` once). This task
ports that C behaviour faithfully.

## Task

Implement the minimal faithful change named in `docs/newrank-c-trace.md`,
restoring C's single-install routing for a cluster node that is also in a
cross-cluster `rank=same` set. Cite the C `file:line` in the code comment. Do
NOT add a generic dedup/mark-guard unless T1's trace shows that IS what C does
at that point.

The write-set is the ONE file T1 names (within AD-3's allowed set). If T1 names
a change that needs >1 file or a 2nd distinct fix surfaces, follow AD-3: at most
3 distinct logic fixes total beyond the dispatch; STOP and rescope if exceeded.

## Write-set

- The file named by T1 (one of: `rank-dot2.ts`, `classify.ts`, `decomp.ts`,
  `cluster.ts`, `mincross-build.ts`/its split modules, `mincross-order.ts`,
  `mincross-utils.ts`) + its colocated `.test.ts`

## Read-set

- `docs/newrank-c-trace.md` (the named fix — primary)
- `decisions.md#ad-1`, `#ad-3`
- The C function(s) T1 cites
- `/tmp/newrank-repro.dot`; oracle via `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot`

## Acceptance criteria

- **Given** the repro with `newrank=true`, **when** rendered, **then** it
  terminates (no hang) and root rank 1's `v[]` contains `c` exactly once (no
  duplicate; `order` indices consistent with array positions).
- **Given** a unit test on the named function, **then** the cross-cluster
  `rank=same` node is routed/installed exactly once (assert the rank array / the
  install path directly).
- **Given** the 122 goldens, **then** conformant.
- Full oracle-coordinate parity is T4's job; T3's bar is "terminates + no
  duplicate + goldens intact."

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green; goldens conformant; any
touched file ≤500 lines.
Commit: `fix(T3): <faithful change per C trace> (no cross-cluster double install)`.
If the trace's fix is outside AD-3's write-set, STOP per AD-3.

## Observability / Rollback

N/A. Reversible (revert; newrank-gated).
