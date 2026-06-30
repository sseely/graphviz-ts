<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | pre-mission | `graphs-b15` diverged, **maxDelta 0**, firstDiff `svg/g[1][childCount]`. Measured: `concentrate=true`; oracle 153 edge blocks, port 147 → port drops 6 edges (5 → `HoverRest:In` from different tails: FallFaceBack/HoverFaceBack/HoverForwardToStop:Normal, HoverStrafeToStop:Target, MidJumpFaceBack:Normal; 1 = LandVertical:Target→Stand:In). All record-port edges. Different tails ⇒ NOT parallel multi-edges ⇒ `classify.ts:concentrateOrMerge` IGNORED path (same tail+head+ports) ruled out as primary. C `dot_concentrate` (conc.c) merges only virtual nodes (portcmp-gated), never deletes originals ⇒ C emits all 153. Root cause in port `conc.ts` (mergevirtual/rebuild_vlists) or concentrated-chain emission (edge-route.ts/splines.ts). STALE memory note: `b69-concentrate-undermerge` claims b15 residual = x-coord; current diff is the structural edge drop. Decisions: instrument-first (AD-1), faithful port not dedup-key (AD-2), widened write-set across merge→emit (AD-3), gate vs committed HEAD (AD-4). |
