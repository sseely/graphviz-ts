# T3 — Minimal repro + root-cause pin

## Context
With native (T1) and port (T2) dumps in a shared schema, find the smallest graph
that reproduces the pivot divergence and pin the exact first point where port and
native diverge. The pure-forest synthetic (i//2 trees) does NOT diverge — the
trigger is structural (forest of small DAGs with rank-spanning edges → virtual
nodes, indeg>1, depth). 2475_2: native 8748 pivots / 391709 aux edges vs port
34434 / 384804.

## Task
1. **Derive a minimal repro.** Starting from the forest generator, add structure
   (depth, rank-spanning edges, indeg>1, multiple components) until a `<~50-node`
   graph shows a ≥2× port-vs-native pivot gap. Commit it as the fixture.
2. **Pin the divergence (ADR-2), stop at first stage:**
   - **Aux-edge set:** diff port vs native edge lists for the minimal graph. If
     the sets differ, the cause is in `createAuxEdges`/`makeLrConstraints`/
     `makeEdgePairs` (position-aux.ts) — record which edges are missing/extra and
     trace to the responsible branch vs C `make_LR_constraints`/`make_edge_pairs`.
   - **Initial cutvalues:** if aux graphs match, compare initial cutvalues /
     feasible tree (ns-subtree.ts `feasibleTree`/`initCutvalues`).
   - **Pivot path:** if those match, compare pivot #1's leave/enter edge — a
     tie-break or selection difference in `leaveEdge`/`enterEdge` (ns.ts).
3. **Record** the exact first divergent stage, file, function, and C reference in
   `decision-journal.md`, plus the minimal fixture's native pivot count (the T4
   target).

## Write-set
- `src/layout/dot/__fixtures__/xcoord-pivot-divergence.gv` — the minimal repro.
- `plans/fix-xcoord-pivots/decision-journal.md` — root-cause entry.

## Read-set
- T1 dumps (`probes/native/`), T2 dumps (`probes/port/`).
- `src/layout/dot/position-aux.ts` (createAuxEdges family),
  `src/layout/dot/ns-subtree.ts` (feasibleTree/initCutvalues),
  `src/layout/dot/ns.ts` (leaveEdge/enterEdge/nsUpdate).
- C: `~/git/graphviz/lib/dotgen/position.c`, `~/git/graphviz/lib/common/ns.c`.
- decisions.md#adr-2, decisions.md#adr-3.

## Architecture decisions (locked)
ADR-2 (stop at first divergence), ADR-3 (minimal fixture).

## Interface contract (output, consumed by T4)
```
{
  minimalGraph: "src/layout/dot/__fixtures__/xcoord-pivot-divergence.gv",
  nativePivots: <int>,                       // T4's target for the fixture
  portPivotsBefore: <int>,                   // baseline (must be >= 2x native)
  firstDivergence: {
    stage: "aux-edges" | "cutvalues" | "pivot-path",
    file: "<src path>",
    function: "<name>",
    cRef: "lib/.../<file>.c:<func>"
  }
}
```

## Acceptance criteria
- Given structural experiments, when minimized, then a `<~50-node` `.gv`
  reproduces a ≥2× port-vs-native pivot gap (recorded with both counts).
- Given the dumps, when diffed in pipeline order, then the FIRST divergent stage
  is identified and written to `decision-journal.md` with file+function+C ref.
- Given the minimal fixture, when rendered by native, then `nativePivots` is
  recorded as the T4 target.
- If no minimal repro is found after reasonable experiments → STOP (README).

## Observability / Rollback
N/A. Reversible — fixture + journal only.

## Quality bar
The decision-journal entry is specific enough that T4 can implement without
re-investigating: it names one file/function and the C behavior it must match.
