# T3 — DFLT_MARGIN=4 and real sortv values

## Context
C osageinit.c uses DFLT_MARGIN from neatogen/adjust.h = 4; our
src/layout/osage/index.ts has 8 (doubles every array gap and cluster
margin: the 96-vs-88 trio). C also reads real sortv ints
(late_int(child, cattr/vattr)) into pinfo.vals when PK_USER_VALS;
ours pushes 0.

## Task
1. `DFLT_MARGIN = 4` (`@see lib/neatogen/adjust.h:DFLT_MARGIN`).
2. addSubcluster/addLooseNode: push `lateInt(attr 'sortv', 0, 0)`
   (subg.attrs / nodeAttr for nodes) instead of 0. Gate vals use on
   PK_USER_VALS exactly as C (cattr/vattr existence: read the attr,
   undefined → 0). Reuse lateInt from src/common/nodeinit.ts.

## Read-set
~/git/graphviz/lib/osage/osageinit.c:96-135,
~/git/graphviz/lib/neatogen/adjust.h:24.

## Acceptance criteria
- Given osage-simple after T2+T3, when rendered, then cluster_0
  polygon is exactly (0,0)-(116,-80) and svg is 244x88 (matches ref)
- osage-simple, osage-array-mode, osage-sortv goldens PASS
- Full suite: no previously passing test fails

## Write-set
src/layout/osage/index.ts

## Commit
`fix(osage): use C DFLT_MARGIN=4 and read real sortv values`
