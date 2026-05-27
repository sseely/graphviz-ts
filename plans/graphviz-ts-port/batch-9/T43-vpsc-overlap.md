# T43 — VPSC Overlap Removal

## Context

Overlap removal in neato uses VPSC (Variable Placement with Separation
Constraints) when `overlap=vpsc` or when MODE_IPSEP is active. The C
implementation is in `lib/neatogen/overlap.c`, which calls the C++ VPSC
library in `lib/vpsc/`.

`lib/vpsc/` was ported to TypeScript in an earlier batch (Batch 1 or the
VPSC-specific sub-task). T43 ports `overlap.c` — the wrapper that drives
VPSC for node overlap removal.

**Two-pass architecture (AD-4):**

VPSC overlap removal runs in two independent passes:
1. X axis: build `Variable[]` and `Constraint[]` for X coordinates, run
   VPSC, extract new X positions
2. Y axis: build a completely independent set of `Variable[]` and
   `Constraint[]` for Y coordinates, run VPSC, extract new Y positions

The X-pass and Y-pass arrays are fully independent — they must not share
Variable or Constraint objects. This is AD-4.

**Teardown order (AD-4):**

Per AD-4, teardown must follow this order for each pass:
`deleteVPSC` → `deleteConstraints` → `deleteVariable`

Deleting a Variable before its Constraints leaves dangling pointers in C.
The TypeScript port must respect the same ordering even though JavaScript is
GC'd, because the deleteVPSC / deleteConstraints / deleteVariable sequence
may run finalizer logic that updates constraint state.

**`overlap.c` vs. stress-smoother overlap (`lib/sfdpgen`):**

`overlap.c` in neatogen is the VPSC-based overlap. The GTS/Delaunay-based
`remove_overlap` (stress majorization overlap smoother, conditionally
compiled under `#ifdef HAVE_GTS && SFDP`) is a separate, larger system
used by sfdp. T43 ports only the VPSC overlap path from `overlap.c`.

**Node bounding boxes:**

Each node has a bounding box defined by `NodeInfo.width` and
`NodeInfo.height` (in inches). VPSC operates on node center positions
with separation constraints that guarantee non-overlap. The minimum
separation between nodes i and j in the X direction is:
`(width_i + width_j) / 2 + gap_x` where `gap_x` comes from the `sep`
graph attribute.

**`quad_prog_vpsc.c` path:**

`AM_VPSC` overlap mode calls `removeoverlaps` from `quad_prog_vpsc.c`,
which wraps the VPSC solver with constraint generation. T43 ports this
as a function `removeOverlaps(n, coords, opt)`. The DiG-CoLa VPSC path
(`constrained_majorization_vpsc`, used by MODE_IPSEP) is out of scope
for this task — it belongs in T41 (stress majorization).

## Task

Port `lib/neatogen/overlap.c` (the VPSC-based overlap removal path) to
TypeScript.

1. **`removeOverlap`**: Main overlap removal entry point. Takes graph
   nodes with positions and sizes, runs two independent VPSC passes
   (X then Y), writes new positions back to `NodeInfo.pos`.

2. **`generateConstraints`**: For a given axis (X or Y), generates the
   Variable and Constraint arrays for VPSC. Uses node sizes and the `sep`
   margin. All constraints enforce: `pos[i] + size[i]/2 + gap <= pos[j] -
   size[j]/2` for non-overlapping pairs.

3. Internal helpers as needed to replicate the C behavior of building
   separation constraints from the node bounding box intersections.

## Write-Set

- `src/layout/neato/overlap.ts`
- `src/layout/neato/overlap.test.ts`

## Read-Set

- `~/git/graphviz/lib/neatogen/overlap.c` — full VPSC overlap path;
  `vpscAdjust`, `removeoverlaps` call chain
- `~/git/graphviz/lib/vpsc/solve_VPSC.cpp` — Variable, Constraint, VPSC
  type definitions and key function signatures
- `~/git/graphviz/lib/neatogen/quad_prog_vpsc.h` — `removeoverlaps`
  signature and `ipsep_options` struct
- `~/git/graphviz/docs/architecture/lib/neatogen.md` — `overlap.c` and
  `lib/vpsc Usage` sections

## Architecture Decisions

- **AD-4**: Two-pass X/Y VPSC with independent Variable[]/Constraint[] arrays.
  Teardown: `deleteVPSC` → `deleteConstraints` → `deleteVariable`.
- **AD-1**: Node positions from `NodeInfo.pos[0]` (X) and `NodeInfo.pos[1]`
  (Y); node size from `NodeInfo.width` and `NodeInfo.height`.

## Interface Contracts

```typescript
// src/layout/neato/overlap.ts

/**
 * Remove node overlaps using VPSC.
 * Runs two independent passes: X axis then Y axis.
 * Modifies NodeInfo.pos in place.
 */
export function removeOverlap(
  nodes: import('../../model/Node').Node[],
  sep: { x: number; y: number },
): void;
```

## Acceptance Criteria

1. After `removeOverlap`, no two node bounding boxes intersect (accounting
   for the `sep` margin). Verified on a test case with deliberately
   overlapping nodes.

2. X-pass and Y-pass use completely independent `Variable[]` and
   `Constraint[]` arrays — no object is shared between the two passes.

3. Teardown follows the order: `deleteVPSC` → `deleteConstraints` →
   `deleteVariable` for each pass.

## Observability

N/A — pure algorithmic function; no I/O.

## Rollback

Reversible. Writes only new files under `src/layout/neato/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/neato/overlap.test.ts` exits 0
- One commit: `feat(neato): port VPSC overlap removal`
- Tests cover: 4-node graph with initial overlaps → after removal, all
  bounding boxes are non-overlapping; verify X and Y Variable arrays are
  distinct objects.
