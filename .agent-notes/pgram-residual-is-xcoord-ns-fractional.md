# pgram 0.73px residual = x-coord NS produces fractional where C produces integer

## Observation: the post-ordering-fix pgram residual is an x-coordinate (network-simplex) divergence
- **Context**: after the subgraph-ordering fix cleared pgram's ~600px A–Z order
  divergence (diverged→structural-match), a sub-pixel residual remained (max
  0.73px; ~0.41px uniform on every node's SVG-y). Investigated to root.
- **Finding (pinned by C+port instrumentation of `set_aspect`/`dot_position`):**
  the port's x-coordinate network simplex produces a **fractional** coordinate
  where C produces an **integer**. For node B:
  - **Port** `coord.x = 817.4137515551765` (post `setXcoords`, BEFORE `set_aspect`).
  - **C** `coord.x = 817.000000` (same point).
  - This is INDEPENDENT of ratio=fill: the port's `setXcoords` prints
    `817.4137515551765` both with and without `ratio=fill`. ratio=fill does not
    touch x-coord (no `g.info.drawing` read exists in the x-coord path; only
    `compressGraph` (gated on 'compress') and `setAspect` read it, both AFTER).
- **How it becomes the visible 0.41px shift (the ratio=fill interaction):**
  `set_aspect` is the only consumer that exposes it. `recBb` (at `set_aspect`
  start) computes the bb from the PRE-round coords — integer for C (→ `bb.ll.x=-56`),
  fractional for the port (→ `bb.ll.x=-55.586`). `set_aspect` then `round()`s the
  NODE centers (port 817.41→817, matching C's 817) but `scale_bb` scales the
  ALREADY-fractional bb. So the port's nodes (817) and its bb (from 817.41) are
  ~0.41 inconsistent; the emit translate derives from the bb → every node shifts
  ~0.41 in the SVG. C is self-consistent (integer nodes + integer bb).
  `set_aspect` factors are otherwise conformant (`xf=2.28663639412543…, yf=1`).
- **Signature:** C coords land on integers (B peak vertex `-855`), port on
  fractionals (`-854.59`). Uniform ~0.41 across all 58 nodes; cx/w/h ≈ 0; dims
  match 504×683.
- **Impact:** pgram stays structural-match (node order == C; this is the residual
  geometry delta). It is the **x-coord-NS family**, NOT label/font (node sizes
  match), NOT ordering (fixed), NOT `set_aspect` math (factors identical). The
  `position.ts:180` comment ("the port's x-NS is bit-exact with C … exact integer
  frame") has an EXCEPTION here — pgram's LR balance produces `817.4138`, not an
  integer.
- **Likely fix direction (NOT done — deep, dedicated x-NS mission):** C's x-NS
  keeps `ND_rank` as an int and truncates/feeds-back integers (cf. memory
  [[xcoord-ns-lrconstraints-int-trunc-done]], a prior fix of exactly this class).
  The port retains a float at some balance/NS site for this graph. Pinning the
  exact site needs x-NS (LR_balance / rank balance=2) instrumentation like the
  2371 / honda x-NS work. `817.4137515551765` is not a simple median average,
  suggesting it derives from accumulated fractional separations/widths in the
  rank rather than a single balance midpoint.
- **Confidence:** High (C+port values captured at the same pipeline point;
  ratio-independence verified; all instrumentation reverted, both repos clean).
