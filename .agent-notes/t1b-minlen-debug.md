
## Observation: arrowBase index for compound-bezier direction
- **Context**: applyFwdEdgeArrow computing arrowDir from compound spline
- **Finding**: After arrowEndClipMulti, the arrowBase is withBase[length-1] (last element), NOT length-2. C's arrow_gen uses bz.list[size-1] → bz.ep for direction. Using length-2 (the second-to-last control point) gives a slightly wrong direction.
- **Impact**: Off-by-one in index causes ~0.05pt polygon vertex error
- **Confidence**: High

## Observation: arrowEndClip index confusion on compound beziers
- **Context**: routeFwdMultiRankEdge calling arrowEndClip on 7-pt array
- **Finding**: arrowEndClip expects exactly 4 pts; on a 7-pt array it reads indices [0],[1],[2] which are the FIRST segment, not the last. Must use arrowEndClipMulti.
- **Impact**: Compound spline collapsed to 4 pts (wrong segment)
- **Confidence**: High

## Status: T1b COMPLETE
- dot-minlen quarantine: PASS maxDelta=0
- Tests: 1096/1096 passed
- New pinning tests in dot.test.ts (AC5, AC6)
- New files: edge-route-helpers.ts (130L), edge-route-chain.ts (272L), edge-route.ts (228L)
