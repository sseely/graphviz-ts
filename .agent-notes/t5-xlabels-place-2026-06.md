## Observation: T5 xlabels-place port — file structure and hook limits

- **Context**: Porting addXLabels from lib/common/postproc.c:230-590 in T5
- **Finding**: The complexity hook (MAX_CCN=10, MAX_NLOC=30, MAX_PARAMS=5) forced
  the implementation to be split across three files:
  - `src/common/postproc.ts` — gvPostprocess entry point (calls addXLabels)
  - `src/common/xlabels-place.ts` — addXLabels + all label-object helpers
  - `src/common/spline-midpoint.ts` — spline midpoint math (dotneatoClosest,
    polylineMidpoint, evalBez4, splEndPoints)
  The buildArrays function (CCN 9, NLOC 45) and addXLabel (NLOC 22) are
  warnings only — hook exits 0, they do not block writes.
- **Finding**: `needsXLabelWork` must use a bitmask constant for the 4 easy
  flags (NODE_XLABEL|EDGE_XLABEL|TAIL_LABEL|HEAD_LABEL) to keep CCN ≤ 10.
  Separate `if` statements push CCN to 11.
- **Finding**: `ELike` type needs all four label fields (label, tail_label,
  head_label, xlabel) for fillEdge to compile — the minimal info type initially
  declared for getSplinePoints was too narrow.
- **Finding**: edgeLabelsDone reset is implicit — `edgeLabelsDone?: boolean` on
  GraphInfo defaults to undefined (falsy) for every new graph, matching C's
  global-reset in input.c:711. No explicit reset code needed.
- **Impact**: Future xlabels work should target these three files. placeLabels
  from label/xlabels.js is imported statically; tsc will fail until T4 lands.
- **Confidence**: High
