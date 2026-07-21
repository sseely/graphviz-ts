# Batch 1 — B1 graph-bb residual

Depends on Batch 0. Skip if T0.2 marks B1 empty.

The largest current bucket (~23 pre-regen): firstDiff is the graph background
polygon (`[graph] _draw_ filled_polygon`), i.e. the graph bounding box differs.
The bb is a SYMPTOM — the root is whichever node/edge extent pushes it.
Representative: **graphs-unix** (unix genealogy; copies: graphs-lsunix1/2/3,
share-unix, windows-unix). Other distinct inputs in this bucket after regen
(e.g. crazy, b106, b29, 2168, 1436, 2476, 2095, 1652, root_twopi/circo) get the
same analysis method; investigate each distinct input, apply to its copies.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1.1 | Analyze: isolate what pushes the bb, to a mechanism | debugger | batch-1/findings.md | T0.2 | [x] |
| T1.2 | Fix aggressively or accept-with-evidence; apply to copies | general-purpose | (src fix, isolated) + batch-1/findings.md | T1.1 | [x] |

Analysis method (all B1 inputs): inject exact native positions
([[sfdp-edge-label-rtree-lossy]] repro harness), confirm the bb still diverges
with correct positions → the residual is bb-computation / label-sizing, not
drift. Then per `diagnosis.md` trace which extent (node label box, edge spline
hull vs curve — [[sfdp-graphbb-hull-vs-curve-entangled]], xlabel) sets the
divergent bb side. If injection CLEARS it, the id is drift (should have been
exonerated — recheck T0.1).
