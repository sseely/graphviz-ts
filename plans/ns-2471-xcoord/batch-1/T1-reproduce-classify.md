# T1 — Reproduce the NS hang + classify cycling vs slow

## Context

graphviz-ts is a faithful TS port of C graphviz. The mincross fix (this branch)
makes 2471 produce the correct rank order, which exposes a network-simplex
non-convergence in `dotPosition`'s x-coordinate pass. C renders the same graph
fast; TS hangs. This task reproduces and classifies the hang. Investigative —
run inline so harness/oracle state persists.

## Task

1. **Reproduce** the hang: render `~/git/graphviz/tests/2471.dot` via the
   esbuild bundle with `maxphase=3` (graph attr) and a wall-clock timeout.
   Confirm `maxphase=2` completes (~3.6s) and `maxphase=3` hangs in
   `rank(g, 2, nsiter2(g))`.
2. **Pivot probe** (temporary, reverted): instrument `rank2Loop` (ns.ts:416) to
   record per-pivot: iteration count, the `leaveEdge` edge, the `enterEdge`
   edge, and total tree weight (sum of `nsLength` over tree edges, or slack).
   Detect **cycling**: same (leave, enter) pair recurring, or total weight
   non-strictly-decreasing across pivots.
3. **C oracle:** spawn native C `dot` on 2471 (3-dylib `/tmp/gvmine` recipe),
   dump per-node final x-coords; build a TS↔C x-order-per-rank comparator.
4. **Classify:** cycling/correctness deviation (→ Batch 2) vs faithful-but-slow
   (pivots strictly progress, just many) (→ STOP per ADR-5).

## Write-set

- `../decision-journal.md` — classification + harness recipe (no source commits).
- Temporary probes in `ns.ts` (reverted before finishing).

## Read-set

- `src/layout/dot/ns.ts:416-447` (rank2Loop / rank2)
- `src/layout/dot/ns.ts` — `leaveEdge`, `enterEdge`, `nsUpdate` (find + read)
- `src/layout/dot/ns-core.ts` — cut-value / `invalidatePath` / `exchangeTreeEdges`
- `decisions.md#adr-3` , `decisions.md#adr-5`
- `../mincross-2471-faithful/batch-2/layer2-root-cause.md` (maxphase + harness)
- C: `~/git/graphviz/lib/common/ns.c` (`rank2`, `leave_edge`, `enter_edge`)

## Architecture decisions (locked)

ADR-2 (native C oracle), ADR-3 (probe + maxphase), ADR-5 (slow ⇒ STOP).

## Acceptance criteria

- Given 2471 + `maxphase=3`, when run with the pivot probe, then the journal
  records cycling-vs-progressing with evidence (pivot counts, repeated pairs).
- Given native C dot on 2471, when x-coords are dumped, then a TS↔C x-order
  comparator exists and runs.
- Given the classification = faithful-but-slow, when concluded, then STOP and
  report (ADR-5); otherwise Batch 2 is unblocked with a named suspect area.

## Observability

N/A — no new observable runtime operations. Probes are temporary and reverted.

## Rollback

Reversible — no committed source changes in this task; probes reverted.
