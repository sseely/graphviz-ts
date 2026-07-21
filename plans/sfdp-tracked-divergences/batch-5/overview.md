# Batch 5 — B5 known / already-characterized

Depends on Batch 0. Skip individual ids if T0.2 reclassifies them.

Three ids with prior characterization:
- **2470** — edge-label placement; this session PROVED it reduces to a single
  objplpmks floor()-boundary rect amplified by the lossy xlabel RTree
  ([[sfdp-edge-label-rtree-lossy]]). Fix-aggressively target: the floor-boundary
  rect source (why one object's `pos.y - lblsz.y` crosses an integer) OR match
  the RTree structure. Likely accept (class `A-rtree`) with the existing proof.
- **2475_2** — x-coordinate network-simplex ([[hang-2475-2-xcoord-ns]],
  [[2825-layout-yshift-bug]]); huge injected residual. Investigate the NS
  keepout / rank read.
- **nshare-arrows_dot** — no attribution entry (T0.1 should add one); classify.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5.1 | Analyze 2470, 2475_2, arrows_dot | debugger | batch-5/findings.md | T0.2 | [x] |
| T5.2 | Fix aggressively or accept w/ evidence | general-purpose | (src fix, isolated) + batch-5/findings.md | T5.1 | [x] |

For 2470, fix-aggressively means: (a) find why THIS object's y crosses the
floor boundary (is it a computable node/label whose size the port gets 1 ULP
off, i.e. fixable? or an edge-midpoint anchor tied to a drifted spline?), and
(b) if genuinely a floor/ULP boundary, attempt to match the RTree structure so
the lossy gap coincides with native. Accept only if a controlled experiment
shows the boundary crossing is sub-ULP and unavoidable.
