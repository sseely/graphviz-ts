# Architecture Decisions — nonadjacent-flat-multi

Locked before execution. Contradicting one is a STOP condition.

## AD-1: cnt=1 must reduce to exactly current behavior (byte-identical)
**Context:** The cnt-loop with cnt=1, i=0 is algebraically the current single-route
path (`Multisep/2 = nodesep/2`, `(0+1)·step = step`). 74 corpus cases are cnt=1.
**Decision:** The generalized router MUST produce byte-identical splines for every
cnt=1 edge. The T1 box-helper refactor is pure (no behavior change); vitest stays
1995 green. Any cnt=1 / out-of-family golden flip ⇒ STOP — it is a bug, not a
faithful change.
**Consequences:** The regression bar is concrete and the blast radius is bounded.

## AD-2: New module `splines-flat-multi.ts` (respect the 500-line cap)
**Context:** `splines-flat.ts` is at 492/500 lines; the grouping + cnt-loop won't fit.
**Decision:** Put the non-adjacent group collection (`collectNonAdjacentFlatGroup`)
and the cnt-loop router (`routeFlatEdgeGroupFaithful`) in a NEW
`src/layout/dot/splines-flat-multi.ts`. `splines-flat.ts` exports the box helpers
(`topBoxes`, `bottomBoxes`, `makeFlatEndBox`, `flatSide`, `flatVspace`,
`freshFlatPath`, `assembleFlatPath`) for reuse. Never split the C spec file.
**Consequences:** One cohesive new module; the diff stays reviewable; line cap held.

## AD-3: Group ordering = seq order, lead edge forward-normalized
**Context:** Edge `i` gets offset `(i+1)·step`; the per-edge spline assignment must
match C's order so the SVG byte-matches. C `dot_splines_` collects in sorted-edge
order and forward-normalizes the lead (`makefwdedge`).
**Decision:** `collectNonAdjacentFlatGroup` mirrors `collectAdjacentFlatGroup`:
same node pair, identical ports, non-adjacent, ordered so the lead edge's tail is the
left (lower-order) node, ties by `seq`. Confirm against the oracle's per-edge spline
assignment; if C's order differs, follow C.
**Consequences:** Deterministic nesting that byte-matches the oracle.

## AD-4: Faithful match to C at both branches; no special-case, no new abstractions
**Context:** CLAUDE.md YAGNI + "C defines completeness".
**Decision:** Port BOTH the top (`make_flat_edge`) and bottom
(`make_flat_bottom_edges`) cnt-loops exactly: shared ends, `step=…/(cnt+1)`,
`(i+1)` end-offsets, plain `stepy` middle. No cnt≥2-specific heuristics; reuse the
generalized `topBoxes`/`bottomBoxes`. Labeled flats stay cnt=1 (C: "edges with labels
aren't multi-edges") — do not route labeled edges through the group loop.
**Consequences:** One faithful implementation covering both routing directions.

## AD-5: Native C oracle; C instrumentation ephemeral; synthetic = validation
**Context:** No corpus trigger; memory `oracle-native-not-wasm`,
`instrument-c-before-quarantine`, `corpus-scan-for-rare-triggers`.
**Decision:** Validate cnt≥2 byte-match ONLY against native `dot` on synthetic
inputs (re-capture oracle SVGs at execution time — /tmp copies are throwaway). If a
box-channel mismatch needs pinning, instrument by rebuilding `gvplugin_dot_layout`,
copy `build/plugin/dot_layout/libgvplugin_dot_layout.8.dylib` → `/tmp/gvplugins`,
then `git -C ~/git/graphviz checkout` + rebuild clean + verify the oracle has no
probe markers. The complexity hook flags `dotsplines.c` >500 lines — FALSE POSITIVE;
never split C source.
**Consequences:** Reversible; oracle remains ground truth.
