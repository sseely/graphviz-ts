# Batch 2 — Fix Issue 1: flat-label-rank vertical spacing

Make 2368's bbox match C (608×148, port 604×143) by correcting the flat-label
("abomination") rank vertical spacing so the top `{rank=same line7;136}` group
sits at C's Y. The 256→316 label vnode is byte-identical to C, so the fix is in
rank separation / `flatNode` height, NOT label placement.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Correct flat-label-rank ht/spacing per the T0 trace | debugger | `src/layout/dot/flat.ts` and/or `src/layout/dot/position-ycoords.ts` | T1 | [x] (NO-OP) |

**Outcome: NO-OP.** T0 found the vspace was not a positioning delta (node inter-rank
spans were identical) but the bbox failing to include the omitted down-arcs+labels.
Batch 1 (drawing those arcs) grew the bbox; every 2368 node Y now byte-matches C
(height 148, top group at -140.35). No `flat.ts`/`position-ycoords.ts` change was
needed — consistent with C `flat_edges` storing only label WIDTH for adjacent flats
(the `FIX:` comment: height not accounted). See decision-journal B2.

Execution rule: apply the spacing the T0 trace pinned (the rank whose Y/ht
differs by ~5pt), re-render 2368, run the full survey gate. Any byte-match→worse
is STOP + revert (AD-4). Batch done = 2368 bbox = C (608×148) AND survey 0
regressions AND 2368_1 + 1624 still byte-match. NOTE: the write-set is one of two
files — pick per T0 (node-height `flat.ts` vs rank-spacing `position-ycoords.ts`);
if BOTH need changes they are one logical unit (one task, one commit).
