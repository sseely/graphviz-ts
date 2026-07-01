<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — design the collect + grouping port (graphs-b15)

## Context
Diagnosis is done (README + `git show fix/graphs-b15:.agent-notes/graphs-b15-concentrate-drop.md`).
The port's `dotSplines_` collect (`src/layout/dot/splines.ts:521`,
`for (const n of g.nodes.values()) collectNodeEdges(n, edges)`) misses virtual
`splineMerge` nodes, so the 6 concentrate secondary edges are never routed. C
collects from the **rank array** incl. virtual nodes when `splineMerge(n)`
(`~/git/graphviz/lib/dotgen/dotsplines.c:281-299`), then sorts (`edgecmp`),
groups by `getmainedge`, and routes each group once (`:328-383`). The port
already has `edgecmp`/`getMainEdge`/`groupSize`/`routeEdgeGroup`. The prior naive
fix doubled ~40 beziers by adding a side router; the faithful fix must route the
new edges **through the existing group dispatch** so each orig routes once.

## Task
Produce the implementation design — no production `src/` change (revert probes).
1. **Map C's collect exactly**: `dotsplines.c:281-320` — the rank-array loop, the
   `ND_node_type(n) != NORMAL && !splineMerge(n)` skip, and the
   `ND_out`/`ND_flat_out`/`ND_other` append order + `setflags`. State the precise
   port equivalent (which node list to iterate — `g.info.nlist` / rank array —
   and the `splineMerge` predicate: `VIRTUAL && (in.size>1 || out.size>1)`).
2. **Prove coalescence**: instrument the port's `getMainEdge` for the 6 secondary
   edges (owned by virtual `left`) AND their would-be mains (the representative
   chain edges). Confirm `getMainEdge` returns the SAME edge for a secondary and
   its main → they land in one `groupSize` group → routed once. If they DON'T
   coalesce, pin the `getMainEdge`/`to_virt` gap (C `getmainedge` walks `to_virt`
   then `to_orig`; check the port's `to_virt` links after `dotConcentrate`).
3. **Instrument C** (optional, AD-1) to capture the group membership + route count
   per orig for the 6 edges, as ground truth for step 2.
4. Write `.agent-notes/graphs-b15-collect-design.md` with the fields below and a
   decision-journal row.

## Write-set
- `.agent-notes/graphs-b15-collect-design.md` (design artifact)
- `plans/fix-graphs-b15/decision-journal.md` (row)
- temporary probes in `src/**` MUST be reverted (`git diff --name-only src/`
  empty at completion).

## Read-set
- `src/layout/dot/splines.ts:100-115` (`getMainEdge`), `:210-230` (`edgecmp`),
  `:320-360` (`groupSize`/`routeEdgeGroup` group loop), `:515-535` (collect)
- `src/layout/dot/conc.ts` (`mergeVirtual`/`infuse` — how `left` gets its out-edges + `to_virt`)
- `~/git/graphviz/lib/dotgen/dotsplines.c:99-108` (`getmainedge`), `:281-383`
  (collect + sort + group loop), `:109-112` (`spline_merge`)
- README (inherited diagnosis), `decisions.md` (AD-2/AD-3)

## Interface contract (consumed by T2)
```
{ collectChange: { file, line, fromIter, toIter, splineMergePredicate },
  coalesces: boolean,                 // do the 6 secondaries share their main's getMainEdge?
  getMainEdgeFix: string | null,      // required only if coalesces == false
  cReference: string,                 // dotsplines.c lines to mirror
  routeOnceProof: string }            // evidence each orig routes once
```

## Acceptance criteria
- Given the render recipe, then the 6 named edges are confirmed missing (port 147
  vs oracle 153).
- Given instrumentation, then the design states the exact collect change with its
  C reference AND a `routeOnceProof` (getMainEdge group membership for the 6
  secondaries + mains) showing each orig routes once through the existing
  dispatch — or names the `getMainEdge`/`to_virt` fix if it does not coalesce.
- Given completion, then `git diff --name-only src/` is empty (probes reverted).

## Observability
N/A — dev/test instrumentation.

## Rollback
Reversible — notes only.

## Quality bar
Return only the interface-contract fields + the confirmed missing-edge list. No
preamble.

## Commit
`docs(T1): design graphs-b15 collect + edgecmp-grouping port`
