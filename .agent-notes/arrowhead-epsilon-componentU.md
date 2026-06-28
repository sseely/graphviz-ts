<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: arrowhead 0.01 cluster = componentU dropped arrow_gen's EPSILON

- **Context**: ~15 graphs (2669, graphs-unix/weight/grammar/fig6/b80/b80a/
  lsunix1-3/awilliams/viewport, share-/windows- variants) were structural-match
  with maxΔ exactly 0.01 — a single normal-arrowhead polygon vertex off by one
  ULP at the 2-decimal SVG output (e.g. `170.9,-608.4` vs oracle `-608.41`).
- **Root cause**: C `arrow_gen` (arrows.c) normalizes the RAW shaft vector with
  EPSILON (=.0001) guards:
    `s = ARROW_LENGTH / (hypot(u) + EPSILON);`
    `u.x += (u.x>=0)?EPSILON:-EPSILON; u.y += ...; u.x*=s; u.y*=s;`
  then `arrow_gen_type` scales by `lenfact*arrowsize`. The port did TWO things
  differently: (1) `arrowDrawOpsForEnd` pre-normalized `dir` to a UNIT vector
  (`normalizeVec`) before `componentU`, discarding the raw magnitude the EPSILON
  is relative to; (2) `componentU` omitted EPSILON entirely
  (`s = ARROW_LENGTH*lenfact*arrowsize / hypot(dir)`). Net: the normalized
  direction was off by ~1e-3, enough to flip the .005 rounding boundary on one
  barb vertex.
- **Why it was hard to see**: arrows are generated in clipAndInstall via
  arrowDrawOpsForEnd → arrowDrawOps → dispatchSimple → componentU, NOT the
  legacy arrowheadPolygon path; and points are in internal (y-up) coords,
  transformed before emit. The edge PATH byte-matches — only the arrowhead
  polygon diverged, proving the spline (and thus C's raw inputs) were identical.
- **Fix**:
  - `componentU` (arrows-shapes-util.ts) now reproduces arrow_gen exactly:
    EPSILON in the denominator + per-component ±EPSILON nudge on the raw vector,
    then `*lenfact*arrowsize`.
  - `arrowDrawOpsForEnd` (edge-route-arrow.ts) passes the RAW `dir` (removed
    `normalizeVec`) so the magnitude reaching componentU matches C's `u-p`.
- **Result**: all sampled cluster graphs (unix/2669/grammar/weight/b80/fig6/
  awilliams/lsunix1) → BYTE-MATCH. tsc clean. Arrow unit tests updated: the
  unit-DIR dot tests asserted pre-EPSILON ideals to 9 digits; relaxed to
  EPSILON-aware tolerances (rx/ry/center.y to 6 digits; axis-aligned center.x
  picks up ~4e-4 perp nudge → 3 digits). Faithful to C.
- **NOTE (unrelated pre-existing)**: golden `circo-biconn` fails with OR without
  this change — its ref (test/golden/refs/circo-biconn.svg) was already modified
  in the working tree before this session. Not caused by the arrow fix.
- **Confidence**: High — byte-match vs native headless oracle on 8 graphs;
  root cause confirmed by runtime probe (raw dir=(11.17,2.52) |dir|=11.45) and C
  source (arrow_gen EPSILON).
