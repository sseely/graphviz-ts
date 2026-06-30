# T1 — Create the flat label virtual node correctly

## Context

graphviz-ts is a faithful TS port of graphviz C (tag 15.0.0, `~/git/graphviz`,
the spec). A `rank=same` labeled edge drops its label because the label virtual
node is never created in the live pipeline. The flat-edge machinery
(`flat.ts`: `flatNode`, `abomination`, `makeVnSlot`, `flatEdges`,
`needsAbomination`, `checkFlatAdjacent`) is **ported but mis-wired** in three
layers (see `.agent-notes/g4-flat-label-rootcause-2026-06.md`). This task fixes
the ranking-phase so the label vnode is created with a well-formed rank
structure. It does NOT yet route or emit the label (that is T2).

## Task

1. **Wire the real `flatEdges`.** `position.ts:183` has a local stub
   `export function flatEdges(_g){return false;}` that shadows the real
   `flat.ts:flatEdges`. Remove the stub; import `flatEdges` from `./flat.js`.
   The call site `position.ts:200 if (flatEdges(g)) setYcoords(g);` then runs the
   real driver (matches C `position.c:139`).

2. **Fix `needsAbomination` (AD-1).** It gates on `rank[mn].flat !== undefined`,
   but that matrix is unreliable in this port. Detect the rank-mn non-adjacent
   labeled flat edge directly via `flat_out` — `rankHasNonAdjacentLabel(rank[mn])`
   already does this. Keep the function byte-safe (only triggers for graphs with
   a rank-mn non-adjacent labeled flat edge; none in the 115 goldens).

3. **Rewrite `abomination` 0-based (AD-2).** The current port mistranslates C's
   negative-index base-pointer shift. Replace with: insert a new empty rank at
   index 0; shift every existing rank up to index+1; increment each node's
   `ND_rank` by 1; bump `maxrank`; keep `minrank` at 0. Do NOT use negative
   indices. `position.ts` re-runs `setYcoords` after `flatEdges` returns true, so
   y-coords recompute correctly.

4. **Align `flatNode` / `makeVnSlot` indexing.** `flatNode` places the label
   vnode at `r-1` where `r = ND_rank(tail)`. With AD-2, after abomination the
   flat edge sits at rank ≥ 1, so `r-1 ≥ 0`. Verify `makeVnSlot(g, r-1, place)`
   targets the correct (existing) rank, sets `ND_label(vn)`, `ND_alg(vn)=e`, the
   two FLATORDER virtual edges, and the dims — matching `flat.c:flat_node`.

Read the C (`flat.c:flat_node` 138-186, `abomination` 187+, `flat_edges` 259-293)
and preserve its behavior. Do not pull `mincross-build.ts` into scope (AD-1); if
it appears necessary, STOP and log.

## Write-set

- `src/layout/dot/position.ts` — remove stub, import real `flatEdges`
- `src/layout/dot/flat.ts` — `needsAbomination`, `abomination`, `flatNode`/`makeVnSlot` alignment

## Read-set

- `~/git/graphviz/lib/dotgen/flat.c:138-293` (flat_node / abomination / flat_edges)
- `~/git/graphviz/lib/dotgen/position.c:139` (flat_edges call)
- `src/layout/dot/flat.ts` (existing ports), `src/layout/dot/position.ts:178-208`
- `.agent-notes/g4-flat-label-rootcause-2026-06.md`
- `decisions.md#ad-1`, `#ad-2`

## Interface contract (consumed by T2)

After layout of a non-adjacent flat labeled edge `e`, there is exactly one
VIRTUAL node `ln` with `ND_alg(ln) === e`, positioned (coord set), on the rank
above the edge, reachable from `e` via its `to_virt` chain (`make_flat_labeled_edge`
walks `ED_to_virt(e)` to find `ln`).

## Acceptance criteria

- **Given** `{rank=same a->c->b[style=invis]} a->b[label="x"]`, **when** laid
  out, **then** exactly one VIRTUAL node has `ND_alg` = the edge, the rank arrays
  are well-formed (`minrank` 0, `maxrank` bumped, no duplicated or negative-index
  ranks), and no exception is thrown.
- **Given** a plain flat edge (`{rank=same a b} a->b`, no label), **when** laid
  out, **then** no abomination runs and no extra rank is created (unchanged).
- **Given** the full suite, **then** ≥1793 pass, 0 fail, 115 goldens conformant.

## Quality bar

`tsc --noEmit` 0; lizard clean on changed files; vitest green per gates.
Commit: `feat(T1): create flat label vnode (wire flatEdges + abomination rewrite)`.

## Observability / Rollback

N/A — pure layout, no runtime services. Reversible (revert the commit; no
goldens change). If a goldens byte diff appears, STOP (hybrid-boundary regression).
