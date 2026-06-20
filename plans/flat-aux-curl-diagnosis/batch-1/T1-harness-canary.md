# T1 — Build + canary the aux rank/chain dump harness

## Context
graphviz-ts is a faithful TS port of C graphviz; the C source at `~/git/graphviz`
is the spec. Flat (same-rank) edges with ports route through an **auxiliary
graph**: C `make_flat_adj_edges` (`lib/dotgen/dotsplines.c:1122-1281`) clones the
two endpoints + edges into a rotated graph, runs the full dot pipeline
(`dot_rank` → `dot_mincross` → `dot_position` → reposition → `dot_splines_`),
then transforms the resulting splines back. The port mirrors this in
`src/layout/dot/splines-flat.ts` (`buildFlatAux`, `runAuxPipeline`,
`runAuxSplines`, `makeFlatAdjEdges`).

The pinned divergence (memory `flat-edge-241-is-y-only`): for the reversed back
edge `3:sw->2:se`, C's aux spline has **size 7** (curls below) and the port's has
**size 4** (straight). The forward `2:ne->3:nw` matches (size 7 both). The cause
lives upstream of the spline — in the aux graph's **ranks + virtual-node chain**.

## Task
Build a **read-only diagnostic harness** that dumps, for a given `.dot` input and
a named same-rank edge, the aux graph's internal structure on **both** sides:

Port side (TS): instrument by *calling* `buildFlatAux` + `runAuxPipeline` from a
standalone script and reading the resulting graph — do **not** edit
`splines-flat.ts`. If the needed builders are not exported, **stop and report**
(exporting is a layout-path edit under AD-1 — escalate; do not silently add
exports without logging it as a finding). Emit per aux node: `ND_rank`,
`node_type`, order; per cloned edge: the virtual-node chain (the vnodes inserted
between tail and head) and the final aux spline `size`.

C side: instrument `make_flat_adj_edges` (ephemeral, AD-6) to print the same
fields after `dot_rank` and after `dot_splines_`; rebuild `gvplugin_dot_layout`
into `/tmp/gvplugins`; run native `dot` on the repro.

**Canary (AD-4):** point the harness at the **forward** `2->3` edge first and
confirm both sides agree (size 7, same rank gap, same chain length). Only after
the canary is green, aim it at the reversed `3->2` and emit both dumps.

Create a **minimal synthetic repro** `test/diagnostic/flat-back-port.dot` (AD-2):
the smallest `rank=same` graph with a both-bottom-port back edge that reproduces
size 4-vs-7. Start from two nodes `a`, `b` with `b:sw -> a:se` and add only what
is needed to trigger the adjacent-flat aux path. If the minimal graph does not
reproduce the split, widen minimally and log what was required.

## Write-set
- `test/diagnostic/flat-aux-dump.ts` (Create) — the harness script
- `test/diagnostic/flat-back-port.dot` (Create) — minimal repro
- `plans/flat-aux-curl-diagnosis/findings-harness.md` (Create) — canary result +
  both rank/chain dumps (C and port, forward and reversed)

Do **not** modify any file under `src/`. (AD-1)

## Read-set
- `decisions.md` (AD-1, AD-2, AD-4, AD-6)
- `src/layout/dot/splines-flat.ts:60-166` (cloneGraph, runAuxPipeline,
  buildFlatAux, cloneFlatEdge)
- `lib/dotgen/dotsplines.c:1122-1281` (make_flat_adj_edges) in `~/git/graphviz`
- memory `recover-slack-and-c-harness` (C instrumentation recipe)

## Interface contract (consumed by T3)
The harness exposes a callable + text dump with this shape per side:
```
{ edge: "3:sw->2:se",
  maxrank: number,
  nodes: [{ name|vid: string, rank: number, type: "NORMAL"|"VIRTUAL", order: number }],
  chain: string[],     // ordered vnode ids between tail and head (may be empty)
  auxSize: number }    // final aux bezier point count (4 or 7)
```
T3 reuses this harness unchanged; do not rename its entry point after T1.

## Acceptance criteria
- **Given** the synthetic repro and the forward `2->3` edge, **when** the harness
  runs, **then** C and port report the **same** `auxSize` (7) and the same chain
  length (canary green).
- **Given** the same repro and the reversed `3->2` edge, **when** the harness
  runs, **then** it emits both rank/chain dumps and they show `auxSize` 7 (C) vs
  4 (port) — reproducing the bug outside `#241_0`.
- **Given** the harness script, **when** `npx tsc --noEmit` runs, **then** exit 0
  and no `src/` file appears in `git diff --name-only main`.
- **Given** `findings-harness.md`, **when** read, **then** the first 15 lines
  state canary status and the C-vs-port `auxSize`/chain delta.

## Observability
N/A — no new observable runtime operations (diagnostic script only).

## Rollback
Reversible. C instrumentation reverted + clean plugin restored before task end
(AD-6); the harness is additive test tooling.

## Quality bar
`npx tsc --noEmit` exit 0; `lizard test/diagnostic/flat-aux-dump.ts -C 10 -L 30
-a 5` clean; goldens untouched. One commit: `test(diag): aux rank/chain dump
harness + synthetic flat-back-port repro`.
