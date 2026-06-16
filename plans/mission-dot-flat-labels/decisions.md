# Architecture Decisions — dot-flat-labels (G4)

## AD-1: `needsAbomination` triggers via `flat_out`, not the `rk.flat` matrix

**Context:** C gates abomination on `GD_rank[0].flat` (the flat adjacency
matrix), but this port builds that matrix in mincross BEFORE flat edges populate
`flat_out`, so `rk.flat` is undefined at position-time.
**Decision:** Detect the rank-mn non-adjacent labeled flat edge directly via
`flat_out` (`rankHasNonAdjacentLabel`), leaving mincross untouched.
**Consequences:** Byte-safe (verified). Deliberate divergence from C's gate —
documented. `mincross-build.ts` stays out of scope. If the rewrite turns out to
need the matrix, STOP and reconsider (do not silently pull in mincross).

## AD-2: `abomination` = 0-based insert-rank-at-top (not C's negative-index shift)

**Context:** C does `GD_rank = rptr+1` then `rank[-1]`; JS has no negative array
indices. The current TS port mistranslated this (duplicates rank0, `minrank=-1`,
no `maxrank` bump).
**Decision:** Insert a new empty rank at index 0; shift every existing rank to
index+1; increment each node's `ND_rank` by 1; bump `maxrank`; keep `minrank=0`.
`flatNode` then places the label at `r-1` (now ≥ 0). `position.ts` already
re-runs `setYcoords` when `flatEdges` returns true, so y-coords recompute.
**Consequences:** Faithful-equivalent without negative indices. `flatNode` /
`makeVnSlot` indexing must align to the 0-based scheme. Rank shift touches node
ranks — verify no consumer beyond flat/position breaks (stop condition).

## AD-3: Dispatch `make_flat_labeled_edge` from `makeFlatEdge`; wire into live path

**Context:** A non-side-port flat labeled edge currently takes the simplified
fitter and never reaches `makeFlatEdge`.
**Decision:** Port `make_flat_labeled_edge` into `splines-flat.ts`; dispatch from
`makeFlatEdge` when `ED_label` is set (C order: after `isAdjacent`, before
bottom/top); route labeled flat edges through this path.
**Consequences:** Only labeled flat edges change routing path — plain flats keep
their path, goldens safe (hybrid spirit).

## AD-4: Scope both adjacent and non-adjacent cases

**Context:** Adjacent labeled flats route via `make_flat_adj_edges` (ported but
drops the label); non-adjacent via `make_flat_labeled_edge`.
**Decision:** Fix both label emissions. Non-adjacent (T2) first, adjacent (T3).
**Consequences:** Two distinct mechanisms; each pinned independently.

## AD-5: Parity bar = dot-oracle pins at tol 0.5; un-reachable → quarantine

**Context:** Some sub-case geometry may not reach 0.5pt within the mission.
**Decision:** Pin each case as a dot-oracle test (tol 0.5). A case that can't
reach parity is quarantined: pin TS actual + `comparisons/<case>.html` page +
journal reference. A batch with any quarantined case is not complete until its
page exists.
**Consequences:** No silent divergence (mirrors dot-edge-multi).
