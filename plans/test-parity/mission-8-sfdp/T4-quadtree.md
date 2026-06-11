# T4 — QuadTree supernode approximation

## Context
USE_QT engages when a level has n ≥ 45: sfdp-large (100) and any
coarse level ≥45. NORMAL scheme uses per-node
QuadTree_get_supernodes (NOT QuadTree_get_repulsive_force — that is
the fast scheme).

## Task
`src/layout/sfdp/quadtree.ts`: QuadTree_new, new_in_quadrant,
QuadTree_add (internal splitting, max_level, average position
accumulation — read /tmp/sfdp-spec/QuadTree.c:311-470),
QuadTree_new_from_point_list (bounding box + width logic),
QuadTree_get_supernodes(_internal) (bh=0.6 criterion, node exclusion,
counts). Wire the USE_QT branch + oned_optimizer training
(5·nsuper_avg + counts_avg) in spring-electrical.ts.

Acceptance: sfdp-large positions match the C probe (≤1e-9 after
scaling); fma audit on _QuadTree_get_supernodes_internal.

## Write-set
src/layout/sfdp/*.

## Commit
`feat(sfdp): port quadtree supernode approximation`
