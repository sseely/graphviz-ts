# T2 — Port-side dump (matching native format)

## Context
We need the graphviz-ts x-coord network-simplex trace in the SAME schema as T1 so
T3 can diff them. The x-coord NS is `rank(g, 2, nsiter2(g))` in
`dotPosition` (position.ts:210), operating on the aux graph from
`createAuxEdges` (position-aux.ts). The pivot loop is `rank2Loop` (ns.ts);
`leaveEdge`/`enterEdge`/`nsUpdate` are the per-pivot ops.

## Task
Add **temporary, NS_DEBUG-gated** probes that emit, for the large x-coord NS pass
only (gate on aux node count > ~200, mirroring T1): (a) the aux-edge list and
(b) the per-pivot `leave/enter/cutvalue` trace, in T1's exact line format. Build a
small bundle harness (esbuild → node) that renders a given `.gv` and writes the
dumps. Probes must be removable (gated, clearly marked `// DEBUG-PROBE`), not
permanent src logic — T5 removes them.

Use the existing recipe: esbuild-bundle a `renderSvg` entry, run
`NS_DEBUG=1 node bundle.mjs <input.gv>`.

## Write-set
- `plans/fix-xcoord-pivots/probes/port/` — bundle entry, run scripts, captured
  dump files.
- Temporary `// DEBUG-PROBE`-gated lines in `src/layout/dot/ns.ts` and
  `src/layout/dot/position-aux.ts` (removed in T5). These are the ONLY src touches
  in Batch 1 and must be env-gated (zero cost when `NS_DEBUG` unset).

## Read-set
- `src/layout/dot/ns.ts` — `rank2Loop`, `leaveEdge`, `enterEdge`, `nsUpdate`.
- `src/layout/dot/position-aux.ts:237-287` — `addEdgePair`, `makeEdgePairs`,
  `createAuxEdges`.
- `src/layout/dot/position.ts:198-224` — `dotPosition` (the x-coord rank call).
- T1 output schema (decision-journal / probes/native), decisions.md#adr-1.

## Architecture decisions (locked)
ADR-1. Probes gated on `NS_DEBUG`; same node-count gate as T1 so only the x-coord
pass is dumped.

## Interface contract (output, consumed by T3)
Identical schema to T1:
```
port aux-edge dump:  "<tailId> <headId> <minlen> <weight>"
port pivot trace:    "<i> L:<tail>-<head> E:<tail>-<head> cv:<int>"
```
Node ids must align with T1's id scheme (rank+order or deterministic label) so
edge sets and pivots are directly comparable.

## Acceptance criteria
- Given `NS_DEBUG=1` and a rendered graph, when the x-coord pass runs, then the
  port emits aux-edge list + pivot trace in T1's format, for the large pass only.
- Given `2475_2.dot`, when dumped, then aux-edge count == 384804 (matches known
  evidence) and pivot count == 34434.
- Given `NS_DEBUG` unset, when `npx vitest run` runs, then no probe output and all
  tests pass (probes are zero-cost).

## Observability / Rollback
N/A. Reversible — probes are env-gated and removed in T5.

## Quality bar
`npx tsc --noEmit` clean with probes present. Probe lines clearly marked for T5
removal.
